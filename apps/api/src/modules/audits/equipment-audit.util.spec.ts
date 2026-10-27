import 'reflect-metadata';
import { PERMISSION_KEY } from '../auth/decorators/permission.decorator';
import { EquipmentAuditController } from './equipment-audit.controller';
import {
  buildMaintenanceSummary,
  formatAuditCode,
  isMacEligible,
  isMaintenanceEligible,
  MAINTENANCE_CHECKS,
  MaintenanceColumn,
  normalizeMac,
  resolveFinalStatus,
} from './equipment-audit.util';

describe('equipment-audit.util', () => {
  it('formatea el código a seis dígitos', () => {
    expect(formatAuditCode(1)).toBe('AUD-000001');
    expect(formatAuditCode('1234')).toBe('AUD-001234');
  });

  it('normaliza la MAC con cualquier separador', () => {
    expect(normalizeMac('aa:bb:cc:dd:ee:ff')).toBe('AA:BB:CC:DD:EE:FF');
    expect(normalizeMac('AA-BB-CC-DD-EE-01')).toBe('AA:BB:CC:DD:EE:01');
    expect(normalizeMac('aabb.ccdd.eeff')).toBe('AA:BB:CC:DD:EE:FF');
    expect(normalizeMac('aabbccddeeff')).toBe('AA:BB:CC:DD:EE:FF');
    expect(normalizeMac('  ')).toBeNull();
    expect(normalizeMac(null)).toBeNull();
    expect(normalizeMac('aa:bb:cc:dd:ee')).toBeUndefined();
    expect(normalizeMac('zz:bb:cc:dd:ee:ff')).toBeUndefined();
  });

  it('decide MAC y mantenimiento con los nombres reales del inventario', () => {
    for (const t of ['Laptop', 'PC Escritorio', 'Celular', 'Celular ']) expect(isMacEligible(t)).toBe(true);
    for (const t of ['Monitor', 'Mouse', 'Tableta', null]) expect(isMacEligible(t)).toBe(false);
    for (const t of ['Laptop', 'PC Escritorio', 'Monitor', 'Pantalla']) expect(isMaintenanceEligible(t)).toBe(true);
    for (const t of ['Celular', 'Mouse', 'Teclado', undefined]) expect(isMaintenanceEligible(t)).toBe(false);
  });

  it('cierra con observaciones si falta un equipo o una licencia', () => {
    expect(resolveFinalStatus([{ physicallyPresent: true }], [{ licensePresent: true }])).toBe('completada');
    expect(resolveFinalStatus([{ physicallyPresent: false }], [])).toBe('con_observaciones');
    expect(resolveFinalStatus([], [{ licensePresent: false }])).toBe('con_observaciones');
  });

  it('resume el mantenimiento para el ticket', () => {
    const checks = Object.fromEntries(MAINTENANCE_CHECKS.map(([c]) => [c, null])) as Record<MaintenanceColumn, boolean | null>;
    checks.maintenance_blower = true;
    checks.maintenance_bitlocker_active = false;
    const text = buildMaintenanceSummary({
      auditCode: 'AUD-000007',
      checks,
      sharedAccounts: 'cuenta@cliente.com',
      notes: null,
      equipment: [{ code: 'LAP-001', label: 'Laptop Dell', present: false, unassigned: true }],
    });
    expect(text).toContain('AUD-000007');
    expect(text).toContain('- [x] Se pasó soplador');
    expect(text).toContain('BitLocker activo — no');
    expect(text).toContain('LAP-001 Laptop Dell (no presente, desasignado)');
    expect(text).toContain('Cuentas compartidas: cuenta@cliente.com');
  });
});

describe('EquipmentAuditController permisos', () => {
  const perm = (method: keyof EquipmentAuditController) =>
    Reflect.getMetadata(PERMISSION_KEY, EquipmentAuditController.prototype[method]) as { action: string } | undefined;

  it('lee con read y escribe con write', () => {
    for (const m of ['stats', 'technicians', 'list', 'get'] as const) expect(perm(m)?.action).toBe('read');
    for (const m of ['create', 'update', 'updateEquipmentItem', 'updateLicenseItem', 'complete'] as const) {
      expect(perm(m)?.action).toBe('write');
    }
  });
});
