import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { todayInMexico } from '../../../common/business-date';
import { User } from '../../auth/entities/user.entity';
import { userHasPermission } from '../../auth/permissions.util';
import { ACCENTED, normalizeSearchWords, UNACCENTED } from '../../risks/risk-owner.util';
import {
  AssignSimCardDto,
  CreateSimCardDto,
  CreateSimPlanDto,
  QuerySimCardsDto,
  UnassignSimCardDto,
  UpdateSimCardDto,
  UpdateSimPlanDto,
} from './dto/sim-card.dto';
import {
  buildWarnings,
  effectiveCost,
  expiryStatus,
  normalizeIccid,
  normalizePhone,
  SIM_EXPIRY_WARNING_DAYS,
  SimExpiryStatus,
  toNumber,
} from './sim-cards.util';

// ── Filas y vistas ───────────────────────────────────────────────────────────

interface SimRow {
  id: string;
  sim_code: string;
  phone_number: string;
  iccid: string | null;
  plan_id: string;
  plan_name: string;
  plan_cost: string;
  plan_currency: string;
  provider_id: string | null;
  provider_name: string | null;
  employee_id: string | null;
  employee_name: string | null;
  equipment_id: string | null;
  equipment_display_id: string | null;
  equipment_brand: string | null;
  equipment_model: string | null;
  equipment_employee_id: string | null;
  equipment_employee_name: string | null;
  monthly_cost: string | null;
  currency: string;
  term_months: number | null;
  contract_end_date: string | null;
  activation_date: string | null;
  assigned_date: string | null;
  status: string;
  device_type: string;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

interface HistoryRow {
  id: string;
  sim_card_id: string;
  sim_code: string;
  phone_number: string;
  action: string;
  employee_id: string | null;
  employee_name: string | null;
  equipment_id: string | null;
  equipment_display_id: string | null;
  assigned_date: string | null;
  returned_date: string | null;
  notes: string | null;
  changed_by_name: string | null;
  created_at: Date;
}

interface PlanRow {
  id: string;
  name: string;
  vendor_id: string;
  vendor_name: string | null;
  monthly_cost: string;
  currency: string;
  description: string | null;
  is_active: boolean;
  sim_count: string;
  created_at: Date;
  updated_at: Date;
}

export interface SimCardView {
  id: string;
  simCode: string;
  phoneNumber: string;
  /** Solo para quien tiene `sim-cards.write`: el ICCID habilita un SIM-swap. */
  iccid?: string | null;
  plan: { id: string; name: string; monthlyCost: number; currency: string };
  provider: { id: string; name: string } | null;
  employee: { id: string; fullName: string } | null;
  equipment: { id: string; displayId: string; label: string } | null;
  /** Costo propio de la línea (puede ser null: entonces rige el del plan). */
  ownMonthlyCost: number | null;
  /** Costo que aplica: el propio o, si no hay, el del plan. */
  monthlyCost: number;
  currency: string;
  termMonths: number | null;
  contractEndDate: string | null;
  expiryStatus: SimExpiryStatus;
  activationDate: string | null;
  assignedDate: string | null;
  status: string;
  deviceType: string;
  notes: string | null;
  warnings: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SimHistoryView {
  id: string;
  simCardId: string;
  simCode: string;
  phoneNumber: string;
  action: string;
  employee: { id: string; fullName: string } | null;
  equipment: { id: string; displayId: string } | null;
  assignedDate: string | null;
  returnedDate: string | null;
  notes: string | null;
  changedByName: string | null;
  createdAt: string;
}

export interface SimPlanView {
  id: string;
  name: string;
  vendor: { id: string; name: string | null };
  monthlyCost: number;
  currency: string;
  description: string | null;
  isActive: boolean;
  simCount: number;
  createdAt: string;
  updatedAt: string;
}

const SIM_SELECT = `
  SELECT s.id, s.sim_code, s.phone_number, s.iccid, s.plan_id,
         p.name AS plan_name, p.monthly_cost AS plan_cost, p.currency AS plan_currency,
         v.id AS provider_id, v.name AS provider_name,
         s.employee_id, emp.full_name AS employee_name,
         s.equipment_id, eq.display_id AS equipment_display_id, eq.brand AS equipment_brand, eq.model AS equipment_model,
         eq.assigned_to_employee_id AS equipment_employee_id, eqemp.full_name AS equipment_employee_name,
         s.monthly_cost, s.currency, s.term_months,
         to_char(s.contract_end_date, 'YYYY-MM-DD') AS contract_end_date,
         to_char(s.activation_date, 'YYYY-MM-DD') AS activation_date,
         to_char(s.assigned_date, 'YYYY-MM-DD') AS assigned_date,
         s.status, s.device_type, s.notes, s.created_at, s.updated_at
  FROM inventory.sim_cards s
  JOIN inventory.sim_plans p ON p.id = s.plan_id
  LEFT JOIN vendors.vendors v ON v.id = p.vendor_id
  LEFT JOIN employees.employee_records emp ON emp.id = s.employee_id
  LEFT JOIN inventory.equipment eq ON eq.id = s.equipment_id
  LEFT JOIN employees.employee_records eqemp ON eqemp.id = eq.assigned_to_employee_id
`;

const HISTORY_SELECT = `
  SELECT h.id, h.sim_card_id, s.sim_code, s.phone_number, h.action,
         h.employee_id, emp.full_name AS employee_name,
         h.equipment_id, eq.display_id AS equipment_display_id,
         to_char(h.assigned_date, 'YYYY-MM-DD') AS assigned_date,
         to_char(h.returned_date, 'YYYY-MM-DD') AS returned_date,
         h.notes, h.changed_by_name, h.created_at
  FROM inventory.sim_card_history h
  JOIN inventory.sim_cards s ON s.id = h.sim_card_id
  LEFT JOIN employees.employee_records emp ON emp.id = h.employee_id
  LEFT JOIN inventory.equipment eq ON eq.id = h.equipment_id
`;

/** Sobre quién se aplican los filtros de vencimiento: las líneas canceladas no cuentan. */
const EXPIRING_CLAUSE = `s.status <> 'cancelada' AND s.contract_end_date IS NOT NULL`;
const CURSOR_MS_EXPR = "date_trunc('milliseconds', s.created_at)";

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Violación de un índice único → 409 con un mensaje que dice qué se repitió. */
function rethrowConflict(err: unknown): never {
  const e = err as { code?: string; constraint?: string; driverError?: { code?: string; constraint?: string } };
  const code = e.code ?? e.driverError?.code;
  const constraint = e.constraint ?? e.driverError?.constraint;
  if (code === '23505') {
    if (constraint === 'uq_sim_cards_phone_alive') {
      throw new ConflictException('Ya existe una línea con ese número.');
    }
    if (constraint === 'uq_sim_cards_iccid_alive') {
      throw new ConflictException('Ya existe una línea con ese ICCID.');
    }
    if (constraint === 'uq_sim_plans_vendor_name_alive') {
      throw new ConflictException('Ya existe un plan con ese nombre para ese proveedor.');
    }
  }
  throw err;
}

@Injectable()
export class SimCardsService {
  constructor(private readonly dataSource: DataSource) {}

  // ── Permisos ───────────────────────────────────────────────────────────────

  private canWrite(user: User): boolean {
    return userHasPermission(user, 'transformacion', 'sim-cards', 'write');
  }

  // ── Mapeo ──────────────────────────────────────────────────────────────────

  private toView(row: SimRow, canWrite: boolean, now: Date = new Date()): SimCardView {
    const planCost = toNumber(row.plan_cost) ?? 0;
    const own = toNumber(row.monthly_cost);
    const cost = effectiveCost(own, row.currency, planCost, row.plan_currency);
    const label = [row.equipment_brand, row.equipment_model].filter(Boolean).join(' ');

    const view: SimCardView = {
      id: row.id,
      simCode: row.sim_code,
      phoneNumber: row.phone_number,
      plan: { id: row.plan_id, name: row.plan_name, monthlyCost: planCost, currency: row.plan_currency },
      provider: row.provider_id ? { id: row.provider_id, name: row.provider_name ?? '' } : null,
      employee: row.employee_id ? { id: row.employee_id, fullName: row.employee_name ?? '' } : null,
      equipment: row.equipment_id
        ? { id: row.equipment_id, displayId: row.equipment_display_id ?? '', label }
        : null,
      ownMonthlyCost: own,
      monthlyCost: cost.amount,
      currency: cost.currency,
      termMonths: row.term_months,
      contractEndDate: row.contract_end_date,
      expiryStatus: expiryStatus(row.contract_end_date, now),
      activationDate: row.activation_date,
      assignedDate: row.assigned_date,
      status: row.status,
      deviceType: row.device_type,
      notes: row.notes,
      warnings: buildWarnings({
        employeeId: row.employee_id,
        employeeName: row.employee_name,
        equipmentId: row.equipment_id,
        equipmentDisplayId: row.equipment_display_id,
        equipmentEmployeeId: row.equipment_employee_id,
        equipmentEmployeeName: row.equipment_employee_name,
      }),
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
    if (canWrite) view.iccid = row.iccid;
    return view;
  }

  private toHistoryView(row: HistoryRow): SimHistoryView {
    return {
      id: row.id,
      simCardId: row.sim_card_id,
      simCode: row.sim_code,
      phoneNumber: row.phone_number,
      action: row.action,
      employee: row.employee_id ? { id: row.employee_id, fullName: row.employee_name ?? '' } : null,
      equipment: row.equipment_id ? { id: row.equipment_id, displayId: row.equipment_display_id ?? '' } : null,
      assignedDate: row.assigned_date,
      returnedDate: row.returned_date,
      notes: row.notes,
      changedByName: row.changed_by_name,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  private toPlanView(row: PlanRow): SimPlanView {
    return {
      id: row.id,
      name: row.name,
      vendor: { id: row.vendor_id, name: row.vendor_name },
      monthlyCost: toNumber(row.monthly_cost) ?? 0,
      currency: row.currency,
      description: row.description,
      isActive: row.is_active,
      simCount: Number(row.sim_count),
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  // ── Lectura de una línea ───────────────────────────────────────────────────

  private async fetchRow(m: EntityManager, id: string, forUpdate = false): Promise<SimRow> {
    // FOR UPDATE no se puede combinar con los LEFT JOIN: se bloquea solo la fila de la SIM.
    if (forUpdate) {
      const locked = (await m.query(
        `SELECT id FROM inventory.sim_cards WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [id],
      )) as { id: string }[];
      if (locked.length === 0) throw new NotFoundException('Línea no encontrada.');
    }
    const rows = (await m.query(`${SIM_SELECT} WHERE s.id = $1 AND s.deleted_at IS NULL`, [id])) as SimRow[];
    const row = rows[0];
    if (!row) throw new NotFoundException('Línea no encontrada.');
    return row;
  }

  private async historyOf(m: EntityManager, simId: string): Promise<SimHistoryView[]> {
    const rows = (await m.query(
      `${HISTORY_SELECT} WHERE h.sim_card_id = $1 ORDER BY h.created_at DESC, h.id DESC`,
      [simId],
    )) as HistoryRow[];
    return rows.map((r) => this.toHistoryView(r));
  }

  async get(id: string, user: User): Promise<SimCardView & { history: SimHistoryView[] }> {
    const m = this.dataSource.manager;
    const row = await this.fetchRow(m, id);
    return { ...this.toView(row, this.canWrite(user)), history: await this.historyOf(m, id) };
  }

  // ── Listado ────────────────────────────────────────────────────────────────

  async list(query: QuerySimCardsDto, user: User) {
    const limit = query.limit ?? 20;
    const today = todayInMexico();
    const params: unknown[] = [];
    const add = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };
    const where: string[] = ['s.deleted_at IS NULL'];

    if (query.status) where.push(`s.status = ${add(query.status)}`);
    if (query.employeeId) where.push(`s.employee_id = ${add(query.employeeId)}`);
    if (query.planId) where.push(`s.plan_id = ${add(query.planId)}`);
    if (query.providerId) where.push(`p.vendor_id = ${add(query.providerId)}`);
    if (query.unassigned) where.push('s.employee_id IS NULL');
    if (query.assigned) where.push('s.employee_id IS NOT NULL');
    if (query.expiry) {
      const t = add(today);
      where.push(EXPIRING_CLAUSE);
      where.push(
        query.expiry === 'vencida'
          ? `s.contract_end_date < ${t}::date`
          : `s.contract_end_date >= ${t}::date AND s.contract_end_date <= ${t}::date + ${add(SIM_EXPIRY_WARNING_DAYS)}::int`,
      );
    }
    const words = normalizeSearchWords(query.search);
    if (words.length > 0) {
      const from = add(ACCENTED);
      const to = add(UNACCENTED);
      for (const word of words) {
        const p = add(`%${word}%`);
        where.push(
          `translate(lower(concat_ws(' ', s.sim_code, s.phone_number, p.name, emp.full_name)), ${from}, ${to}) LIKE ${p} ESCAPE '\\'`,
        );
      }
    }

    const m = this.dataSource.manager;
    // El total se toma antes del cursor: es el de la consulta filtrada, no el de la página.
    const countRows = (await m.query(
      `SELECT count(*) AS total FROM inventory.sim_cards s
         JOIN inventory.sim_plans p ON p.id = s.plan_id
         LEFT JOIN employees.employee_records emp ON emp.id = s.employee_id
       WHERE ${where.join(' AND ')}`,
      params,
    )) as { total: string }[];
    const total = Number(countRows[0]?.total ?? 0);

    if (query.cursor) {
      const [cursorDate = '', cursorId = ''] = Buffer.from(query.cursor, 'base64url').toString().split('|');
      if (!cursorDate || !/^[0-9a-f-]{36}$/i.test(cursorId) || Number.isNaN(new Date(cursorDate).getTime())) {
        throw new BadRequestException('Cursor inválido.');
      }
      const cd = add(cursorDate);
      const ci = add(cursorId);
      where.push(`(${CURSOR_MS_EXPR} < ${cd}::timestamptz OR (${CURSOR_MS_EXPR} = ${cd}::timestamptz AND s.id < ${ci}::uuid))`);
    }

    const rows = (await m.query(
      `${SIM_SELECT} WHERE ${where.join(' AND ')}
       ORDER BY ${CURSOR_MS_EXPR} DESC, s.id DESC LIMIT ${limit + 1}`,
      params,
    )) as SimRow[];
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page.at(-1);
    const nextCursor =
      hasMore && last
        ? Buffer.from(`${new Date(last.created_at).toISOString()}|${last.id}`).toString('base64url')
        : null;

    const canWrite = this.canWrite(user);
    return { data: page.map((r) => this.toView(r, canWrite)), nextCursor, total };
  }

  // ── Estadísticas y vencimientos ────────────────────────────────────────────

  async stats() {
    const rows = (await this.dataSource.manager.query(
      `SELECT
         count(*) FILTER (WHERE s.status = 'activa') AS activas,
         count(*) FILTER (WHERE s.status = 'activa' AND s.employee_id IS NULL) AS sin_asignar,
         count(*) FILTER (WHERE ${EXPIRING_CLAUSE} AND s.contract_end_date >= $1::date
                            AND s.contract_end_date <= $1::date + $2::int) AS por_vencer,
         count(*) FILTER (WHERE ${EXPIRING_CLAUSE} AND s.contract_end_date < $1::date) AS vencidas,
         COALESCE(sum(COALESCE(s.monthly_cost, p.monthly_cost)) FILTER (
           WHERE s.status <> 'cancelada'
             AND (CASE WHEN s.monthly_cost IS NOT NULL THEN s.currency ELSE p.currency END) = 'MXN'), 0) AS cost_mxn,
         COALESCE(sum(COALESCE(s.monthly_cost, p.monthly_cost)) FILTER (
           WHERE s.status <> 'cancelada'
             AND (CASE WHEN s.monthly_cost IS NOT NULL THEN s.currency ELSE p.currency END) = 'USD'), 0) AS cost_usd
       FROM inventory.sim_cards s
       JOIN inventory.sim_plans p ON p.id = s.plan_id
       WHERE s.deleted_at IS NULL`,
      [todayInMexico(), SIM_EXPIRY_WARNING_DAYS],
    )) as Record<string, string>[];
    const r = rows[0] ?? {};
    return {
      active: Number(r.activas ?? 0),
      unassigned: Number(r.sin_asignar ?? 0),
      expiring: Number(r.por_vencer ?? 0),
      expired: Number(r.vencidas ?? 0),
      // Cada moneda por separado: nunca se suman MXN y USD.
      monthlyCostMXN: Number(r.cost_mxn ?? 0),
      monthlyCostUSD: Number(r.cost_usd ?? 0),
    };
  }

  /** Líneas por vencer (≤30 días) y vencidas, de la más próxima a la más antigua. */
  async expiring(user: User): Promise<SimCardView[]> {
    const rows = (await this.dataSource.manager.query(
      `${SIM_SELECT}
       WHERE s.deleted_at IS NULL AND ${EXPIRING_CLAUSE}
         AND s.contract_end_date <= $1::date + $2::int
       ORDER BY s.contract_end_date ASC, s.sim_code ASC LIMIT 200`,
      [todayInMexico(), SIM_EXPIRY_WARNING_DAYS],
    )) as SimRow[];
    const canWrite = this.canWrite(user);
    return rows.map((r) => this.toView(r, canWrite));
  }

  // ── Por persona y por equipo ───────────────────────────────────────────────

  /** Acepta `sim-cards.read` o `rrhh.empleados.read` (el expediente de RRHH). */
  async byEmployee(employeeId: string, user: User) {
    const allowed =
      userHasPermission(user, 'transformacion', 'sim-cards', 'read') ||
      userHasPermission(user, 'rrhh', 'empleados', 'read');
    if (!allowed) throw new ForbiddenException('No tienes permisos para acceder a este recurso');

    const m = this.dataSource.manager;
    const rows = (await m.query(
      `${SIM_SELECT} WHERE s.deleted_at IS NULL AND s.employee_id = $1 ORDER BY s.sim_code ASC`,
      [employeeId],
    )) as SimRow[];
    const history = (await m.query(
      `${HISTORY_SELECT} WHERE h.employee_id = $1 ORDER BY h.created_at DESC, h.id DESC LIMIT 100`,
      [employeeId],
    )) as HistoryRow[];
    const canWrite = this.canWrite(user);
    return { current: rows.map((r) => this.toView(r, canWrite)), history: history.map((h) => this.toHistoryView(h)) };
  }

  async byEquipment(equipmentId: string, user: User): Promise<SimCardView[]> {
    const rows = (await this.dataSource.manager.query(
      `${SIM_SELECT} WHERE s.deleted_at IS NULL AND s.equipment_id = $1 ORDER BY s.sim_code ASC`,
      [equipmentId],
    )) as SimRow[];
    const canWrite = this.canWrite(user);
    return rows.map((r) => this.toView(r, canWrite));
  }

  /** Líneas aún sin equipo, para el selector "Asociar línea" de la pestaña Asignación. */
  async withoutEquipment(user: User): Promise<SimCardView[]> {
    const rows = (await this.dataSource.manager.query(
      `${SIM_SELECT} WHERE s.deleted_at IS NULL AND s.equipment_id IS NULL AND s.status <> 'cancelada'
       ORDER BY s.sim_code ASC LIMIT 500`,
    )) as SimRow[];
    const canWrite = this.canWrite(user);
    return rows.map((r) => this.toView(r, canWrite));
  }

  // ── Altas, ediciones y bajas ───────────────────────────────────────────────

  private async assertPlan(m: EntityManager, planId: string) {
    const rows = (await m.query(
      `SELECT id, currency, is_active FROM inventory.sim_plans WHERE id = $1 AND deleted_at IS NULL`,
      [planId],
    )) as { id: string; currency: string; is_active: boolean }[];
    const plan = rows[0];
    if (!plan) throw new NotFoundException('Plan no encontrado.');
    if (!plan.is_active) throw new ConflictException('El plan está inactivo.');
    return plan;
  }

  private async assertEmployee(m: EntityManager, id: string): Promise<void> {
    const rows = await m.query(`SELECT 1 FROM employees.employee_records WHERE id = $1 AND deleted_at IS NULL`, [id]);
    if ((rows as unknown[]).length === 0) throw new NotFoundException('Persona no encontrada.');
  }

  private async assertEquipment(m: EntityManager, id: string): Promise<void> {
    const rows = await m.query(`SELECT 1 FROM inventory.equipment WHERE id = $1 AND deleted_at IS NULL`, [id]);
    if ((rows as unknown[]).length === 0) throw new NotFoundException('Equipo no encontrado.');
  }

  private async insertHistory(
    m: EntityManager,
    h: {
      simId: string;
      action: 'asignacion' | 'desasignacion';
      employeeId: string | null;
      equipmentId: string | null;
      assignedDate: string | null;
      returnedDate: string | null;
      notes: string | null;
    },
    user: User,
  ): Promise<void> {
    await m.query(
      `INSERT INTO inventory.sim_card_history
         (sim_card_id, action, employee_id, equipment_id, assigned_date, returned_date, notes, changed_by, changed_by_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [h.simId, h.action, h.employeeId, h.equipmentId, h.assignedDate, h.returnedDate, h.notes, user.id, user.name],
    );
  }

  async create(dto: CreateSimCardDto, user: User): Promise<SimCardView> {
    const phone = normalizePhone(dto.phoneNumber);
    const iccid = normalizeIccid(dto.iccid);
    const today = todayInMexico();

    try {
      return await this.dataSource.transaction(async (m) => {
        const plan = await this.assertPlan(m, dto.planId);
        if (dto.employeeId) await this.assertEmployee(m, dto.employeeId);
        if (dto.equipmentId) await this.assertEquipment(m, dto.equipmentId);

        // Se revisan los duplicados antes de pedir el código: la secuencia no hace
        // rollback, y cada intento repetido dejaría un hueco en SIM-001, SIM-002…
        // Los índices únicos siguen siendo la defensa ante dos altas simultáneas.
        const dups = (await m.query(
          `SELECT phone_number, iccid FROM inventory.sim_cards
           WHERE deleted_at IS NULL AND (phone_number = $1 OR ($2::text IS NOT NULL AND iccid = $2))`,
          [phone, iccid],
        )) as { phone_number: string; iccid: string | null }[];
        if (dups.some((d) => d.phone_number === phone)) {
          throw new ConflictException('Ya existe una línea con ese número.');
        }
        if (dups.length > 0) throw new ConflictException('Ya existe una línea con ese ICCID.');

        const seq = (await m.query(`SELECT nextval('inventory.sim_card_code_seq') AS n`)) as { n: string }[];
        const simCode = `SIM-${String(seq[0]?.n ?? '0').padStart(3, '0')}`;
        const assignedDate = dto.employeeId ? (dto.assignedDate ?? today) : null;

        const inserted = (await m.query(
          `INSERT INTO inventory.sim_cards
             (sim_code, phone_number, iccid, plan_id, employee_id, equipment_id, monthly_cost, currency,
              term_months, contract_end_date, activation_date, assigned_date, status, device_type, notes,
              created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16)
           RETURNING id`,
          [
            simCode,
            phone,
            iccid,
            dto.planId,
            dto.employeeId ?? null,
            dto.equipmentId ?? null,
            dto.monthlyCost ?? null,
            dto.currency ?? plan.currency,
            dto.termMonths ?? null,
            dto.contractEndDate ?? null,
            dto.activationDate ?? null,
            assignedDate,
            dto.status ?? 'activa',
            dto.deviceType ?? 'smartphone',
            emptyToNull(dto.notes),
            user.id,
          ],
        )) as { id: string }[];
        const id = inserted[0]?.id;
        if (!id) throw new Error('No se pudo crear la línea.');

        if (dto.employeeId || dto.equipmentId) {
          await this.insertHistory(
            m,
            {
              simId: id,
              action: 'asignacion',
              employeeId: dto.employeeId ?? null,
              equipmentId: dto.equipmentId ?? null,
              assignedDate: assignedDate ?? today,
              returnedDate: null,
              notes: 'Asignación inicial al dar de alta la línea',
            },
            user,
          );
        }
        return this.toView(await this.fetchRow(m, id), this.canWrite(user));
      });
    } catch (err) {
      return rethrowConflict(err);
    }
  }

  async update(id: string, dto: UpdateSimCardDto, user: User): Promise<SimCardView> {
    try {
      return await this.dataSource.transaction(async (m) => {
        await this.fetchRow(m, id, true);

        const sets: string[] = [];
        const params: unknown[] = [];
        const set = (column: string, value: unknown) => {
          params.push(value);
          sets.push(`${column} = $${params.length}`);
        };

        if (dto.phoneNumber !== undefined) set('phone_number', normalizePhone(dto.phoneNumber));
        if (dto.iccid !== undefined) set('iccid', normalizeIccid(dto.iccid));
        if (dto.planId !== undefined) {
          await this.assertPlan(m, dto.planId);
          set('plan_id', dto.planId);
        }
        if (dto.monthlyCost !== undefined) set('monthly_cost', dto.monthlyCost);
        if (dto.currency !== undefined) set('currency', dto.currency);
        if (dto.termMonths !== undefined) set('term_months', dto.termMonths);
        if (dto.contractEndDate !== undefined) set('contract_end_date', dto.contractEndDate);
        if (dto.activationDate !== undefined) set('activation_date', dto.activationDate);
        if (dto.status !== undefined) set('status', dto.status);
        if (dto.deviceType !== undefined) set('device_type', dto.deviceType);
        if (dto.notes !== undefined) set('notes', emptyToNull(dto.notes));

        if (sets.length > 0) {
          params.push(user.id);
          const by = `$${params.length}`;
          params.push(id);
          await m.query(
            `UPDATE inventory.sim_cards SET ${sets.join(', ')}, updated_at = NOW(), updated_by = ${by}
             WHERE id = $${params.length}`,
            params,
          );
        }
        return this.toView(await this.fetchRow(m, id), this.canWrite(user));
      });
    } catch (err) {
      return rethrowConflict(err);
    }
  }

  /**
   * Asigna la línea a una persona, a un equipo o a ambos. Lo que no se manda se
   * conserva. Cambiar una asignación vigente registra primero la liberación de
   * lo anterior y luego la nueva asignación, en la misma transacción.
   */
  async assign(id: string, dto: AssignSimCardDto, user: User): Promise<SimCardView> {
    if (!dto.employeeId && !dto.equipmentId) {
      throw new BadRequestException('Indica la persona o el equipo al que se asigna la línea.');
    }
    const today = todayInMexico();

    return this.dataSource.transaction(async (m) => {
      const current = await this.fetchRow(m, id, true);
      if (current.status === 'cancelada') {
        throw new ConflictException('No se puede asignar una línea cancelada.');
      }
      if (dto.employeeId) await this.assertEmployee(m, dto.employeeId);
      if (dto.equipmentId) await this.assertEquipment(m, dto.equipmentId);

      const newEmployee = dto.employeeId ?? current.employee_id;
      const newEquipment = dto.equipmentId ?? current.equipment_id;
      const employeeChanged = newEmployee !== current.employee_id;
      const equipmentChanged = newEquipment !== current.equipment_id;
      const dateChanged = dto.assignedDate !== undefined && dto.assignedDate !== current.assigned_date;

      if (!employeeChanged && !equipmentChanged && !dateChanged) {
        return this.toView(current, this.canWrite(user));
      }

      // Lo que se libera por reemplazo.
      const releasedEmployee = employeeChanged ? current.employee_id : null;
      const releasedEquipment = equipmentChanged ? current.equipment_id : null;
      if (releasedEmployee || releasedEquipment) {
        await this.insertHistory(
          m,
          {
            simId: id,
            action: 'desasignacion',
            employeeId: releasedEmployee,
            equipmentId: releasedEquipment,
            assignedDate: null,
            returnedDate: today,
            notes: 'Liberada al reasignar la línea',
          },
          user,
        );
      }

      const assignedDate =
        employeeChanged || dateChanged ? (newEmployee ? (dto.assignedDate ?? today) : null) : current.assigned_date;

      await m.query(
        `UPDATE inventory.sim_cards
         SET employee_id = $1, equipment_id = $2, assigned_date = $3, updated_at = NOW(), updated_by = $4
         WHERE id = $5`,
        [newEmployee, newEquipment, assignedDate, user.id, id],
      );
      await this.insertHistory(
        m,
        {
          simId: id,
          action: 'asignacion',
          employeeId: newEmployee,
          equipmentId: newEquipment,
          assignedDate: assignedDate ?? today,
          returnedDate: null,
          notes: emptyToNull(dto.notes),
        },
        user,
      );
      return this.toView(await this.fetchRow(m, id), this.canWrite(user));
    });
  }

  async unassign(id: string, dto: UnassignSimCardDto, user: User): Promise<SimCardView> {
    const scope = dto.scope ?? 'all';
    const today = todayInMexico();

    return this.dataSource.transaction(async (m) => {
      const current = await this.fetchRow(m, id, true);
      const releaseEmployee = scope !== 'equipment' ? current.employee_id : null;
      const releaseEquipment = scope !== 'employee' ? current.equipment_id : null;
      if (!releaseEmployee && !releaseEquipment) {
        throw new BadRequestException('La línea no tiene asignación que quitar.');
      }

      await this.insertHistory(
        m,
        {
          simId: id,
          action: 'desasignacion',
          employeeId: releaseEmployee,
          equipmentId: releaseEquipment,
          assignedDate: null,
          returnedDate: today,
          notes: emptyToNull(dto.notes),
        },
        user,
      );
      await m.query(
        `UPDATE inventory.sim_cards
         SET employee_id = $1, equipment_id = $2, assigned_date = $3, updated_at = NOW(), updated_by = $4
         WHERE id = $5`,
        [
          releaseEmployee ? null : current.employee_id,
          releaseEquipment ? null : current.equipment_id,
          releaseEmployee ? null : current.assigned_date,
          user.id,
          id,
        ],
      );
      return this.toView(await this.fetchRow(m, id), this.canWrite(user));
    });
  }

  /** Baja lógica. Si la línea está asignada, primero se desasigna (queda en el historial). */
  async remove(id: string, user: User): Promise<{ success: true }> {
    const today = todayInMexico();
    await this.dataSource.transaction(async (m) => {
      const current = await this.fetchRow(m, id, true);
      if (current.employee_id || current.equipment_id) {
        await this.insertHistory(
          m,
          {
            simId: id,
            action: 'desasignacion',
            employeeId: current.employee_id,
            equipmentId: current.equipment_id,
            assignedDate: null,
            returnedDate: today,
            notes: 'Desasignada al dar de baja la línea',
          },
          user,
        );
      }
      await m.query(
        `UPDATE inventory.sim_cards
         SET employee_id = NULL, equipment_id = NULL, assigned_date = NULL,
             deleted_at = NOW(), deleted_by = $1, updated_at = NOW(), updated_by = $1
         WHERE id = $2`,
        [user.id, id],
      );
    });
    return { success: true };
  }

  // ── Planes ─────────────────────────────────────────────────────────────────

  private static readonly PLAN_SELECT = `
    SELECT p.id, p.name, p.vendor_id, v.name AS vendor_name, p.monthly_cost, p.currency, p.description,
           p.is_active, p.created_at, p.updated_at,
           (SELECT count(*) FROM inventory.sim_cards s WHERE s.plan_id = p.id AND s.deleted_at IS NULL) AS sim_count
    FROM inventory.sim_plans p
    LEFT JOIN vendors.vendors v ON v.id = p.vendor_id
  `;

  async listPlans(): Promise<SimPlanView[]> {
    const rows = (await this.dataSource.manager.query(
      `${SimCardsService.PLAN_SELECT} WHERE p.deleted_at IS NULL ORDER BY lower(v.name), lower(p.name)`,
    )) as PlanRow[];
    return rows.map((r) => this.toPlanView(r));
  }

  private async fetchPlan(m: EntityManager, id: string): Promise<SimPlanView> {
    const rows = (await m.query(`${SimCardsService.PLAN_SELECT} WHERE p.id = $1 AND p.deleted_at IS NULL`, [
      id,
    ])) as PlanRow[];
    const row = rows[0];
    if (!row) throw new NotFoundException('Plan no encontrado.');
    return this.toPlanView(row);
  }

  private async assertVendor(m: EntityManager, id: string): Promise<void> {
    const rows = await m.query(`SELECT 1 FROM vendors.vendors WHERE id = $1 AND deleted_at IS NULL`, [id]);
    if ((rows as unknown[]).length === 0) throw new NotFoundException('Proveedor no encontrado.');
  }

  async createPlan(dto: CreateSimPlanDto, user: User): Promise<SimPlanView> {
    try {
      return await this.dataSource.transaction(async (m) => {
        await this.assertVendor(m, dto.vendorId);
        const rows = (await m.query(
          `INSERT INTO inventory.sim_plans (name, vendor_id, monthly_cost, currency, description, is_active, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING id`,
          [
            dto.name.trim(),
            dto.vendorId,
            dto.monthlyCost,
            dto.currency ?? 'MXN',
            emptyToNull(dto.description),
            dto.isActive ?? true,
            user.id,
          ],
        )) as { id: string }[];
        const id = rows[0]?.id;
        if (!id) throw new Error('No se pudo crear el plan.');
        return this.fetchPlan(m, id);
      });
    } catch (err) {
      return rethrowConflict(err);
    }
  }

  async updatePlan(id: string, dto: UpdateSimPlanDto, user: User): Promise<SimPlanView> {
    try {
      return await this.dataSource.transaction(async (m) => {
        await this.fetchPlan(m, id);
        const sets: string[] = [];
        const params: unknown[] = [];
        const set = (column: string, value: unknown) => {
          params.push(value);
          sets.push(`${column} = $${params.length}`);
        };
        if (dto.name !== undefined) set('name', dto.name.trim());
        if (dto.vendorId !== undefined) {
          await this.assertVendor(m, dto.vendorId);
          set('vendor_id', dto.vendorId);
        }
        if (dto.monthlyCost !== undefined) set('monthly_cost', dto.monthlyCost);
        if (dto.currency !== undefined) set('currency', dto.currency);
        if (dto.description !== undefined) set('description', emptyToNull(dto.description));
        if (dto.isActive !== undefined) set('is_active', dto.isActive);
        if (sets.length > 0) {
          params.push(user.id);
          const by = `$${params.length}`;
          params.push(id);
          await m.query(
            `UPDATE inventory.sim_plans SET ${sets.join(', ')}, updated_at = NOW(), updated_by = ${by}
             WHERE id = $${params.length}`,
            params,
          );
        }
        return this.fetchPlan(m, id);
      });
    } catch (err) {
      return rethrowConflict(err);
    }
  }

  /** Baja lógica del plan; con líneas vivas se rechaza (409). */
  async deletePlan(id: string, user: User): Promise<{ success: true }> {
    await this.dataSource.transaction(async (m) => {
      const plan = await this.fetchPlan(m, id);
      if (plan.simCount > 0) {
        throw new ConflictException(
          `No se puede eliminar el plan: tiene ${plan.simCount} línea${plan.simCount === 1 ? '' : 's'} asociada${plan.simCount === 1 ? '' : 's'}.`,
        );
      }
      await m.query(
        `UPDATE inventory.sim_plans SET deleted_at = NOW(), deleted_by = $1, updated_at = NOW(), updated_by = $1 WHERE id = $2`,
        [user.id, id],
      );
    });
    return { success: true };
  }
}
