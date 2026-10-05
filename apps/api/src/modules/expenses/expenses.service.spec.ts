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

describe('ExpensesService.submitReport (adjunto por línea)', () => {
  const user = { id: 'u1' } as any;
  const withFile = { vendor: 'A', lineDate: '2026-10-01', sortOrder: 0, hasInvoice: true, invoiceS3Key: 'k' };
  const without = { vendor: 'B', lineDate: '2026-10-02', sortOrder: 1, hasInvoice: false, invoiceS3Key: null };

  function build(lines: unknown[], status = 'draft') {
    const reportsRepo = {
      findOne: jest.fn(async () => ({
        id: 'r1',
        requesterId: 'u1',
        authorizerId: 'a1',
        status,
        lines,
      })),
      save: jest.fn(),
    };
    const service: any = new (ExpensesService as any)(reportsRepo, {}, {}, {}, {}, {}, {}, {});
    jest.spyOn(service, 'notifySubmitted').mockResolvedValue(undefined);
    return { service, reportsRepo };
  }

  it('bloquea el envío y lista las líneas sin adjunto', async () => {
    const { service, reportsRepo } = build([withFile, without]);
    await expect(service.submitReport('r1', user)).rejects.toMatchObject({
      response: { linesWithoutInvoice: [{ position: 2, vendor: 'B', lineDate: '2026-10-02' }] },
    });
    expect(reportsRepo.save).not.toHaveBeenCalled();
  });

  it('permite el envío cuando todas las líneas tienen adjunto', async () => {
    const { service, reportsRepo } = build([withFile]);
    await service.submitReport('r1', user);
    expect(reportsRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'submitted' }));
  });

  it('un adjunto marcado pero sin archivo (quitado) no cuenta', async () => {
    const { service } = build([{ ...withFile, invoiceS3Key: null }]);
    await expect(service.submitReport('r1', user)).rejects.toThrow(BadRequestException);
  });

  it('un reporte ya enviado sigue rechazándose por su estado, no por adjuntos', async () => {
    const { service } = build([without], 'submitted');
    await expect(service.submitReport('r1', user)).rejects.toThrow(/ya fue enviado/);
  });
});
