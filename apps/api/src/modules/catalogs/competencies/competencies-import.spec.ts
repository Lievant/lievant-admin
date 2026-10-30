import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { CompetenciesImportService } from './competencies-import.service';
import { parseCompetenciesSheets, type RawSheet } from './competencies-import.parser';
import { FakeCompetencyRepo, FakeDataSource } from './competencies-fake';

const ACTOR = { id: 'user-1', email: 'admin@lievant.com', name: 'Admin' };

const sheet = (rows: string[][], name = 'Competencias Lievant'): RawSheet => ({ name, rows });

/** Arma un .xlsx (Buffer) con la hoja pedida. */
async function xlsx(rows: (string | number | null)[][], sheetName = 'Competencias Lievant', fileName = 'TEST-competencias.xlsx') {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  for (const r of rows) ws.addRow(r);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, originalname: fileName, size: buffer.length };
}

function setup() {
  const repo = new FakeCompetencyRepo();
  const audit = { logActivity: jest.fn().mockResolvedValue(undefined) };
  const service = new CompetenciesImportService(new FakeDataSource(repo) as never, audit as never);
  return { repo, audit, service };
}

describe('Importación de competencias · lectura de columnas', () => {
  it('encuentra los encabezados por nombre (mayúsculas, acentos y espacios no importan) aunque no estén en la fila 1', () => {
    const r = parseCompetenciesSheets([
      sheet([['Catálogo de Lievant'], [], [' id ', ' COMPETENCIA ', 'Descripción', 'ORDEN'], ['7', 'TEST-A', 'Texto', '2']]),
    ]);
    expect(r.errors).toEqual([]);
    expect(r.rows).toMatchObject([{ row: 4, name: 'TEST-A', description: 'Texto', order: 2 }]);
  });

  it('«Nombre» también sirve para la columna obligatoria', () => {
    const r = parseCompetenciesSheets([sheet([['Nombre'], ['TEST-A']])]);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]!.name).toBe('TEST-A');
  });

  it('usa la hoja que se llama «Competencias…» y, si no hay, la primera', () => {
    const a = parseCompetenciesSheets([sheet([['Competencia'], ['TEST-Otra']], 'Resumen'), sheet([['Competencia'], ['TEST-Buena']], 'Competencias Lievant')]);
    expect(a.rows.map((x) => x.name)).toEqual(['TEST-Buena']);
    const b = parseCompetenciesSheets([sheet([['Competencia'], ['TEST-Primera']], 'Hoja1'), sheet([['Competencia'], ['TEST-Segunda']], 'Hoja2')]);
    expect(b.rows.map((x) => x.name)).toEqual(['TEST-Primera']);
  });

  it('sin la columna «Competencia» el archivo no sirve (error del archivo, sin número de fila)', () => {
    const r = parseCompetenciesSheets([sheet([['ID', 'Texto'], ['1', 'x']])]);
    expect(r.errors).toEqual([{ row: null, message: expect.stringMatching(/Competencia/) }]);
  });

  it('ignora las filas totalmente vacías y conserva el número de fila de Excel', () => {
    const r = parseCompetenciesSheets([sheet([['Competencia'], ['TEST-A'], ['', ' '], [], ['TEST-B']])]);
    expect(r.errors).toEqual([]);
    expect(r.dataRows).toBe(2);
    expect(r.rows.map((x) => x.row)).toEqual([2, 5]);
  });

  it('recorta el nombre y colapsa los espacios múltiples', () => {
    const r = parseCompetenciesSheets([sheet([['Competencia'], ['  TEST-Trabajo    en   equipo ']])]);
    expect(r.rows[0]!.name).toBe('TEST-Trabajo en equipo');
  });
});

describe('Importación de competencias · regla del Orden', () => {
  it('la columna «Orden» tiene prioridad sobre el «ID»', () => {
    const r = parseCompetenciesSheets([sheet([['ID', 'Competencia', 'Orden'], ['50', 'TEST-A', '3']])]);
    expect(r.rows[0]!.order).toBe(3);
  });

  it('sin «Orden», el «ID» numérico del Excel se usa como Orden', () => {
    const r = parseCompetenciesSheets([sheet([['ID', 'Competencia'], ['12', 'TEST-A'], ['5', 'TEST-B']])]);
    expect(r.rows.map((x) => x.order)).toEqual([12, 5]);
  });

  it('sin «Orden» ni «ID», el orden es la posición de la fila (sin contar las vacías)', () => {
    const r = parseCompetenciesSheets([sheet([['Competencia'], ['TEST-A'], [''], ['TEST-B'], ['TEST-C']])]);
    expect(r.rows.map((x) => x.order)).toEqual([1, 2, 3]);
  });

  it('un Orden que no es entero de 0 a 32767 es error con el número de fila', () => {
    const r = parseCompetenciesSheets([sheet([['Competencia', 'Orden'], ['TEST-A', 'uno'], ['TEST-B', '1.5'], ['TEST-C', '-1'], ['TEST-D', '32768'], ['TEST-E', '0'], ['TEST-F', '32767']])]);
    expect(r.errors.map((e) => e.row)).toEqual([2, 3, 4, 5]);
    expect(r.errors.every((e) => /Orden/.test(e.message))).toBe(true);
  });

  it('un ID que no cabe como Orden también es error; un ID no numérico se ignora', () => {
    const r = parseCompetenciesSheets([sheet([['ID', 'Competencia'], ['99999', 'TEST-A'], ['abc', 'TEST-B']])]);
    expect(r.errors).toEqual([{ row: 2, message: expect.stringMatching(/ID/) }]);
    expect(r.rows.map((x) => x.name)).toEqual(['TEST-B']);
    expect(r.rows[0]!.order).toBeNull();
  });
});

describe('Importación de competencias · errores del archivo', () => {
  it('nombre vacío, de más de 150, repetido en el archivo (sin importar mayúsculas ni acentos) y descripción de más de 1000', () => {
    const r = parseCompetenciesSheets([
      sheet([
        ['ID', 'Competencia', 'Descripción'],
        ['1', '', 'sin nombre'],
        ['2', 'x'.repeat(151), ''],
        ['3', 'TEST-Comunicación', ''],
        ['4', 'test-comunicacion', ''],
        ['5', 'TEST-Larga', 'd'.repeat(1001)],
        ['6', 'TEST-Bien', 'd'.repeat(1000)],
      ]),
    ]);
    expect(r.errors.map((e) => e.row)).toEqual([2, 3, 5, 6]);
    expect(r.errors[0]!.message).toMatch(/nombre/i);
    expect(r.errors[1]!.message).toMatch(/150/);
    expect(r.errors[2]!.message).toMatch(/repetido.*fila 4/);
    expect(r.errors[3]!.message).toMatch(/1000/);
    expect(r.rows.map((x) => x.name)).toEqual(['TEST-Comunicación', 'TEST-Bien']);
  });
});

describe('Importación de competencias · vista previa y aplicación', () => {
  it('vista previa: cuenta lo que se crearía y no escribe nada', async () => {
    const { repo, service } = setup();
    const r = await service.run('preview', await xlsx([['ID', 'Competencia'], [1, 'TEST-A'], [2, 'TEST-B']]), ACTOR);
    expect(r.applied).toBe(false);
    expect(r.summary).toMatchObject({ create: 2, update: 0, unchanged: 0, restore: 0, errors: 0, warnings: 0 });
    expect(r.rows.map((x) => [x.row, x.name, x.order, x.action])).toEqual([[2, 'TEST-A', 1, 'crear'], [3, 'TEST-B', 2, 'crear']]);
    expect(repo.rows).toHaveLength(0);
  });

  it('aplicar crea las competencias activas con el ID del Excel como Orden (no como id) y registra la auditoría', async () => {
    const { repo, service, audit } = setup();
    const r = await service.run('apply', await xlsx([['ID', 'Competencia'], [10, 'TEST-A'], [20, 'TEST-B']]), ACTOR);
    expect(r.applied).toBe(true);
    expect(repo.rows.map((c) => [c.name, c.sortOrder, c.isActive, c.description])).toEqual([['TEST-A', 10, true, null], ['TEST-B', 20, true, null]]);
    expect(repo.rows.every((c) => /^00000000-/.test(c.id))).toBe(true); // el id lo da la base, no el Excel
    expect(audit.logActivity).toHaveBeenCalledTimes(1);
    expect(audit.logActivity.mock.calls[0]![0]).toMatchObject({ action: 'import', module: 'catalogos', userId: 'user-1', entityName: 'TEST-competencias.xlsx' });
  });

  it('reimportar el mismo archivo: todo «sin cambios» y sin escribir', async () => {
    const { repo, service, audit } = setup();
    const file = await xlsx([['ID', 'Competencia', 'Descripción'], [1, 'TEST-A', 'uno'], [2, 'TEST-B', null]]);
    await service.run('apply', file, ACTOR);
    const before = repo.rows.map((c) => ({ ...c }));
    const again = await service.run('apply', file, ACTOR);
    expect(again.summary).toMatchObject({ create: 0, update: 0, unchanged: 2, restore: 0 });
    expect(again.rows.every((x) => x.action === 'sin cambios')).toBe(true);
    expect(repo.rows.map((c) => ({ ...c }))).toEqual(before);
    expect(audit.logActivity).toHaveBeenCalledTimes(2); // cada aplicación se registra
  });

  it('actualiza descripción y orden, pero una celda vacía o una columna ausente no pisan lo que ya tiene', async () => {
    const { repo, service } = setup();
    await service.run('apply', await xlsx([['Competencia', 'Descripción', 'Orden'], ['TEST-A', 'original', 5], ['TEST-B', 'otra', 6]]), ACTOR);
    // A trae descripción nueva y orden vacío; B trae descripción vacía y orden nuevo
    const r = await service.run('apply', await xlsx([['Competencia', 'Descripción', 'Orden'], ['TEST-A', 'cambiada', null], ['TEST-B', null, 9]]), ACTOR);
    expect(r.summary).toMatchObject({ update: 2, unchanged: 0 });
    const a = repo.rows.find((c) => c.name === 'TEST-A')!;
    const b = repo.rows.find((c) => c.name === 'TEST-B')!;
    expect([a.description, a.sortOrder]).toEqual(['cambiada', 5]);
    expect([b.description, b.sortOrder]).toEqual(['otra', 9]);
    // sin columnas de descripción ni orden: solo posición, la descripción no se toca
    await service.run('apply', await xlsx([['Competencia'], ['TEST-B'], ['TEST-A']]), ACTOR);
    expect(repo.rows.find((c) => c.name === 'TEST-A')!.description).toBe('cambiada');
  });

  it('las que existen y no vienen en el archivo no se tocan (ni se eliminan ni se desactivan)', async () => {
    const { repo, service } = setup();
    await service.run('apply', await xlsx([['Competencia'], ['TEST-A'], ['TEST-B']]), ACTOR);
    repo.rows.find((c) => c.name === 'TEST-B')!.isActive = false;
    await service.run('apply', await xlsx([['Competencia'], ['TEST-A'], ['TEST-C']]), ACTOR);
    const b = repo.rows.find((c) => c.name === 'TEST-B')!;
    expect([b.isActive, b.deletedAt]).toEqual([false, null]);
    expect(repo.rows).toHaveLength(3);
  });

  it('coincidir con una eliminada la RESTAURA (activa) con un aviso', async () => {
    const { repo, service } = setup();
    await service.run('apply', await xlsx([['Competencia', 'Descripción'], ['TEST-Vieja', 'texto']]), ACTOR);
    const old = repo.rows[0]!;
    old.deletedAt = new Date();
    old.isActive = false;
    const preview = await service.run('preview', await xlsx([['Competencia'], ['test-vieja']]), ACTOR);
    expect(preview.summary).toMatchObject({ restore: 1, create: 0, warnings: 1 });
    expect(preview.warnings[0]!.message).toMatch(/restaur/i);
    const r = await service.run('apply', await xlsx([['Competencia'], ['test-vieja']]), ACTOR);
    expect(r.rows[0]!.action).toBe('restaurar');
    expect(repo.rows).toHaveLength(1); // la misma fila, no una nueva
    expect([old.deletedAt, old.isActive, old.description, old.name]).toEqual([null, true, 'texto', 'TEST-Vieja']);
  });

  it('avisa (sin bloquear) cuando el nombre solo difiere en mayúsculas o acentos: se trata como actualización', async () => {
    const { repo, service } = setup();
    await service.run('apply', await xlsx([['Competencia'], ['TEST-Comunicación']]), ACTOR);
    const r = await service.run('apply', await xlsx([['Competencia', 'Descripción'], ['test-comunicacion', 'nueva']]), ACTOR);
    expect(r.summary).toMatchObject({ update: 1, create: 0, warnings: 1, errors: 0 });
    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0]!.name).toBe('TEST-Comunicación'); // el nombre guardado no cambia
    expect(repo.rows[0]!.description).toBe('nueva');
  });

  it('todo o nada: un error en el archivo no escribe nada', async () => {
    const { repo, service, audit } = setup();
    const r = await service.run('apply', await xlsx([['Competencia', 'Orden'], ['TEST-A', 1], ['TEST-B', 'mal'], ['TEST-C', 3]]), ACTOR);
    expect(r.applied).toBe(false);
    expect(r.summary.errors).toBe(1);
    expect(r.errors[0]).toMatchObject({ row: 3 });
    expect(repo.rows).toHaveLength(0);
    expect(audit.logActivity).not.toHaveBeenCalled();
  });

  it('todo o nada: si falla al escribir a la mitad, la transacción se revierte completa', async () => {
    const { repo, service, audit } = setup();
    await service.run('apply', await xlsx([['Competencia', 'Descripción'], ['TEST-Existente', 'antes']]), ACTOR);
    repo.failOnSave = (c) => (c.name === 'TEST-C' ? new Error('falla simulada') : null);
    await expect(
      service.run('apply', await xlsx([['Competencia', 'Descripción'], ['TEST-Existente', 'después'], ['TEST-B', null], ['TEST-C', null]]), ACTOR),
    ).rejects.toThrow('falla simulada');
    expect(repo.rows.map((c) => c.name)).toEqual(['TEST-Existente']);
    expect(repo.rows[0]!.description).toBe('antes');
    expect(audit.logActivity).toHaveBeenCalledTimes(1); // solo la primera importación
  });
});

describe('Importación de competencias · el archivo', () => {
  it('rechaza lo que no es un .xlsx válido, el vacío y el que pasa de 500 filas o de 5 MB', async () => {
    const { service } = setup();
    await expect(service.run('preview', undefined, ACTOR)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.run('preview', { buffer: Buffer.from('a,b'), originalname: 'a.csv', size: 3 }, ACTOR)).rejects.toThrow(/\.xlsx/);
    await expect(service.run('preview', { buffer: Buffer.from('PK\u0003\u0004xxxx'), originalname: 'a.xlsx', size: 8 }, ACTOR)).rejects.toThrow(/Excel/);
    const rows: (string | number)[][] = [['Competencia']];
    for (let i = 1; i <= 501; i++) rows.push([`TEST-${i}`]);
    await expect(service.run('preview', await xlsx(rows), ACTOR)).rejects.toThrow(/500 filas/);
    const big = Buffer.alloc(5 * 1024 * 1024 + 1);
    await expect(service.run('preview', { buffer: big, originalname: 'a.xlsx', size: big.length }, ACTOR)).rejects.toThrow(/5 MB/);
  });

  it('acepta justo 500 filas', async () => {
    const { service } = setup();
    const rows: (string | number)[][] = [['Competencia']];
    for (let i = 1; i <= 500; i++) rows.push([`TEST-${i}`]);
    const r = await service.run('preview', await xlsx(rows), ACTOR);
    expect(r.summary.create).toBe(500);
  });
});
