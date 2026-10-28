import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PERMISSION_KEY } from '../auth/decorators/permission.decorator';
import { ExportOrgChartDto } from './dto/export-org-chart.dto';
import { EmployeesController } from './employees.controller';
import { OrgChartExportService } from './org-chart-export.service';

const ACTOR = { id: 'user-1', email: 'claudia@lievant.com', name: 'Claudia' };

describe('Organigrama · exportar a PDF (permiso y auditoría)', () => {
  const proto = EmployeesController.prototype as unknown as Record<string, object>;

  it('la ruta exige rrhh.organigrama.export (no es de sesión sola)', () => {
    expect(Reflect.getMetadata(PERMISSION_KEY, proto['registerOrgChartExport']!)).toEqual({ section: 'rrhh', module: 'organigrama', action: 'export' });
  });

  it('el organigrama y sus filtros siguen abiertos a cualquier usuario autenticado', () => {
    expect(Reflect.getMetadata(PERMISSION_KEY, proto['getOrgChart']!)).toBeNull();
    expect(Reflect.getMetadata(PERMISSION_KEY, proto['getOrgChartFilters']!)).toBeNull();
  });

  it('la ruta se declara antes de las rutas con :id', () => {
    const names = Object.getOwnPropertyNames(EmployeesController.prototype);
    expect(names.indexOf('registerOrgChartExport')).toBeGreaterThan(-1);
    expect(names.indexOf('registerOrgChartExport')).toBeLessThan(names.indexOf('findOne'));
  });

  it('registra quién, vista, filtros y papel y devuelve el visto bueno', async () => {
    const audit = { logActivity: jest.fn().mockResolvedValue(undefined) };
    const svc = new OrgChartExportService(audit as never);
    const res = await svc.register(
      plainToInstance(ExportOrgChartDto, { view: 'levels', paper: 'a3', company: 'TEST-Lievant', division: 'TEST-Tecnología', pages: 3, employees: 12 }),
      ACTOR,
    );
    expect(res.authorized).toBe(true);
    expect(res.organization).toBe('Lievant');
    expect(new Date(res.generatedAt).toString()).not.toBe('Invalid Date');
    expect(audit.logActivity).toHaveBeenCalledTimes(1);
    expect(audit.logActivity.mock.calls[0]![0]).toMatchObject({
      userId: 'user-1',
      userEmail: 'claudia@lievant.com',
      action: 'export',
      module: 'organigrama',
      entityType: 'org_chart',
      changes: {
        view: { from: null, to: 'levels' },
        paper: { from: null, to: 'a3' },
        filters: { from: null, to: { company: 'TEST-Lievant', division: 'TEST-Tecnología' } },
        pages: { from: null, to: 3 },
        employees: { from: null, to: 12 },
      },
    });
  });

  it('sin filtros la bitácora guarda un objeto vacío', async () => {
    const audit = { logActivity: jest.fn().mockResolvedValue(undefined) };
    await new OrgChartExportService(audit as never).register(plainToInstance(ExportOrgChartDto, { view: 'hierarchy', paper: 'carta' }), ACTOR);
    expect(audit.logActivity.mock.calls[0]![0].changes.filters).toEqual({ from: null, to: {} });
  });

  it('valida vista y papel con listas cerradas', async () => {
    const errs = async (plain: object) => (await validate(plainToInstance(ExportOrgChartDto, plain))).map((e) => e.property).sort();
    expect(await errs({ view: 'hierarchy', paper: 'carta' })).toEqual([]);
    expect(await errs({ view: 'levels', paper: 'a3', level: 'II', location: 'León' })).toEqual([]);
    expect(await errs({ view: 'otra', paper: 'a4' })).toEqual(['paper', 'view']);
    expect(await errs({})).toEqual(['paper', 'view']);
    expect(await errs({ view: 'levels', paper: 'a3', pages: 0 })).toEqual(['pages']);
  });
});
