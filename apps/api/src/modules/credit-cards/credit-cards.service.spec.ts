import { BadRequestException } from '@nestjs/common';
import { CreditCardsService, linesWithoutInvoice } from './credit-cards.service';

const TYPE_ID = '11111111-1111-1111-1111-111111111111';

function buildService(opts: { activeTypeIds?: string[]; lines?: unknown[] } = {}) {
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
      return (opts.activeTypeIds ?? [TYPE_ID])
        .filter((id) => ids.includes(id))
        .map((id) => ({ id, name: 'Viáticos cliente' }));
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
  const reportsRepo = {
    findOne: jest.fn(async () => ({
      id: 'r1',
      creatorId: 'u1',
      status: 'draft',
      lines: opts.lines ?? [],
    })),
    save: jest.fn(),
  };
  const notifications = { create: jest.fn() };
  const flows = { notify: jest.fn() };
  const service = new CreditCardsService(
    {} as any,
    reportsRepo as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    notifications as any,
    flows as any,
  );
  jest.spyOn(service as any, 'notifySubmitted').mockResolvedValue(undefined);
  return { service, mgr, saved, reportsRepo };
}

const baseLine = { lineDate: '2026-10-01', vendor: 'Prov', expenseTypeId: TYPE_ID };

describe('CreditCardsService.replaceLines (tipo y detalle)', () => {
  it('rechaza una línea sin tipo de gasto', async () => {
    const { service, mgr } = buildService();
    await expect(
      (service as any).replaceLines(mgr, 'r1', [{ ...baseLine, expenseTypeId: undefined }]),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza un tipo de gasto inexistente', async () => {
    const { service, mgr } = buildService({ activeTypeIds: [] });
    await expect((service as any).replaceLines(mgr, 'r1', [baseLine])).rejects.toThrow(
      BadRequestException,
    );
  });

  it('guarda el detalle recortado y vacío lo deja en null', async () => {
    const { service, mgr, saved } = buildService();
    await (service as any).replaceLines(mgr, 'r1', [
      { ...baseLine, detail: '  Comida con cliente ' },
      { ...baseLine, detail: '   ' },
      { ...baseLine },
    ]);
    expect(saved.map((l) => l.detail)).toEqual(['Comida con cliente', null, null]);
  });
});

describe('CreditCardsService.submitReport (factura por línea)', () => {
  const user = { id: 'u1' } as any;
  const withInvoice = { vendor: 'A', lineDate: '2026-10-01', sortOrder: 0, hasInvoice: true, invoiceS3Key: 'k' };
  const without = { vendor: 'B', lineDate: '2026-10-02', sortOrder: 1, hasInvoice: false, invoiceS3Key: null };

  it('bloquea el envío y lista las líneas sin factura', async () => {
    const { service, reportsRepo } = buildService({ lines: [withInvoice, without] });
    await expect(service.submitReport('r1', user)).rejects.toMatchObject({
      response: { linesWithoutInvoice: [{ position: 2, vendor: 'B', lineDate: '2026-10-02' }] },
    });
    expect(reportsRepo.save).not.toHaveBeenCalled();
  });

  it('permite el envío cuando todas las líneas tienen factura', async () => {
    const { service, reportsRepo } = buildService({ lines: [withInvoice] });
    await service.submitReport('r1', user);
    expect(reportsRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'submitted' }));
  });

  it('hasInvoice sin archivo en S3 no cuenta como factura', () => {
    expect(linesWithoutInvoice([{ ...withInvoice, invoiceS3Key: null }])).toHaveLength(1);
  });
});
