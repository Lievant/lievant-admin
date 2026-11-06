import { BadRequestException } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { levelOptions, levelSelection } from '../../../../web/src/app/(dashboard)/rrhh/empleados/level-options';

const CODES = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

/** Servicio con solo lo que usa la validación del nivel (repositorio falso con el catálogo de niveles). */
function build(record: Record<string, unknown> = { id: 'e1', level: null, status: 'active' }) {
  const queries: string[] = [];
  const repo = {
    query: jest.fn(async (sql: string) => {
      queries.push(sql);
      return CODES.map((code) => ({ code }));
    }),
    findOne: jest.fn(async () => record),
    save: jest.fn(async (r: unknown) => r),
    create: jest.fn((r: unknown) => r),
    createQueryBuilder: jest.fn(),
  };
  const nothing = {} as never;
  const service = new EmployeesService(repo as never, nothing, nothing, nothing, nothing, nothing, nothing, nothing, nothing, nothing, nothing, nothing, nothing);
  const resolve = (level: string | null | undefined, current: string | null) =>
    (service as unknown as { resolveEmployeeLevel(l: unknown, c: unknown): Promise<string | null> }).resolveEmployeeLevel(level, current);
  return { service, repo, queries, resolve, record };
}

describe('Empleados · el nivel es una lista cerrada (catalogs.org_levels)', () => {
  it('lee los niveles activos de catalogs.org_levels, ordenados', async () => {
    const { resolve, queries } = build();
    await resolve('III', null);
    expect(queries[0]).toContain('catalogs.org_levels');
    expect(queries[0]).toContain('is_active IS NOT FALSE');
    expect(queries[0]).toContain('ORDER BY sort_order');
  });

  it('un valor del catálogo se guarda con su código («ii», «2» y « IX » son II y IX)', async () => {
    const { resolve } = build();
    expect(await resolve('ii', null)).toBe('II');
    expect(await resolve('2', null)).toBe('II');
    expect(await resolve(' IX ', null)).toBe('IX');
  });

  it('un nivel que no existe en el catálogo da 400, con la lista de valores válidos', async () => {
    const { resolve } = build();
    for (const bad of ['IA', 'X', 'Sr', '15', 'Senior', 'V / VI']) {
      await expect(resolve(bad, null)).rejects.toBeInstanceOf(BadRequestException);
    }
    await expect(resolve('IA', null)).rejects.toThrow('El nivel debe ser uno de la lista: I, II, III, IV, V, VI, VII, VIII, IX');
  });

  it('vacío quita el nivel (null) sin consultar el catálogo', async () => {
    const { resolve, queries } = build();
    expect(await resolve('', 'II')).toBeNull();
    expect(await resolve('   ', null)).toBeNull();
    expect(await resolve(undefined, null)).toBeNull();
    expect(queries).toHaveLength(0);
  });

  it('un empleado con nivel fuera de catálogo conserva ese valor si no lo cambia, pero no puede pasar a otro fuera de catálogo', async () => {
    const { resolve } = build();
    expect(await resolve('IA', 'IA')).toBe('IA');
    expect(await resolve(' ia ', 'IA')).toBe('IA');
    await expect(resolve('X', 'IA')).rejects.toBeInstanceOf(BadRequestException);
    expect(await resolve('III', 'IA')).toBe('III');
  });

  it('editar con un nivel inexistente: 400 y no se guarda nada', async () => {
    const { service, repo } = build({ id: 'e1', level: 'III', status: 'active', fullName: 'TEST-Ana', position: 'Analista' });
    await expect(service.update('e1', { level: 'IA' })).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('editar otro campo de un empleado con nivel fuera de catálogo no toca ni valida su nivel', async () => {
    const { service, repo } = build({ id: 'e1', level: 'IA', status: 'active', fullName: 'TEST-Ana', position: 'Analista' });
    await service.update('e1', { position: 'Analista Senior' });
    expect(repo.save).toHaveBeenCalled();
    const saved = repo.save.mock.calls[0]![0] as { level: string; position: string };
    expect(saved.level).toBe('IA');
    expect(saved.position).toBe('Analista Senior');
    // reenviar el mismo valor fuera de catálogo (como hace el formulario) tampoco lo rechaza
    await service.update('e1', { level: 'IA', position: 'Otro' });
    expect((repo.save.mock.calls[1]![0] as { level: string }).level).toBe('IA');
  });

  it('editar con un nivel válido lo guarda canónico', async () => {
    const { service, repo } = build({ id: 'e1', level: 'IA', status: 'active', fullName: 'TEST-Ana', position: 'Analista' });
    await service.update('e1', { level: 'iii' });
    expect((repo.save.mock.calls[0]![0] as { level: string }).level).toBe('III');
  });
});

describe('Empleados (web) · desplegable de nivel', () => {
  const catalog = [{ code: 'I', name: 'Dirección General' }, { code: 'II', name: 'Dirección' }, { code: 'III', name: 'Head / Gerencia' }];
  it('muestra «código - nombre» y conserva un valor fuera de catálogo marcado como tal', () => {
    expect(levelOptions(catalog, null).map((o) => o.label)).toEqual(['I - Dirección General', 'II - Dirección', 'III - Head / Gerencia']);
    const sel = levelSelection(catalog, 'IA');
    expect(sel).toEqual({ value: 'IA', legacy: 'IA' });
    expect(levelOptions(catalog, sel.legacy)[0]).toEqual({ value: 'IA', label: 'IA (Fuera de Catálogo)' });
    expect(levelOptions(catalog, sel.legacy)).toHaveLength(4);
  });
  it('un nivel del catálogo (aunque venga con otra escritura) queda seleccionado y no se marca como fuera de catálogo', () => {
    expect(levelSelection(catalog, ' ii ')).toEqual({ value: 'II', legacy: null });
    expect(levelSelection(catalog, null)).toEqual({ value: '', legacy: null });
    expect(levelSelection(catalog, '')).toEqual({ value: '', legacy: null });
  });
});
