import { BadRequestException } from '@nestjs/common';
import { ExpensesService } from './expenses.service';

const TYPE_ID = '11111111-1111-1111-1111-111111111111';

function buildService(activeTypeIds: string[] = [TYPE_ID]) {
  const saved: any[] = [];
  const linesRepo = {
    find: jest.fn().mockResolvedValue([]),
    delete: jest.fn(),
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => {
      saved.push(...v);
      return v;
    }),
  };
  const typesRepo = {
    find: jest.fn(async ({ where }: any) => {
      const ids: string[] = where.id._value ?? [];
      return activeTypeIds.filter((id) => ids.includes(id)).map((id) => ({ id, name: 'Viáticos cliente' }));
    }),
  };
  const mgr = {
    getRepository: (entity: { name: string }) =>
      entity.name === 'CatalogExpenseType'
        ? typesRepo
        : entity.name === 'CatalogExpenseConcept'
          ? { find: jest.fn().mockResolvedValue([]) }
          : linesRepo,
  };
  const service = new (ExpensesService as any)({}, {}, {}, {}, {}, {}, {}, {});
  return { service: service as any, mgr, saved };
}

const baseLine = { lineDate: '2026-10-01', vendor: 'Prov', expenseTypeId: TYPE_ID };

describe('ExpensesService.replaceLines (tipo y detalle)', () => {
  it('rechaza una línea sin tipo de gasto', async () => {
    const { service, mgr } = buildService();
    await expect(
      service.replaceLines(mgr, 'r1', [{ ...baseLine, expenseTypeId: undefined }]),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza un tipo de gasto inexistente o inactivo', async () => {
    const { service, mgr } = buildService([]);
    await expect(service.replaceLines(mgr, 'r1', [baseLine])).rejects.toThrow(BadRequestException);
  });

  it('guarda el detalle recortado; vacío o ausente queda en null', async () => {
    const { service, mgr, saved } = buildService();
    await service.replaceLines(mgr, 'r1', [
      { ...baseLine, notes: '  Comida con cliente ' },
      { ...baseLine, notes: '   ' },
      { ...baseLine },
    ]);
    expect(saved.map((l) => l.notes)).toEqual(['Comida con cliente', null, null]);
    expect(saved[0].expenseTypeName).toBe('Viáticos cliente');
  });
});
