import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import ExcelJS from 'exceljs';
import { PERMISSION_KEY } from '../auth/decorators/permission.decorator';
import { TrainingReportQueryDto } from './dto/trainings-report.dto';
import { EmployeesController } from './employees.controller';
import { RIAC_COLUMNS, RIAC_REPORT_TITLE, buildRiacWorkbook, formatGeneratedAtMx, riacExcelRow } from './trainings-report-excel';
import { TrainingsReportService } from './trainings-report.service';
import {
  RIAC_EXPORT_MAX_ROWS,
  buildRiacWhere,
  describeRiacFilters,
  formatRiacDuration,
  riacFileName,
  toRiacItem,
  validateRiacRange,
  type RiacRow,
} from './trainings-report.util';

const row = (over: Partial<RiacRow> = {}): RiacRow => ({
  display_id: 'EMP-0001',
  full_name: 'Ana Pérez',
  area: 'Marketing',
  position: 'Analista',
  name: 'Curso de SQL',
  institution: 'Platzi',
  development_type: 'tecnico',
  level: 'basico',
  start_date: '2026-03-01',
  end_date: '2026-04-15',
  duration_value: 40,
  duration_unit: 'horas',
  is_company_recognition: false,
  total_count: 1,
  ...over,
});

describe('RIAC · validación del rango', () => {
  it('acepta un rango válido (incluido un solo día y exactamente 5 años)', () => {
    expect(() => validateRiacRange('2026-01-01', '2026-12-31')).not.toThrow();
    expect(() => validateRiacRange('2026-05-05', '2026-05-05')).not.toThrow();
    expect(() => validateRiacRange('2021-03-01', '2026-03-01')).not.toThrow();
  });

  it('rechaza Desde > Hasta, más de 5 años y fechas inexistentes', () => {
    expect(() => validateRiacRange('2026-02-01', '2026-01-01')).toThrow(BadRequestException);
    expect(() => validateRiacRange('2020-01-01', '2026-01-01')).toThrow(/5 años/);
    expect(() => validateRiacRange('2021-03-01', '2026-03-02')).toThrow(/5 años/);
    expect(() => validateRiacRange('2026-02-30', '2026-03-01')).toThrow(/Desde/);
    expect(() => validateRiacRange('2026-01-01', '2026-13-01')).toThrow(/Hasta/);
  });
});

describe('RIAC · formato', () => {
  it('duración en singular y plural', () => {
    expect(formatRiacDuration(40, 'horas')).toBe('40 horas');
    expect(formatRiacDuration(1, 'horas')).toBe('1 hora');
    expect(formatRiacDuration(6, 'meses')).toBe('6 meses');
    expect(formatRiacDuration(1, 'meses')).toBe('1 mes');
    expect(formatRiacDuration(null, null)).toBe('');
  });

  it('nombre del archivo', () => {
    expect(riacFileName('2026-01-01', '2026-06-30')).toBe('RIAC-2026-01-01-2026-06-30.xlsx');
  });

  it('fecha de generación en hora de México (UTC-6 en octubre)', () => {
    expect(formatGeneratedAtMx(new Date('2026-10-23T03:30:00Z'))).toBe('22/10/2026 21:30:00');
  });

  it('el elemento del reporte trae la duración formateada y no expone llaves de S3', () => {
    const item = toRiacItem(row());
    expect(item.duration).toBe('40 horas');
    expect(JSON.stringify(item)).not.toMatch(/s3|certificate/i);
  });
});

describe('RIAC · cláusula de la consulta', () => {
  const base = { from: '2026-01-01', to: '2026-06-30' };

  it('siempre: sin bajas lógicas, solo empleados activos y criterio de traslape con "En Curso" abierta hasta hoy', () => {
    const { where, params } = buildRiacWhere(base);
    expect(where).toContain('t.deleted_at IS NULL');
    expect(where).toContain('e.deleted_at IS NULL');
    expect(where).toContain("e.status = 'active'");
    expect(where).toContain('t.start_date <= $2::date');
    expect(where).toMatch(/COALESCE\(t\.end_date, GREATEST\(t\.start_date, \(NOW\(\) AT TIME ZONE 'America\/Mexico_City'\)::date\)\) >= \$1::date/);
    expect(params).toEqual(['2026-01-01', '2026-06-30']);
  });

  it('Reconocimientos filtra por la casilla sin importar el tipo de desarrollo', () => {
    const { where, params } = buildRiacWhere({ ...base, type: 'reconocimientos' });
    expect(where).toContain('t.is_company_recognition = true');
    expect(where).not.toContain('development_type');
    expect(params).toHaveLength(2);
  });

  it('un tipo de desarrollo filtra por la columna; área, división y colaborador suman parámetros', () => {
    const { where, params } = buildRiacWhere({ ...base, type: 'academico', area: 'Ventas', division: 'Norte', employeeId: 'emp-1' });
    expect(where).toContain('t.development_type = $3');
    expect(where).toContain('e.area = $4');
    expect(where).toContain('e.division = $5');
    expect(where).toContain('e.id = $6');
    expect(params).toEqual(['2026-01-01', '2026-06-30', 'academico', 'Ventas', 'Norte', 'emp-1']);
    expect(where).not.toContain('is_company_recognition');
  });

  it('describe los filtros para el encabezado del Excel', () => {
    expect(describeRiacFilters(base)).toBe('Tipo: Todos · Área: Todas · División: Todas · Colaborador: Todos');
    expect(describeRiacFilters({ ...base, type: 'reconocimientos', area: 'Ventas', employeeId: 'x' }, 'Ana Pérez')).toBe(
      'Tipo: Reconocimientos · Área: Ventas · División: Todas · Colaborador: Ana Pérez',
    );
  });
});

describe('RIAC · DTO', () => {
  const errs = async (plain: object) => (await validate(plainToInstance(TrainingReportQueryDto, plain))).map((e) => e.property);
  it('Desde y Hasta obligatorios, con formato', async () => {
    expect(await errs({})).toEqual(expect.arrayContaining(['from', 'to']));
    expect(await errs({ from: '01/01/2026', to: '2026-02-01' })).toContain('from');
    expect(await errs({ from: '2026-01-01', to: '2026-02-01' })).toEqual([]);
  });
  it('tipo, colaborador y límite acotados', async () => {
    const ok = { from: '2026-01-01', to: '2026-02-01' };
    expect(await errs({ ...ok, type: 'reconocimientos' })).toEqual([]);
    expect(await errs({ ...ok, type: 'otro' })).toContain('type');
    expect(await errs({ ...ok, employeeId: 'no-uuid' })).toContain('employeeId');
    expect(await errs({ ...ok, limit: 101 })).toContain('limit');
    expect(await errs({ ...ok, page: 0 })).toContain('page');
  });
});

// ── Servicio con BD simulada ─────────────────────────────────────────────────

function setup(rows: RiacRow[] = [row()], countRows: { n: string }[] = [{ n: '0' }]) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const dataSource = {
    query: jest.fn(async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      if (/SELECT COUNT\(\*\) AS n/.test(sql)) return countRows;
      if (/SELECT full_name FROM employees\.employee_records/.test(sql)) return [{ full_name: 'Ana Pérez' }];
      return rows;
    }),
  };
  const audit = { logActivity: jest.fn(async () => undefined) };
  return { service: new TrainingsReportService(dataSource as any, audit as any), calls, audit, dataSource };
}

const dto = (over: object = {}) => plainToInstance(TrainingReportQueryDto, { from: '2026-01-01', to: '2026-06-30', ...over });
const ACTOR = { id: 'rrhh-1', email: 'rrhh@lievant.com', name: 'RRHH' };

describe('RIAC · servicio', () => {
  it('una sola consulta con join, total en la misma consulta, orden por nombre y fecha de inicio descendente', async () => {
    const { service, calls } = setup([row({ total_count: 53 })]);
    const res = await service.getReport(dto({ page: 2, limit: 10 }));
    expect(calls).toHaveLength(1);
    expect(calls[0]!.sql).toContain('JOIN employees.employee_records e');
    expect(calls[0]!.sql).toContain('COUNT(*) OVER()');
    expect(calls[0]!.sql).toMatch(/ORDER BY e\.full_name ASC, t\.start_date DESC/);
    expect(calls[0]!.params.slice(-2)).toEqual([10, 10]);
    expect(res).toMatchObject({ total: 53, page: 2, limit: 10, totalPages: 6 });
  });

  it('página fuera de rango: cuenta aparte; sin resultados en la primera: total 0 sin consulta extra', async () => {
    const out = setup([], [{ n: '7' }]);
    expect((await out.service.getReport(dto({ page: 9 }))).total).toBe(7);
    const empty = setup([]);
    const res = await empty.service.getReport(dto());
    expect(res).toMatchObject({ total: 0, totalPages: 1, data: [] });
    expect(empty.calls).toHaveLength(1);
  });

  it('un rango inválido se rechaza antes de consultar', async () => {
    const { service, calls } = setup();
    await expect(service.getReport(dto({ from: '2026-07-01', to: '2026-01-01' }))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.exportExcel(dto({ from: '2015-01-01', to: '2026-01-01' }), ACTOR)).rejects.toBeInstanceOf(BadRequestException);
    expect(calls).toHaveLength(0);
  });

  it('la exportación trae todo (sin paginar), respeta los filtros y devuelve el nombre correcto', async () => {
    const { service, calls } = setup([row(), row({ name: 'Otro curso' })]);
    const out = await service.exportExcel(dto({ type: 'tecnico', area: 'Marketing' }), ACTOR);
    expect(out.fileName).toBe('RIAC-2026-01-01-2026-06-30.xlsx');
    expect(calls[0]!.sql).not.toContain('OFFSET');
    expect(calls[0]!.params).toEqual(['2026-01-01', '2026-06-30', 'tecnico', 'Marketing', RIAC_EXPORT_MAX_ROWS + 1]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(out.buffer as unknown as ArrayBuffer);
    const ws = wb.getWorksheet('RIAC')!;
    expect(ws.getCell(3, 2).value).toContain('Tipo: Técnico · Área: Marketing');
    expect(ws.rowCount).toBe(7 + 2);
  });

  it('por encima del tope de filas se rechaza con un mensaje claro y no se audita', async () => {
    const many = Array.from({ length: RIAC_EXPORT_MAX_ROWS + 1 }, () => row());
    const { service, audit } = setup(many);
    await expect(service.exportExcel(dto(), ACTOR)).rejects.toThrow(/supera 20[.,]000 registros/);
    expect(audit.logActivity).not.toHaveBeenCalled();
  });

  it('audita la exportación (quién y con qué filtros) y la consulta normal no audita', async () => {
    const { service, audit } = setup();
    await service.getReport(dto());
    expect(audit.logActivity).not.toHaveBeenCalled();
    await service.exportExcel(dto({ type: 'reconocimientos', employeeId: '11111111-1111-4111-8111-111111111111' }), ACTOR);
    expect(audit.logActivity).toHaveBeenCalledTimes(1);
    expect(audit.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'export',
        module: 'empleados',
        entityType: 'riac_report',
        userId: 'rrhh-1',
        entityName: 'RIAC-2026-01-01-2026-06-30.xlsx',
        changes: expect.objectContaining({
          rows: 1,
          filters: expect.objectContaining({ type: 'reconocimientos', from: '2026-01-01', to: '2026-06-30' }),
        }),
      }),
    );
  });
});

// ── Excel ────────────────────────────────────────────────────────────────────

describe('RIAC · Excel', () => {
  async function load(items = [toRiacItem(row()), toRiacItem(row({ end_date: null, name: 'En curso', is_company_recognition: true, duration_value: null, duration_unit: null }))]) {
    const wb = buildRiacWorkbook({ items, from: '2026-01-01', to: '2026-06-30', filtersText: 'Tipo: Todos', generatedAt: new Date('2026-10-23T18:00:00Z') });
    const buf = await wb.xlsx.writeBuffer();
    const re = new ExcelJS.Workbook();
    await re.xlsx.load(buf as ArrayBuffer);
    return re.getWorksheet('RIAC')!;
  }

  it('encabezado: nombre del reporte, periodo, filtros, generación y logo', async () => {
    const ws = await load();
    expect(ws.getCell(1, 2).value).toBe(RIAC_REPORT_TITLE);
    expect(ws.getCell(2, 2).value).toBe('Periodo: 01/01/2026 al 30/06/2026');
    expect(ws.getCell(3, 2).value).toBe('Filtros: Tipo: Todos');
    expect(String(ws.getCell(4, 2).value)).toContain('23/10/2026 12:00:00');
    expect(ws.getImages().length).toBe(1);
  });

  it('tabla con todas las columnas en orden, encabezado congelado y filtros de Excel', async () => {
    const ws = await load();
    expect(RIAC_COLUMNS).toHaveLength(12);
    expect(RIAC_COLUMNS.map((_, i) => ws.getCell(7, i + 1).value)).toEqual([...RIAC_COLUMNS]);
    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 7 });
    expect(ws.autoFilter).toBeTruthy();
  });

  it('fechas con formato dd/mm/aaaa, "En Curso", duración y reconocimiento', async () => {
    const ws = await load();
    const start = ws.getCell(8, 9);
    expect(start.numFmt).toBe('dd/mm/yyyy');
    expect((start.value as Date).toISOString().slice(0, 10)).toBe('2026-03-01');
    expect(ws.getCell(8, 10).value instanceof Date).toBe(true);
    expect(ws.getCell(8, 11).value).toBe('40 horas');
    expect(ws.getCell(8, 12).value).toBe('No');
    expect(ws.getCell(9, 10).value).toBe('En Curso');
    expect(ws.getCell(9, 12).value).toBe('Sí');
  });

  it('anchos automáticos acotados', async () => {
    const ws = await load([toRiacItem(row({ name: 'x'.repeat(200) }))]);
    expect(ws.getColumn(5).width).toBeLessThanOrEqual(60);
    expect(ws.getColumn(1).width).toBeGreaterThanOrEqual(16);
  });

  it('la fila no incluye ningún campo de certificado', () => {
    expect(riacExcelRow(toRiacItem(row()))).toHaveLength(12);
  });
});

describe('RIAC · permisos y rutas', () => {
  const proto = EmployeesController.prototype as any;
  it.each(['getTrainingReport', 'exportTrainingReport', 'getTrainingReportOptions'])('%s exige rrhh.capacitaciones.read', (n) => {
    expect(Reflect.getMetadata(PERMISSION_KEY, proto[n])).toEqual({ section: 'rrhh', module: 'capacitaciones', action: 'read' });
  });
  it('van antes de las rutas con :id', () => {
    const order = Object.getOwnPropertyNames(proto);
    for (const n of ['getTrainingReport', 'exportTrainingReport', 'getTrainingReportOptions']) {
      expect(order.indexOf(n)).toBeLessThan(order.indexOf('findOne'));
    }
  });
});
