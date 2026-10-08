import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import { TicketAssignee } from '../helpdesk/entities/ticket-assignee.entity';
import { AssignEmployeeDto } from './dto/assign-employee.dto';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { QueryEquipmentDto } from './dto/query-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';
import { EquipmentBrand } from './entities/equipment-brand.entity';
import { InventoryStorageService } from './inventory-storage.service';
import { EquipmentHistory } from './entities/equipment-history.entity';
import { EquipmentMaintenance } from './entities/equipment-maintenance.entity';
import { EquipmentStatus } from './entities/equipment-status.entity';
import { EquipmentType } from './entities/equipment-type.entity';
import { Equipment } from './entities/equipment.entity';

/** Ventana de aviso previo al vencimiento de una garantía. */
const WARRANTY_WARNING_DAYS = 30;

export type WarrantyStatus = 'vigente' | 'por_vencer' | 'vencida' | 'sin_garantia';

// ── Mantenimiento: constantes, tipos y cálculo derivado ─────────────────────────

/** Cada cuántos meses toca mantenimiento (política interna). */
export const MAINTENANCE_INTERVAL_MONTHS = 6;

/** Mismo umbral de aviso que la garantía: faltan 30 días o menos → "por vencer". */
export const MAINTENANCE_WARNING_DAYS = 30;

export type MaintenanceStatus = 'sin_mantenimiento' | 'vencido' | 'por_vencer' | 'al_dia';

export interface DerivedMaintenance {
  lastMaintenanceDate: string | null;
  nextMaintenanceDate: string | null;
  maintenanceStatus: MaintenanceStatus;
}

/**
 * Suma meses de calendario topando al último día del mes destino (RN-8).
 *
 * `Date.setMonth()` desborda: 2026-08-31 + 6 daría 2027-03-03 en vez de
 * 2027-02-28. Aquí se calcula el mes destino y se recorta el día al último día
 * real de ese mes. En SQL el `+ interval '6 months'` de Postgres ya hace esto solo.
 */
export function addMonthsClamped(dateStr: string, months: number): string {
  const parts = dateStr.slice(0, 10).split('-').map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const monthIndex = m - 1 + months;
  const targetYear = y + Math.floor(monthIndex / 12);
  const targetMonth = ((monthIndex % 12) + 12) % 12; // 0-based, seguro ante negativos
  // Día 0 del mes siguiente = último día del mes destino.
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const day = Math.min(d, lastDay);
  const mm = String(targetMonth + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${targetYear}-${mm}-${dd}`;
}

/**
 * Estado del semáforo a partir de la fecha del próximo mantenimiento.
 *
 * Se compara a medianoche local, igual que `warrantyStatus()`: un mantenimiento
 * que vence hoy sigue estando "por vencer" hoy, no "vencido" desde el primer
 * minuto del día.
 */
function maintenanceStatusFromNext(next: string, now: Date): MaintenanceStatus {
  const parts = next.slice(0, 10).split('-').map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const target = new Date(y, m - 1, d);
  const today = new Date(now.getTime());
  today.setHours(0, 0, 0, 0);

  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return 'vencido';
  if (days <= MAINTENANCE_WARNING_DAYS) return 'por_vencer';
  return 'al_dia';
}

/**
 * Punto único de las decisiones D2 y D4 (spec §3), a propósito en una sola
 * función para que confirmarlas o cambiarlas con Paulo cueste una línea:
 *
 *  - D2: solo los **Preventivos** cuentan para el reloj de 6 meses; un Correctivo
 *        aparece en la bitácora pero no mueve la fecha del próximo.
 *  - D4: un equipo **sin ningún preventivo** sale como `sin_mantenimiento`, nunca
 *        `vencido` (si no, todo el parque nacería en rojo).
 */
export function deriveMaintenance(
  records: { maintenanceDate: string; maintenanceType: string }[],
  now: Date = new Date(),
): DerivedMaintenance {
  const preventiveDates = records
    .filter((r) => r.maintenanceType === 'Preventivo') // D2
    .map((r) => r.maintenanceDate.slice(0, 10))
    .sort(); // orden lexicográfico == cronológico para 'YYYY-MM-DD'

  if (preventiveDates.length === 0) {
    // D4
    return { lastMaintenanceDate: null, nextMaintenanceDate: null, maintenanceStatus: 'sin_mantenimiento' };
  }

  const last = preventiveDates[preventiveDates.length - 1]!;
  const next = addMonthsClamped(last, MAINTENANCE_INTERVAL_MONTHS);
  return {
    lastMaintenanceDate: last,
    nextMaintenanceDate: next,
    maintenanceStatus: maintenanceStatusFromNext(next, now),
  };
}

/**
 * Las columnas DATE llegan como Date desde pg. Se formatea en local, no con
 * toISOString(), que convierte a UTC y en México corre la fecha un día atrás.
 */
function toDateString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

// ── Información financiera: depreciación derivada ────────────────────────────

/** Vida contable del equipo de cómputo: se deprecia en línea recta en 36 meses. */
export const DEPRECIATION_MONTHS = 36;

export interface FinancialInfo {
  providerId: string | null;
  providerName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  purchaseValue: number | null;
  depreciationEndDate: string | null;
  monthlyDepreciation: number | null;
  currentValue: number | null;
  depreciationPercentage: number;
  isFullyDepreciated: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Meses de calendario completos entre `fromDate` y hoy (0 si es futura).
 * Un mes cuenta cuando se alcanza el mismo día del mes siguiente: del 15-ene al
 * 14-feb van 0 meses, al 15-feb va 1. Fin de mes usa el mismo tope que
 * addMonthsClamped: 31-ene → 28-feb ya es 1 mes.
 */
export function fullMonthsElapsed(fromDate: string, now: Date): number {
  const [fy = 0, fm = 1, fd = 1] = fromDate.slice(0, 10).split('-').map(Number);
  const ny = now.getFullYear();
  const nm = now.getMonth() + 1;
  const nd = now.getDate();
  let months = (ny - fy) * 12 + (nm - fm);
  const lastDayThisMonth = new Date(ny, nm, 0).getDate();
  if (nd < Math.min(fd, lastDayThisMonth)) months -= 1;
  return Math.max(0, months);
}

/**
 * Depreciación en línea recta a 36 meses desde la fecha de factura (no la de
 * compra: es la que respalda contablemente el activo). Sin fecha de factura no
 * hay reloj, así que todo lo derivado sale null/0; sin valor, sí se calculan
 * las fechas y el avance pero no los montos.
 */
export function deriveFinancialInfo(
  e: {
    financialProviderId: string | null;
    invoiceNumber: string | null;
    invoiceDate: string | null;
    purchaseValue: number | string | null;
  },
  providerName: string | null,
  now: Date = new Date(),
): FinancialInfo {
  const invoiceDate = e.invoiceDate ? toDateString(e.invoiceDate) : null;
  const rawValue = e.purchaseValue === null || e.purchaseValue === undefined ? null : Number(e.purchaseValue);
  const purchaseValue = rawValue !== null && Number.isFinite(rawValue) ? rawValue : null;

  const base = {
    providerId: e.financialProviderId,
    providerName: e.financialProviderId ? providerName : null,
    invoiceNumber: e.invoiceNumber,
    invoiceDate,
    purchaseValue,
  };

  if (!invoiceDate) {
    return {
      ...base,
      depreciationEndDate: null,
      monthlyDepreciation: purchaseValue !== null ? round2(purchaseValue / DEPRECIATION_MONTHS) : null,
      currentValue: null,
      depreciationPercentage: 0,
      isFullyDepreciated: false,
    };
  }

  const months = Math.min(fullMonthsElapsed(invoiceDate, now), DEPRECIATION_MONTHS);
  const isFullyDepreciated = months >= DEPRECIATION_MONTHS;
  const monthly = purchaseValue !== null ? purchaseValue / DEPRECIATION_MONTHS : null;

  return {
    ...base,
    depreciationEndDate: addMonthsClamped(invoiceDate, DEPRECIATION_MONTHS),
    monthlyDepreciation: monthly !== null ? round2(monthly) : null,
    // Se calcula con la mensualidad sin redondear: con la redondeada, 36 pagos
    // de $416.67 sobre $15,000 dejarían un residuo de centavos.
    currentValue:
      monthly !== null && purchaseValue !== null
        ? isFullyDepreciated
          ? 0
          : Math.max(0, round2(purchaseValue - monthly * months))
        : null,
    depreciationPercentage: round2((months / DEPRECIATION_MONTHS) * 100),
    isFullyDepreciated,
  };
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Equipment) private readonly equipmentRepo: Repository<Equipment>,
    @InjectRepository(EquipmentHistory) private readonly historyRepo: Repository<EquipmentHistory>,
    @InjectRepository(EquipmentType) private readonly typesRepo: Repository<EquipmentType>,
    @InjectRepository(EquipmentBrand) private readonly brandsRepo: Repository<EquipmentBrand>,
    private readonly storage: InventoryStorageService,
    @InjectRepository(EquipmentStatus) private readonly statusesRepo: Repository<EquipmentStatus>,
    @InjectRepository(EmployeeRecord) private readonly employeesRepo: Repository<EmployeeRecord>,
    @InjectRepository(EquipmentMaintenance)
    private readonly maintenanceRepo: Repository<EquipmentMaintenance>,
    @InjectRepository(TicketAssignee)
    private readonly ticketAssigneesRepo: Repository<TicketAssignee>,
  ) {}

  /**
   * Clave temporal del cursor de paginación, truncada a milisegundos.
   *
   * created_at es timestamptz (microsegundos) pero el cursor se serializa con
   * Date.toISOString(), que solo llega al milisegundo. Comparar el valor crudo
   * contra ese cursor truncado deja filas fuera de las dos ramas del predicado
   * (`.207456` no es `< .207` ni `= .207`), volviéndolas inalcanzables; y si
   * todas las filas comparten el timestamp —una carga masiva en una sola
   * transacción, donde now() es constante— la página siguiente sale vacía.
   *
   * Truncando aquí, la clave de orden tiene exactamente la misma precisión que
   * el cursor y el desempate por id vuelve a ser efectivo.
   */
  private static readonly CURSOR_MS_EXPR = "date_trunc('milliseconds', e.created_at)";

  // -------------------------------------------------------------------------
  // Catálogos
  // -------------------------------------------------------------------------

  findTypes() {
    return this.typesRepo.find({ where: { isActive: true }, order: { sortOrder: 'ASC' } });
  }

  findBrands() {
    return this.brandsRepo.find({ where: { isActive: true }, order: { sortOrder: 'ASC' } });
  }

  findStatuses() {
    return this.statusesRepo.find({ where: { isActive: true }, order: { sortOrder: 'ASC' } });
  }

  // -------------------------------------------------------------------------
  // Lista paginada con filtros
  // -------------------------------------------------------------------------

  async findAll(query: QueryEquipmentDto) {
    const limit = query.limit ?? 20;
    const qb = this.equipmentRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.assignedEmployee', 'emp')
      .where('e.deleted_at IS NULL')
      // Se ordena por created_at truncado a milisegundos, no por el valor
      // crudo: el cursor viaja como Date de JS y toISOString() solo conserva
      // milisegundos, mientras la columna timestamptz guarda microsegundos. Si
      // la clave de orden tiene más precisión que el cursor, el desempate por
      // id queda inservible y filas enteras se vuelven inalcanzables (ver
      // CURSOR_MS_EXPR).
      .orderBy(InventoryService.CURSOR_MS_EXPR, 'DESC')
      .addOrderBy('e.id', 'DESC');

    if (query.equipmentType) qb.andWhere('e.equipment_type = :et', { et: query.equipmentType });
    if (query.brand) qb.andWhere('e.brand = :brand', { brand: query.brand });
    if (query.status) qb.andWhere('e.status = :status', { status: query.status });
    if (query.location) qb.andWhere('e.location = :location', { location: query.location });
    if (query.area) qb.andWhere('e.area = :area', { area: query.area });
    if (query.assignedToEmployeeId) {
      qb.andWhere('e.assigned_to_employee_id = :empId', { empId: query.assignedToEmployeeId });
    }
    if (query.search) {
      // Todas las condiciones van dentro del mismo grupo OR entre paréntesis
      // (no como .orWhere() sueltos, que romperían los demás filtros AND).
      qb.andWhere(
        '(e.display_id ILIKE :s OR e.legacy_id ILIKE :s OR e.model ILIKE :s OR e.serial_number ILIKE :s OR e.brand ILIKE :s OR emp.fullName ILIKE :s OR emp.corporateEmail ILIKE :s)',
        { s: `%${query.search}%` },
      );
    }
    // El conteo se toma antes de aplicar el cursor: es el total de la consulta
    // filtrada, no el tamaño de la página. Antes se devolvía data.length, así
    // que el pie de tabla siempre mostraba "20 de 20+".
    const total = await qb.clone().getCount();

    if (query.cursor) {
      const [cursorDate = '', cursorId = ''] = Buffer.from(query.cursor, 'base64url').toString().split('|');
      // Misma expresión que el ORDER BY, así el desempate por id sí aplica a
      // las filas que caen en el mismo milisegundo que el cursor.
      qb.andWhere(
        `(${InventoryService.CURSOR_MS_EXPR} < :cd OR (${InventoryService.CURSOR_MS_EXPR} = :cd AND e.id < :ci))`,
        { cd: cursorDate, ci: cursorId },
      );
    }

    const items = await qb.limit(limit + 1).getMany();
    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;

    const last = data.at(-1);
    const nextCursor =
      hasMore && last
        ? Buffer.from(`${last.createdAt.toISOString()}|${last.id}`).toString('base64url')
        : null;

    // El listado lleva el estado de garantía —es un cálculo en memoria— pero no
    // la URL firmada de la factura: firmar una por fila serían 20 llamadas a S3
    // por página para un dato que solo se usa en el detalle.
    // El semáforo de mantenimiento se calcula para toda la página en una sola
    // consulta (el último preventivo por equipo), no una por fila.
    const [maintByEquipment, financialProviders] = await Promise.all([
      this.deriveMaintenanceForEquipmentIds(data.map((d) => d.id)),
      this.vendorNames(data.map((d) => d.financialProviderId)),
    ]);

    const enriched = data.map((item) => {
      const maint =
        maintByEquipment.get(item.id) ??
        ({ lastMaintenanceDate: null, nextMaintenanceDate: null, maintenanceStatus: 'sin_mantenimiento' } as DerivedMaintenance);
      return {
        ...item,
        assignedEmployeeName: item.assignedEmployee?.fullName ?? null,
        assignedEmployeeEmail: item.assignedEmployee?.corporateEmail ?? null,
        assignedEmployeePosition: item.assignedEmployee?.position ?? null,
        warrantyStatus: this.warrantyStatus(item.warrantyExpiryDate),
        maintenanceStatus: maint.maintenanceStatus,
        nextMaintenanceDate: maint.nextMaintenanceDate,
        financialInfo: deriveFinancialInfo(
          item,
          item.financialProviderId ? (financialProviders.get(item.financialProviderId) ?? null) : null,
        ),
      };
    });

    return { data: enriched, nextCursor, total };
  }

  // -------------------------------------------------------------------------
  // Reporte agrupado por área / empleado
  // -------------------------------------------------------------------------

  async getReportByArea() {
    const items = await this.equipmentRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.assignedEmployee', 'emp')
      .where('e.deleted_at IS NULL')
      .andWhere('e.status != :baja', { baja: 'Baja' })
      .andWhere('e.assigned_to_employee_id IS NOT NULL')
      .orderBy('emp.area', 'ASC', 'NULLS LAST')
      .addOrderBy('emp.full_name', 'ASC')
      .addOrderBy('e.equipment_type', 'ASC')
      .getMany();

    const areaMap = new Map<string, Map<string, {
      employeeId: string;
      fullName: string;
      area: string;
      division: string;
      location: string;
      equipment: {
        displayId: string;
        legacyId: string | null;
        equipmentType: string;
        brand: string | null;
        model: string | null;
        serialNumber: string | null;
        status: string;
        chargerIncluded: boolean;
      }[];
    }>>();

    for (const item of items) {
      const emp = item.assignedEmployee;
      if (!emp) continue;
      const areaKey = emp.area ?? 'SIN ÁREA';

      if (!areaMap.has(areaKey)) areaMap.set(areaKey, new Map());
      const empMap = areaMap.get(areaKey)!;

      if (!empMap.has(emp.id)) {
        empMap.set(emp.id, {
          employeeId: emp.id,
          fullName: emp.fullName,
          area: emp.area ?? '',
          division: emp.division ?? '',
          location: emp.location ?? '',
          equipment: [],
        });
      }

      empMap.get(emp.id)!.equipment.push({
        displayId: item.displayId,
        legacyId: item.legacyId,
        equipmentType: item.equipmentType,
        brand: item.brand,
        model: item.model,
        serialNumber: item.serialNumber,
        status: item.status,
        chargerIncluded: item.chargerIncluded,
      });
    }

    const areas = Array.from(areaMap.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'es'))
      .map(([area, empMap]) => ({ area, employees: Array.from(empMap.values()) }));

    return { areas };
  }

  // -------------------------------------------------------------------------
  // Detalle por id
  // -------------------------------------------------------------------------

  /**
   * Estado de la garantía a partir de su vencimiento.
   *
   * La fecha se compara a medianoche local: una garantía que vence hoy sigue
   * siendo reclamable hoy, y con new Date() a secas caería en 'vencida' desde
   * el primer minuto del día.
   */
  private warrantyStatus(expiry: string | null): WarrantyStatus {
    if (!expiry) return 'sin_garantia';

    const [y, m, d] = expiry.slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return 'sin_garantia';

    const target = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
    if (days < 0) return 'vencida';
    if (days <= WARRANTY_WARNING_DAYS) return 'por_vencer';
    return 'vigente';
  }

  /**
   * Añade a un equipo los datos derivados de garantía: nombre del proveedor,
   * URL firmada de la factura y estado calculado.
   */
  /** Nombre del proveedor, o null si no hay id o ya no existe en el padrón. */
  private async vendorName(id: string | null): Promise<string | null> {
    if (!id) return null;
    const rows = await this.equipmentRepo.query(
      `SELECT name FROM vendors.vendors WHERE id = $1`,
      [id],
    );
    return (rows as { name: string }[])[0]?.name ?? null;
  }

  /** Nombres de varios proveedores en una sola consulta (para el listado). */
  private async vendorNames(ids: (string | null)[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is string => !!id))];
    if (unique.length === 0) return new Map();
    const rows = (await this.equipmentRepo.query(
      `SELECT id, name FROM vendors.vendors WHERE id = ANY($1::uuid[])`,
      [unique],
    )) as { id: string; name: string }[];
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  /** Añade `financialInfo` (proveedor resuelto + depreciación al día de hoy). */
  private async withFinancialInfo<T extends Equipment>(item: T) {
    const providerName = await this.vendorName(item.financialProviderId);
    return { ...item, financialInfo: deriveFinancialInfo(item, providerName) };
  }

  /**
   * Incluye también `financialInfo`: la pantalla de detalle reemplaza su estado
   * con lo que devuelven update y la subida de factura, y sin él la tarjeta
   * financiera se vaciaba tras guardar.
   */
  private async withWarranty<T extends Equipment>(item: T) {
    const [providerName, invoiceUrl, withFinancial] = await Promise.all([
      this.vendorName(item.warrantyProviderId),
      item.warrantyInvoiceS3Key
        ? this.storage.getPresignedUrl(item.warrantyInvoiceS3Key)
        : Promise.resolve(null),
      this.withFinancialInfo(item),
    ]);

    return {
      ...withFinancial,
      warrantyProviderName: providerName,
      warrantyInvoiceUrl: invoiceUrl,
      warrantyStatus: this.warrantyStatus(item.warrantyExpiryDate),
    };
  }

  async findById(id: string) {
    const item = await this.equipmentRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Equipo ${id} no encontrado`);

    const [history, employee, enriched, maintByEquipment] = await Promise.all([
      this.historyRepo.find({ where: { equipmentId: id }, order: { createdAt: 'ASC' } }),
      item.assignedToEmployeeId
        ? this.employeesRepo.findOne({ where: { id: item.assignedToEmployeeId } })
        : Promise.resolve(null),
      this.withWarranty(item),
      this.deriveMaintenanceForEquipmentIds([id]),
    ]);

    const maint =
      maintByEquipment.get(id) ??
      ({ lastMaintenanceDate: null, nextMaintenanceDate: null, maintenanceStatus: 'sin_mantenimiento' } as DerivedMaintenance);

    return { ...enriched, history, assignedEmployee: employee, ...maint };
  }

  /**
   * Equipos cuya garantía vence en los próximos 30 días. No incluye las ya
   * vencidas: el reporte es para actuar a tiempo, y mezclarlas escondería lo
   * que todavía se puede renovar.
   */
  async getWarrantyExpiring() {
    const rows = await this.equipmentRepo.query(
      `
      SELECT e.id,
             e.display_id,
             e.legacy_id,
             e.brand,
             e.model,
             e.equipment_type,
             e.warranty_expiry_date,
             (e.warranty_expiry_date - CURRENT_DATE)::int AS days_until_expiry,
             emp.full_name AS assigned_to,
             v.name AS provider_name
      FROM inventory.equipment e
      LEFT JOIN employees.employee_records emp ON emp.id = e.assigned_to_employee_id
      LEFT JOIN vendors.vendors v ON v.id = e.warranty_provider_id
      WHERE e.deleted_at IS NULL
        AND e.warranty_expiry_date IS NOT NULL
        AND e.warranty_expiry_date >= CURRENT_DATE
        AND e.warranty_expiry_date <= CURRENT_DATE + $1::int
      ORDER BY e.warranty_expiry_date ASC
      `,
      [WARRANTY_WARNING_DAYS],
    );

    return rows.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      displayId: r.display_id as string,
      legacyId: (r.legacy_id as string) ?? null,
      brand: (r.brand as string) ?? null,
      model: (r.model as string) ?? null,
      equipmentType: r.equipment_type as string,
      assignedTo: (r.assigned_to as string) ?? null,
      warrantyProviderName: (r.provider_name as string) ?? null,
      warrantyExpiryDate: toDateString(r.warranty_expiry_date),
      daysUntilExpiry: r.days_until_expiry as number,
    }));
  }

  /** Guarda la factura subida y devuelve el equipo ya enriquecido. */
  async saveWarrantyInvoice(id: string, file: Express.Multer.File) {
    const item = await this.equipmentRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Equipo ${id} no encontrado`);

    const key = await this.storage.uploadWarrantyInvoice(file, id);
    item.warrantyInvoiceS3Key = key;
    item.warrantyInvoiceOriginalName = file.originalname;
    await this.equipmentRepo.save(item);

    return this.withWarranty(item);
  }

  // -------------------------------------------------------------------------
  // Crear equipo
  // -------------------------------------------------------------------------

  /**
   * Resuelve el nombre de marca contra el catálogo, dándola de alta si es nueva.
   *
   * `equipment.brand` es texto libre, no una FK, así que el catálogo era una
   * sugerencia: hoy conviven 'Generico'/'GENERICO' y 'Sony'/'SONY', y 23 marcas
   * en uso que nunca llegaron al catálogo. La comparación es case-insensitive y
   * devuelve SIEMPRE el nombre tal como está guardado en el catálogo, de modo
   * que capturar 'generico' reutiliza la fila existente en vez de crear otra
   * variante.
   */
  private async resolveBrand(raw: string | null | undefined): Promise<string | null> {
    const name = raw?.trim();
    if (!name) return null;

    const existing = await this.brandsRepo
      .createQueryBuilder('b')
      .where('LOWER(b.name) = LOWER(:name)', { name })
      .getOne();
    if (existing) return existing.name;

    const [{ max }] = await this.brandsRepo.query(
      `SELECT COALESCE(MAX(sort_order), 0) AS max FROM inventory.equipment_brands`,
    );
    const created = await this.brandsRepo.save(
      this.brandsRepo.create({ name, isActive: true, sortOrder: Number(max) + 1 }),
    );
    return created.name;
  }

  /**
   * Marcas que se parecen a lo tecleado. Alimenta el "¿Quisiste decir…?" del
   * formulario, para no sembrar variantes de una marca que ya existe.
   */
  async searchBrands(search?: string) {
    const term = search?.trim();
    if (!term) return this.findBrands();
    return this.brandsRepo
      .createQueryBuilder('b')
      .where('b.is_active = true')
      .andWhere('b.name ILIKE :term', { term: `%${term}%` })
      .orderBy('b.sort_order', 'ASC')
      .limit(8)
      .getMany();
  }

  async create(dto: CreateEquipmentDto, userId: string, userName: string) {
    const displayId = await this.generateDisplayId(dto.purchaseDate);
    const brand = await this.resolveBrand(dto.brand);

    const equipment = this.equipmentRepo.create({
      displayId,
      legacyId: dto.legacyId ?? null,
      equipmentType: dto.equipmentType,
      brand,
      model: dto.model ?? null,
      serialNumber: dto.serialNumber ?? null,
      operatingSystem: dto.operatingSystem ?? null,
      adName: dto.adName ?? null,
      specifications: dto.specifications ?? null,
      assignedToEmployeeId: dto.assignedToEmployeeId ?? null,
      assignmentDate: dto.assignmentDate ?? null,
      responsiva: dto.responsiva ?? null,
      chargerIncluded: dto.chargerIncluded ?? false,
      status: dto.status ?? (dto.assignedToEmployeeId ? 'Asignado' : 'Disponible'),
      location: dto.location ?? null,
      area: dto.area ?? null,
      warrantyProviderId: dto.warrantyProviderId ?? null,
      warrantyExpiryDate: dto.warrantyExpiryDate ?? null,
      warrantyPurchaseOrder: dto.warrantyPurchaseOrder ?? null,
      warrantyNotes: dto.warrantyNotes ?? null,
      purchaseDate: dto.purchaseDate ?? null,
      purchaseValue: dto.purchaseValue ?? null,
      financialProviderId: dto.financialProviderId ?? null,
      invoiceNumber: dto.invoiceNumber ?? null,
      invoiceDate: dto.invoiceDate ?? null,
      notes: dto.notes ?? null,
    });

    const saved = await this.equipmentRepo.save(equipment);

    await this.historyRepo.save(
      this.historyRepo.create({
        equipmentId: saved.id,
        changedById: userId,
        changedByName: userName,
        action: 'CREADO',
        notes: `Equipo registrado con ID ${displayId}`,
      }),
    );

    return saved;
  }

  // -------------------------------------------------------------------------
  // Actualizar equipo
  // -------------------------------------------------------------------------

  async update(id: string, dto: UpdateEquipmentDto, userId: string, userName: string) {
    // Se resuelve antes del trackField para que la bitácora registre el nombre
    // normalizado que realmente queda guardado, no lo que se tecleó.
    const resolvedBrand =
      dto.brand !== undefined ? await this.resolveBrand(dto.brand) : undefined;
    const item = await this.equipmentRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Equipo ${id} no encontrado`);

    const changes: Array<{ field: string; old: string; new: string }> = [];
    const trackField = (field: string, oldVal: unknown, newVal: unknown) => {
      if (newVal !== undefined && String(oldVal ?? '') !== String(newVal ?? '')) {
        changes.push({ field, old: String(oldVal ?? ''), new: String(newVal ?? '') });
      }
    };

    trackField('equipmentType', item.equipmentType, dto.equipmentType);
    trackField('brand', item.brand, resolvedBrand);
    trackField('model', item.model, dto.model);
    trackField('serialNumber', item.serialNumber, dto.serialNumber);
    trackField('operatingSystem', item.operatingSystem, dto.operatingSystem);
    trackField('adName', item.adName, dto.adName);
    trackField('status', item.status, dto.status);
    trackField('location', item.location, dto.location);
    trackField('area', item.area, dto.area);
    // Se compara numéricamente: pg devuelve '15000.00' y el DTO 15000, y como
    // texto eso registraba un cambio en cada guardado aunque nadie tocara el valor.
    if (dto.purchaseValue !== undefined) {
      const oldVal = item.purchaseValue === null ? null : Number(item.purchaseValue);
      if (oldVal !== dto.purchaseValue) trackField('purchaseValue', oldVal, dto.purchaseValue ?? '');
    }
    trackField('notes', item.notes, dto.notes);
    trackField('specifications', item.specifications, dto.specifications);

    // Garantía. El proveedor se audita por nombre y no por UUID: una bitácora
    // que dice "2e5955ee-…  →  9f1c33ab-…" no le sirve a nadie. Solo se
    // resuelven los nombres si el proveedor efectivamente cambió.
    if (dto.warrantyProviderId !== undefined && dto.warrantyProviderId !== item.warrantyProviderId) {
      const [oldName, newName] = await Promise.all([
        this.vendorName(item.warrantyProviderId),
        this.vendorName(dto.warrantyProviderId ?? null),
      ]);
      trackField('warrantyProviderId', oldName, newName ?? '');
    }
    trackField('warrantyExpiryDate', item.warrantyExpiryDate, dto.warrantyExpiryDate);

    // Información financiera: mismo criterio que garantía, proveedor por nombre.
    if (dto.financialProviderId !== undefined && dto.financialProviderId !== item.financialProviderId) {
      const [oldName, newName] = await Promise.all([
        this.vendorName(item.financialProviderId),
        this.vendorName(dto.financialProviderId ?? null),
      ]);
      trackField('financialProviderId', oldName, newName ?? '');
    }
    trackField('invoiceNumber', item.invoiceNumber, dto.invoiceNumber === null ? '' : dto.invoiceNumber);
    trackField('invoiceDate', item.invoiceDate, dto.invoiceDate === null ? '' : dto.invoiceDate);
    trackField('warrantyPurchaseOrder', item.warrantyPurchaseOrder, dto.warrantyPurchaseOrder);
    trackField('warrantyNotes', item.warrantyNotes, dto.warrantyNotes);

    Object.assign(item, {
      ...(dto.equipmentType !== undefined && { equipmentType: dto.equipmentType }),
      ...(dto.legacyId !== undefined && { legacyId: dto.legacyId }),
      ...(dto.brand !== undefined && { brand: resolvedBrand ?? null }),
      ...(dto.model !== undefined && { model: dto.model }),
      ...(dto.serialNumber !== undefined && { serialNumber: dto.serialNumber }),
      ...(dto.operatingSystem !== undefined && { operatingSystem: dto.operatingSystem }),
      ...(dto.adName !== undefined && { adName: dto.adName }),
      ...(dto.specifications !== undefined && { specifications: dto.specifications }),
      ...(dto.responsiva !== undefined && { responsiva: dto.responsiva }),
      ...(dto.chargerIncluded !== undefined && { chargerIncluded: dto.chargerIncluded }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.warrantyProviderId !== undefined && {
        warrantyProviderId: dto.warrantyProviderId ?? null,
      }),
      ...(dto.warrantyExpiryDate !== undefined && {
        warrantyExpiryDate: dto.warrantyExpiryDate ?? null,
      }),
      ...(dto.warrantyPurchaseOrder !== undefined && {
        warrantyPurchaseOrder: dto.warrantyPurchaseOrder ?? null,
      }),
      ...(dto.warrantyNotes !== undefined && { warrantyNotes: dto.warrantyNotes ?? null }),
      ...(dto.location !== undefined && { location: dto.location }),
      ...(dto.area !== undefined && { area: dto.area }),
      ...(dto.purchaseDate !== undefined && { purchaseDate: dto.purchaseDate }),
      ...(dto.purchaseValue !== undefined && { purchaseValue: dto.purchaseValue ?? null }),
      ...(dto.financialProviderId !== undefined && {
        financialProviderId: dto.financialProviderId ?? null,
      }),
      ...(dto.invoiceNumber !== undefined && { invoiceNumber: dto.invoiceNumber ?? null }),
      ...(dto.invoiceDate !== undefined && { invoiceDate: dto.invoiceDate ?? null }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
    });

    const saved = await this.equipmentRepo.save(item);

    if (changes.length > 0) {
      await Promise.all(
        changes.map((c) =>
          this.historyRepo.save(
            this.historyRepo.create({
              equipmentId: id,
              changedById: userId,
              changedByName: userName,
              action: 'EDITADO',
              fieldChanged: c.field,
              oldValue: c.old,
              newValue: c.new,
            }),
          ),
        ),
      );
    }

    // Enriquecido, no la entidad cruda: la pantalla reemplaza su estado con
    // esta respuesta, y sin proveedor resuelto ni URL firmada la tarjeta de
    // garantía se quedaba mostrando los valores anteriores.
    return this.withWarranty(saved);
  }

  // -------------------------------------------------------------------------
  // Asignar empleado
  // -------------------------------------------------------------------------

  /**
   * Tickets de soporte asociados al equipo.
   *
   * El vínculo es por texto, no por FK: helpdesk.tickets.equipment_id es un
   * varchar donde la gente escribe el ID de la etiqueta del equipo, que es el
   * legacy_id (M080, AD053…), no el display_id (TEC-2019-003). Se buscan los
   * dos por si alguien captura el nuevo.
   *
   * Los tickets no tienen columna de título: se arma con la subcategoría —o la
   * categoría si no hay— que es lo que describe el asunto en una línea.
   */
  async getEquipmentTickets(equipmentId: string) {
    const item = await this.equipmentRepo.findOne({ where: { id: equipmentId } });
    if (!item) throw new NotFoundException(`Equipo ${equipmentId} no encontrado`);

    // Claves normalizadas: la captura del ticket viene con espacios al inicio
    // (' AD043') y en cualquier caja, así que se compara en minúsculas y sin
    // bordes en los dos lados.
    const keys = [item.legacyId, item.displayId]
      .filter((v): v is string => Boolean(v))
      .map((v) => v.trim().toLowerCase());
    if (keys.length === 0) return { legacyId: null, displayId: item.displayId, tickets: [] };

    const rows = await this.equipmentRepo.query(
      `
      SELECT t.id,
             t.display_id AS ticket_code,
             t.category,
             t.subcategory,
             t.priority,
             t.status,
             t.description,
             t.requested_at,
             t.resolved_at,
             t.requester_name,
             t.requester_area,
             a.name AS assignee_name
      FROM helpdesk.tickets t
      LEFT JOIN helpdesk.ticket_assignees a ON a.id = t.assignee_id
      WHERE t.deleted_at IS NULL
        AND (
          btrim(lower(t.equipment_id)) = ANY($1::text[])
          -- Captura libre del tipo 'Pantalla Sharp — TEC-2025-102': se extrae
          -- el folio embebido. substring() devuelve la primera coincidencia o
          -- NULL; regexp_matches() no sirve aquí porque retorna un conjunto.
          OR substring(upper(t.equipment_id) from 'TEC-[0-9]{4}-[0-9]+') = $2
        )
      ORDER BY t.requested_at DESC
      `,
      [keys, item.displayId.toUpperCase()],
    );

    return {
      legacyId: item.legacyId,
      displayId: item.displayId,
      tickets: rows.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        ticketCode: r.ticket_code as string,
        title: (r.subcategory as string) ?? (r.category as string),
        description: r.description as string,
        category: r.category as string,
        subcategory: (r.subcategory as string) ?? null,
        priority: (r.priority as string) ?? null,
        status: r.status as string,
        createdAt: r.requested_at as Date,
        resolvedAt: (r.resolved_at as Date) ?? null,
        requester: {
          fullName: r.requester_name as string,
          area: (r.requester_area as string) ?? null,
        },
        assignee: r.assignee_name ? { fullName: r.assignee_name as string } : null,
      })),
    };
  }

  async getEquipmentByEmployee(employeeId: string) {
    const items = await this.equipmentRepo.find({
      where: { assignedToEmployeeId: employeeId, deletedAt: IsNull() },
      order: { equipmentType: 'ASC', brand: 'ASC' },
    });

    return items.map((item) => ({
      id: item.id,
      displayId: item.displayId,
      legacyId: item.legacyId,
      equipmentType: item.equipmentType,
      brand: item.brand,
      model: item.model,
      status: item.status,
    }));
  }

  async getEmployeeEquipmentFor(equipmentId: string) {
    const item = await this.equipmentRepo.findOne({ where: { id: equipmentId } });
    if (!item) throw new NotFoundException(`Equipo ${equipmentId} no encontrado`);
    if (!item.assignedToEmployeeId) return [];

    return this.getOtherEquipmentByEmployee(item.assignedToEmployeeId, equipmentId);
  }

  async getOtherEquipmentByEmployee(employeeId: string, currentEquipmentId: string) {
    const items = await this.getEquipmentByEmployee(employeeId);
    return items.filter((item) => item.id !== currentEquipmentId);
  }

  async assignEmployee(id: string, dto: AssignEmployeeDto, userId: string, userName: string) {
    const item = await this.equipmentRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Equipo ${id} no encontrado`);

    const employee = await this.employeesRepo.findOne({ where: { id: dto.employeeId } });
    if (!employee) throw new NotFoundException(`Empleado ${dto.employeeId} no encontrado`);

    const prevEmployeeId = item.assignedToEmployeeId;

    item.assignedToEmployeeId = dto.employeeId;
    item.assignmentDate = dto.assignmentDate ?? new Date().toISOString().split('T')[0] ?? null;
    item.responsiva = dto.responsiva ?? item.responsiva;
    item.status = 'Asignado';
    if (employee.area) item.area = employee.area;
    if (employee.location) item.location = employee.location;

    await this.equipmentRepo.save(item);

    await this.historyRepo.save(
      this.historyRepo.create({
        equipmentId: id,
        changedById: userId,
        changedByName: userName,
        action: 'ASIGNADO',
        fieldChanged: 'assignedToEmployeeId',
        oldValue: prevEmployeeId ?? null,
        newValue: dto.employeeId,
        notes: dto.notes ?? `Asignado a ${employee.fullName}`,
      }),
    );

    return this.findById(id);
  }

  // -------------------------------------------------------------------------
  // Desasignar empleado
  // -------------------------------------------------------------------------

  async unassignEmployee(id: string, userId: string, userName: string, notes?: string) {
    const item = await this.equipmentRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Equipo ${id} no encontrado`);

    const prevEmployeeId = item.assignedToEmployeeId;
    item.assignedToEmployeeId = null;
    item.assignmentDate = null;
    item.responsiva = null;
    item.status = 'Disponible';

    await this.equipmentRepo.save(item);

    await this.historyRepo.save(
      this.historyRepo.create({
        equipmentId: id,
        changedById: userId,
        changedByName: userName,
        action: 'DESASIGNADO',
        fieldChanged: 'assignedToEmployeeId',
        oldValue: prevEmployeeId ?? null,
        newValue: null,
        notes: notes ?? 'Equipo desasignado',
      }),
    );

    return this.findById(id);
  }

  // -------------------------------------------------------------------------
  // Stats / KPIs
  // -------------------------------------------------------------------------

  async getStats() {
    const [byType, byStatus, total, assigned] = await Promise.all([
      this.equipmentRepo
        .createQueryBuilder('e')
        .select('"e"."equipment_type"', 'type')
        .addSelect('COUNT(*)', 'count')
        .where('e.deleted_at IS NULL')
        .groupBy('"e"."equipment_type"')
        .orderBy('count', 'DESC')
        .getRawMany<{ type: string; count: string }>(),

      this.equipmentRepo
        .createQueryBuilder('e')
        .select('"e"."status"', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('e.deleted_at IS NULL')
        .groupBy('"e"."status"')
        .orderBy('count', 'DESC')
        .getRawMany<{ status: string; count: string }>(),

      this.equipmentRepo.count({ where: { deletedAt: IsNull() } }),
      this.equipmentRepo.count({ where: { status: 'Asignado', deletedAt: IsNull() } }),
    ]);

    return {
      total,
      assigned,
      available: total - assigned,
      assignedPercent: total > 0 ? Math.round((assigned / total) * 100) : 0,
      byType: byType.map((r) => ({ type: r.type, count: parseInt(r.count, 10) })),
      byStatus: byStatus.map((r) => ({ status: r.status, count: parseInt(r.count, 10) })),
    };
  }

  // -------------------------------------------------------------------------
  // Equipos del usuario autenticado
  // -------------------------------------------------------------------------

  /**
   * Búsqueda de equipos para el selector del formulario de ticket.
   *
   * Sin permiso de inventario: cualquier colaborador necesita poder encontrar
   * su propio equipo al levantar un ticket. Por eso también se limita a 10
   * resultados y no expone costo, responsiva ni asignado.
   */
  async searchEquipment(q?: string, assignedToEmployeeId?: string) {
    const qb = this.equipmentRepo
      .createQueryBuilder('e')
      .where('e.deleted_at IS NULL')
      .orderBy('e.display_id', 'DESC')
      .limit(10);

    if (assignedToEmployeeId) {
      qb.andWhere('e.assigned_to_employee_id = :emp', { emp: assignedToEmployeeId });
    }

    const term = q?.trim();
    if (term) {
      qb.andWhere(
        '(e.legacy_id ILIKE :s OR e.display_id ILIKE :s OR e.brand ILIKE :s OR e.model ILIKE :s)',
        { s: `%${term}%` },
      );
    }

    const items = await qb.getMany();
    return items.map((e) => ({
      id: e.id,
      displayId: e.displayId,
      legacyId: e.legacyId,
      brand: e.brand,
      model: e.model,
      type: e.equipmentType,
    }));
  }

  /** Id de expediente del usuario en sesión; null si no tiene. */
  async findEmployeeIdByEmail(email: string): Promise<string | null> {
    const employee = await this.employeesRepo.findOne({ where: { corporateEmail: email } });
    return employee?.id ?? null;
  }

  async getMyEquipment(userEmail: string) {
    const employee = await this.employeesRepo.findOne({
      where: { corporateEmail: userEmail },
    });
    if (!employee) return [];

    const items = await this.equipmentRepo.find({
      where: { assignedToEmployeeId: employee.id, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });

    return items.map((e) => ({
      id: e.id,
      displayId: e.displayId,
      legacyId: e.legacyId,
      equipmentType: e.equipmentType,
      brand: e.brand,
      model: e.model,
      status: e.status,
    }));
  }

  // -------------------------------------------------------------------------
  // generateDisplayId: TEC-YYYY-NNN
  // -------------------------------------------------------------------------

  async generateDisplayId(purchaseDate?: string): Promise<string> {
    const year = purchaseDate ? new Date(purchaseDate).getFullYear() : new Date().getFullYear();
    const result = await this.equipmentRepo.query(
      `SELECT nextval('inventory.equipment_display_id_seq') AS next_id`,
    );
    const nextId = parseInt(result[0].next_id, 10);
    return `TEC-${year}-${String(nextId).padStart(3, '0')}`;
  }

  // -------------------------------------------------------------------------
  // Mantenimientos
  // -------------------------------------------------------------------------

  /** Existencia del equipo o 404, para no registrar mantenimientos huérfanos. */
  private async ensureEquipment(equipmentId: string): Promise<Equipment> {
    const item = await this.equipmentRepo.findOne({ where: { id: equipmentId } });
    if (!item) throw new NotFoundException(`Equipo ${equipmentId} no encontrado`);
    return item;
  }

  /**
   * El técnico debe existir y estar activo al registrar (RN-4). Uno inactivo
   * puede seguir apareciendo en registros viejos, pero no elegirse en uno nuevo.
   */
  private async assertActiveTechnician(technicianId: string): Promise<TicketAssignee> {
    const tech = await this.ticketAssigneesRepo.findOne({ where: { id: technicianId } });
    if (!tech) throw new NotFoundException(`Técnico ${technicianId} no encontrado`);
    if (!tech.isActive) {
      throw new BadRequestException(
        `El técnico ${tech.name} está inactivo; no puede registrarse en un mantenimiento nuevo`,
      );
    }
    return tech;
  }

  /**
   * Último preventivo por equipo + estado derivado, en una sola consulta para el
   * conjunto de ids que se pida (listado o detalle). Los equipos sin preventivo
   * simplemente no aparecen en el mapa → el llamador asume `sin_mantenimiento`.
   */
  private async deriveMaintenanceForEquipmentIds(
    ids: string[],
  ): Promise<Map<string, DerivedMaintenance>> {
    const map = new Map<string, DerivedMaintenance>();
    if (ids.length === 0) return map;

    const rows = await this.maintenanceRepo.query(
      `
      SELECT equipment_id, MAX(maintenance_date) AS last_date
      FROM inventory.equipment_maintenance
      WHERE maintenance_type = 'Preventivo'
        AND deleted_at IS NULL
        AND equipment_id = ANY($1::uuid[])
      GROUP BY equipment_id
      `,
      [ids],
    );

    for (const r of rows as { equipment_id: string; last_date: unknown }[]) {
      const last = toDateString(r.last_date);
      if (!last) continue;
      map.set(r.equipment_id, deriveMaintenance([{ maintenanceDate: last, maintenanceType: 'Preventivo' }]));
    }
    return map;
  }

  /** Cada alta/edición/borrado de mantenimiento deja rastro en el historial (RN-6). */
  private async writeMaintenanceHistory(
    equipmentId: string,
    userId: string,
    userName: string,
    action: string,
    notes: string,
  ): Promise<void> {
    await this.historyRepo.save(
      this.historyRepo.create({ equipmentId, changedById: userId, changedByName: userName, action, notes }),
    );
  }

  private toMaintenanceView(record: EquipmentMaintenance) {
    return {
      id: record.id,
      equipmentId: record.equipmentId,
      maintenanceDate: toDateString(record.maintenanceDate),
      maintenanceType: record.maintenanceType,
      technicianId: record.technicianId,
      technicianName: record.technicianName,
      observations: record.observations,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /** Bitácora del equipo (más reciente primero) + resumen derivado del semáforo. */
  async listMaintenanceByEquipment(equipmentId: string) {
    await this.ensureEquipment(equipmentId);

    const records = await this.maintenanceRepo.find({
      where: { equipmentId, deletedAt: IsNull() },
      order: { maintenanceDate: 'DESC', createdAt: 'DESC' },
    });

    const derived = deriveMaintenance(
      records.map((r) => ({ maintenanceDate: r.maintenanceDate, maintenanceType: r.maintenanceType })),
    );

    return { data: records.map((r) => this.toMaintenanceView(r)), ...derived };
  }

  async createMaintenance(
    equipmentId: string,
    dto: CreateMaintenanceDto,
    userId: string,
    userName: string,
  ) {
    await this.ensureEquipment(equipmentId);
    const tech = await this.assertActiveTechnician(dto.technicianId);
    const type = dto.maintenanceType ?? 'Preventivo';

    await this.maintenanceRepo.save(
      this.maintenanceRepo.create({
        equipmentId,
        maintenanceDate: dto.maintenanceDate,
        maintenanceType: type,
        technicianId: tech.id,
        technicianName: tech.name, // copia del nombre al momento de registrar
        observations: dto.observations ?? null,
      }),
    );

    await this.writeMaintenanceHistory(
      equipmentId,
      userId,
      userName,
      'MANTENIMIENTO_CREADO',
      `${type} registrado (${dto.maintenanceDate}) por ${tech.name}`,
    );

    return this.listMaintenanceByEquipment(equipmentId);
  }

  async updateMaintenance(
    equipmentId: string,
    maintenanceId: string,
    dto: UpdateMaintenanceDto,
    userId: string,
    userName: string,
  ) {
    const record = await this.maintenanceRepo.findOne({
      where: { id: maintenanceId, equipmentId, deletedAt: IsNull() },
    });
    if (!record) throw new NotFoundException(`Mantenimiento ${maintenanceId} no encontrado`);

    const changes: string[] = [];

    if (dto.maintenanceDate !== undefined && dto.maintenanceDate !== record.maintenanceDate) {
      changes.push(`fecha: ${record.maintenanceDate} → ${dto.maintenanceDate}`);
      record.maintenanceDate = dto.maintenanceDate;
    }
    if (dto.maintenanceType !== undefined && dto.maintenanceType !== record.maintenanceType) {
      changes.push(`tipo: ${record.maintenanceType} → ${dto.maintenanceType}`);
      record.maintenanceType = dto.maintenanceType;
    }
    if (dto.technicianId !== undefined && dto.technicianId !== record.technicianId) {
      const tech = await this.assertActiveTechnician(dto.technicianId);
      changes.push(`técnico: ${record.technicianName} → ${tech.name}`);
      record.technicianId = tech.id;
      record.technicianName = tech.name;
    }
    if (dto.observations !== undefined && (dto.observations ?? '') !== (record.observations ?? '')) {
      changes.push('observaciones actualizadas');
      record.observations = dto.observations ?? null;
    }

    await this.maintenanceRepo.save(record);

    if (changes.length > 0) {
      await this.writeMaintenanceHistory(
        equipmentId,
        userId,
        userName,
        'MANTENIMIENTO_EDITADO',
        changes.join('; '),
      );
    }

    return this.listMaintenanceByEquipment(equipmentId);
  }

  /** Borrado lógico (RN-5). Al recalcular, si era el último preventivo el semáforo se mueve solo. */
  async deleteMaintenance(
    equipmentId: string,
    maintenanceId: string,
    userId: string,
    userName: string,
  ) {
    const record = await this.maintenanceRepo.findOne({
      where: { id: maintenanceId, equipmentId, deletedAt: IsNull() },
    });
    if (!record) throw new NotFoundException(`Mantenimiento ${maintenanceId} no encontrado`);

    record.deletedBy = userId;
    await this.maintenanceRepo.save(record);
    await this.maintenanceRepo.softDelete(maintenanceId);

    await this.writeMaintenanceHistory(
      equipmentId,
      userId,
      userName,
      'MANTENIMIENTO_ELIMINADO',
      `${record.maintenanceType} del ${record.maintenanceDate} eliminado`,
    );

    return this.listMaintenanceByEquipment(equipmentId);
  }

  /**
   * Equipos cuyo próximo mantenimiento cae dentro de los próximos N días (o ya
   * pasó): sirve para "¿a qué equipos les toca este mes?". El `+ interval '6
   * months'` de Postgres hace el tope a fin de mes solo (RN-8). Los equipos sin
   * ningún preventivo no aparecen: son `sin_mantenimiento`, no vencidos (D4).
   */
  async getMaintenanceDue(days = MAINTENANCE_WARNING_DAYS) {
    const rows = await this.maintenanceRepo.query(
      `
      SELECT e.id,
             e.display_id,
             e.legacy_id,
             e.brand,
             e.model,
             e.equipment_type,
             emp.full_name AS assigned_to,
             last.last_date,
             (last.last_date + interval '6 months')::date AS next_date,
             ((last.last_date + interval '6 months')::date - CURRENT_DATE)::int AS days_until_due
      FROM inventory.equipment e
      JOIN LATERAL (
        SELECT MAX(m.maintenance_date) AS last_date
        FROM inventory.equipment_maintenance m
        WHERE m.equipment_id = e.id
          AND m.maintenance_type = 'Preventivo'
          AND m.deleted_at IS NULL
      ) last ON TRUE
      LEFT JOIN employees.employee_records emp ON emp.id = e.assigned_to_employee_id
      WHERE e.deleted_at IS NULL
        AND last.last_date IS NOT NULL
        AND (last.last_date + interval '6 months')::date <= CURRENT_DATE + $1::int
      ORDER BY next_date ASC
      `,
      [days],
    );

    return rows.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      displayId: r.display_id as string,
      legacyId: (r.legacy_id as string) ?? null,
      brand: (r.brand as string) ?? null,
      model: (r.model as string) ?? null,
      equipmentType: r.equipment_type as string,
      assignedTo: (r.assigned_to as string) ?? null,
      lastMaintenanceDate: toDateString(r.last_date),
      nextMaintenanceDate: toDateString(r.next_date),
      daysUntilDue: r.days_until_due as number,
    }));
  }
}
