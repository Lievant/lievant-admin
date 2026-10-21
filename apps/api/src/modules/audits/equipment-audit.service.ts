import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { todayInMexico } from '../../common/business-date';
import { User } from '../auth/entities/user.entity';
import { HelpdeskService } from '../helpdesk/helpdesk.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateEquipmentAuditDto,
  QueryEquipmentAuditsDto,
  UpdateAuditEquipmentItemDto,
  UpdateAuditLicenseItemDto,
  UpdateEquipmentAuditDto,
} from './dto/equipment-audit.dto';
import {
  AUDIT_MAINTENANCE_ASSIGNEE_EMAIL,
  AUDIT_TD_OWNER_EMAIL,
  AUDIT_TICKET_CATEGORY,
  AUDIT_TICKET_SUBCATEGORY,
  AuditStatus,
  buildMaintenanceSummary,
  formatAuditCode,
  isMacEligible,
  isMaintenanceEligible,
  MAINTENANCE_CHECKS,
  MaintenanceColumn,
  normalizeMac,
  NOT_PRESENT_EQUIPMENT_STATUS,
  resolveFinalStatus,
} from './equipment-audit.util';

// ── Filas ────────────────────────────────────────────────────────────────────

type AuditRow = {
  id: string;
  audit_code: string;
  audit_date: string;
  technician_id: string;
  technician_name: string;
  employee_id: string;
  employee_name: string;
  employee_area: string | null;
  employee_position: string | null;
  employee_email: string | null;
  status: AuditStatus;
  completed_at: Date | null;
  maintenance_ticket_id: string | null;
  maintenance_ticket_display_id: string | null;
  general_notes: string | null;
  survey_equipment_score: number | null;
  survey_equipment_notes: string | null;
  survey_it_service_score: number | null;
  survey_it_service_notes: string | null;
  survey_platform_score: number | null;
  survey_platform_notes: string | null;
  maintenance_shared_accounts: string | null;
  maintenance_notes: string | null;
  created_at: Date;
  updated_at: Date;
} & Record<MaintenanceColumn, boolean | null>;

interface EquipmentItemRow {
  id: string;
  equipment_id: string;
  equipment_code: string | null;
  equipment_brand: string | null;
  equipment_model: string | null;
  equipment_type: string | null;
  physically_present: boolean | null;
  label_marked: boolean | null;
  mac_address: string | null;
  inventory_mac_address: string | null;
  mac_synced_to_inventory: boolean;
  unassigned_during_audit: boolean;
  not_present_reason: string | null;
  sim_verified: boolean | null;
  sim_card_id: string | null;
  sim_code: string | null;
  sim_phone_number: string | null;
  sim_plan_name: string | null;
  sim_notes: string | null;
  equipment_notes: string | null;
}

interface LicenseItemRow {
  id: string;
  assignment_id: string;
  tool_name: string | null;
  tool_code: string | null;
  license_present: boolean | null;
  missing_notes: string | null;
}

interface ListRow {
  id: string;
  audit_code: string;
  audit_date: string;
  technician_id: string;
  technician_name: string;
  employee_id: string;
  employee_name: string;
  employee_area: string | null;
  status: AuditStatus;
  completed_at: Date | null;
  equipment_count: string;
  created_at: Date;
}

const AUDIT_SELECT = `
  SELECT a.*, to_char(a.audit_date, 'YYYY-MM-DD') AS audit_date,
         emp.corporate_email AS employee_email, t.display_id AS maintenance_ticket_display_id
  FROM audits.equipment_audits a
  JOIN employees.employee_records emp ON emp.id = a.employee_id
  LEFT JOIN helpdesk.tickets t ON t.id = a.maintenance_ticket_id
`;

const EQUIPMENT_ITEMS_SELECT = `
  SELECT i.id, i.equipment_id, i.equipment_code, i.equipment_brand, i.equipment_model, i.equipment_type,
         i.physically_present, i.label_marked, i.mac_address, eq.mac_address AS inventory_mac_address,
         i.mac_synced_to_inventory, i.unassigned_during_audit, i.not_present_reason,
         i.sim_verified, i.sim_card_id, s.sim_code, s.phone_number AS sim_phone_number, p.name AS sim_plan_name,
         i.sim_notes, i.equipment_notes
  FROM audits.audit_equipment_items i
  JOIN inventory.equipment eq ON eq.id = i.equipment_id
  LEFT JOIN inventory.sim_cards s ON s.id = i.sim_card_id
  LEFT JOIN inventory.sim_plans p ON p.id = s.plan_id
`;

/** Campo del DTO → columna. Solo lo que aparece aquí se puede escribir. */
const AUDIT_FIELDS: Record<string, string> = {
  auditDate: 'audit_date',
  generalNotes: 'general_notes',
  surveyEquipmentScore: 'survey_equipment_score',
  surveyEquipmentNotes: 'survey_equipment_notes',
  surveyItServiceScore: 'survey_it_service_score',
  surveyItServiceNotes: 'survey_it_service_notes',
  surveyPlatformScore: 'survey_platform_score',
  surveyPlatformNotes: 'survey_platform_notes',
  maintenanceBlower: 'maintenance_blower',
  maintenanceKeyboardCleaning: 'maintenance_keyboard_cleaning',
  maintenanceScreenCleaning: 'maintenance_screen_cleaning',
  maintenanceLogicalUnit: 'maintenance_logical_unit',
  maintenanceDriversUpdated: 'maintenance_drivers_updated',
  maintenanceAntivirusRemoved: 'maintenance_antivirus_removed',
  maintenanceCacheCleaned: 'maintenance_cache_cleaned',
  maintenanceBitlockerActive: 'maintenance_bitlocker_active',
  maintenanceBrowserPasswordsCleared: 'maintenance_browser_passwords_cleared',
  maintenanceOnedriveSynced: 'maintenance_onedrive_synced',
  maintenanceOnedriveBackup: 'maintenance_onedrive_backup',
  maintenanceNoCRootFolders: 'maintenance_no_c_root_folders',
  maintenanceSharedAccounts: 'maintenance_shared_accounts',
  maintenanceNotes: 'maintenance_notes',
};

const EQUIPMENT_ITEM_FIELDS: Record<string, string> = {
  physicallyPresent: 'physically_present',
  labelMarked: 'label_marked',
  macAddress: 'mac_address',
  unassignedDuringAudit: 'unassigned_during_audit',
  notPresentReason: 'not_present_reason',
  simVerified: 'sim_verified',
  simNotes: 'sim_notes',
  equipmentNotes: 'equipment_notes',
};

const LICENSE_ITEM_FIELDS: Record<string, string> = {
  licensePresent: 'license_present',
  missingNotes: 'missing_notes',
};

function camel(column: string): string {
  return column.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function emptyToNull(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? null : value;
}

function photoUrl(email: string | null): string | null {
  return email ? `/api/users/${encodeURIComponent(email)}/photo` : null;
}

/** Lo que se avisa al terminar; se manda después del COMMIT. */
interface CompletionNotice {
  auditId: string;
  auditCode: string;
  status: AuditStatus;
  employeeName: string;
  employeeArea: string | null;
  employeeUserId: string | null;
  managerUserId: string | null;
  ticketDisplayId: string | null;
}

@Injectable()
export class EquipmentAuditService {
  private readonly logger = new Logger(EquipmentAuditService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly helpdesk: HelpdeskService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Técnicos ───────────────────────────────────────────────────────────────

  /**
   * Agentes activos de la mesa de servicio que tienen usuario en la plataforma
   * (el técnico de la auditoría es un `auth.users`), más la sesión actual.
   */
  async technicians(user: User): Promise<{ userId: string; name: string; email: string }[]> {
    const rows = (await this.dataSource.manager.query(
      `SELECT DISTINCT ON (u.id) u.id AS user_id, COALESCE(emp.full_name, ta.name, u.name) AS name, u.email
       FROM helpdesk.ticket_assignees ta
       JOIN auth.users u ON lower(u.email) = lower(ta.email) AND u.is_active AND u.deleted_at IS NULL
       LEFT JOIN employees.employee_records emp ON emp.auth_user_id = u.id AND emp.deleted_at IS NULL
       WHERE ta.is_active
       ORDER BY u.id`,
    )) as { user_id: string; name: string; email: string }[];
    const list = rows.map((r) => ({ userId: r.user_id, name: r.name, email: r.email }));
    if (!list.some((t) => t.userId === user.id)) {
      list.push({ userId: user.id, name: await this.userDisplayName(this.dataSource.manager, user.id, user.name), email: user.email });
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  private async userDisplayName(m: EntityManager, userId: string, fallback: string): Promise<string> {
    const rows = (await m.query(
      `SELECT full_name FROM employees.employee_records WHERE auth_user_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [userId],
    )) as { full_name: string }[];
    return rows[0]?.full_name ?? fallback;
  }

  private async resolveTechnician(m: EntityManager, userId: string): Promise<{ id: string; name: string }> {
    const rows = (await m.query(
      `SELECT id, name FROM auth.users WHERE id = $1 AND is_active AND deleted_at IS NULL`,
      [userId],
    )) as { id: string; name: string }[];
    const u = rows[0];
    if (!u) throw new NotFoundException('El técnico elegido no existe o está inactivo.');
    return { id: u.id, name: await this.userDisplayName(m, u.id, u.name) };
  }

  // ── Alta ───────────────────────────────────────────────────────────────────

  async createAudit(dto: CreateEquipmentAuditDto, user: User) {
    const id = await this.dataSource.transaction(async (m) => {
      const employees = (await m.query(
        `SELECT id, full_name, COALESCE(area, division) AS area, position
         FROM employees.employee_records WHERE id = $1 AND deleted_at IS NULL`,
        [dto.employeeId],
      )) as { id: string; full_name: string; area: string | null; position: string | null }[];
      const employee = employees[0];
      if (!employee) throw new NotFoundException('Colaborador no encontrado.');

      const technician = await this.resolveTechnician(m, dto.technicianUserId ?? user.id);
      const seq = (await m.query(`SELECT nextval('audits.audit_number_seq') AS n`)) as { n: string }[];

      const inserted = (await m.query(
        `INSERT INTO audits.equipment_audits
           (audit_code, audit_date, technician_id, technician_name, employee_id, employee_name,
            employee_area, employee_position, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9) RETURNING id`,
        [
          formatAuditCode(seq[0]?.n ?? '0'),
          dto.auditDate ?? todayInMexico(),
          technician.id,
          technician.name,
          employee.id,
          employee.full_name,
          employee.area,
          employee.position,
          user.id,
        ],
      )) as { id: string }[];
      const auditId = inserted[0]?.id;
      if (!auditId) throw new Error('No se pudo crear la auditoría.');

      // Un renglón por equipo vivo asignado; la SIM ligada al equipo, si hay.
      await m.query(
        `INSERT INTO audits.audit_equipment_items
           (audit_id, equipment_id, equipment_code, equipment_brand, equipment_model, equipment_type, mac_address, sim_card_id)
         SELECT $1, e.id, e.display_id, e.brand, e.model, e.equipment_type, e.mac_address,
                (SELECT s.id FROM inventory.sim_cards s
                 WHERE s.equipment_id = e.id AND s.deleted_at IS NULL AND s.status <> 'cancelada'
                 ORDER BY s.sim_code LIMIT 1)
         FROM inventory.equipment e
         WHERE e.assigned_to_employee_id = $2 AND e.deleted_at IS NULL AND e.status <> 'Baja'
         ORDER BY e.equipment_type, e.display_id`,
        [auditId, employee.id],
      );
      // La MAC que ya tiene el inventario se precarga, pero no cuenta como pendiente de sincronizar.
      await m.query(
        `UPDATE audits.audit_equipment_items SET mac_synced_to_inventory = (mac_address IS NOT NULL) WHERE audit_id = $1`,
        [auditId],
      );

      await m.query(
        `INSERT INTO audits.audit_license_items (audit_id, assignment_id, tool_name, tool_code)
         SELECT $1, a.id, t.name, t.tool_code
         FROM tools.assignments a
         JOIN tools.tools t ON t.id = a.tool_id
         WHERE a.employee_id = $2 AND a.status = 'activo' AND a.deleted_at IS NULL
         ORDER BY t.tool_code`,
        [auditId, employee.id],
      );
      return auditId;
    });
    return this.getAuditData(id);
  }

  // ── Lectura ────────────────────────────────────────────────────────────────

  private async fetchAudit(m: EntityManager, id: string, forUpdate = false): Promise<AuditRow> {
    if (forUpdate) {
      const locked = (await m.query(
        `SELECT id FROM audits.equipment_audits WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [id],
      )) as unknown[];
      if (locked.length === 0) throw new NotFoundException('Auditoría no encontrada.');
    }
    const rows = (await m.query(`${AUDIT_SELECT} WHERE a.id = $1 AND a.deleted_at IS NULL`, [id])) as AuditRow[];
    const row = rows[0];
    if (!row) throw new NotFoundException('Auditoría no encontrada.');
    return row;
  }

  private async equipmentItems(m: EntityManager, auditId: string): Promise<EquipmentItemRow[]> {
    return (await m.query(`${EQUIPMENT_ITEMS_SELECT} WHERE i.audit_id = $1 ORDER BY i.equipment_type, i.equipment_code`, [
      auditId,
    ])) as EquipmentItemRow[];
  }

  private async licenseItems(m: EntityManager, auditId: string): Promise<LicenseItemRow[]> {
    return (await m.query(
      `SELECT id, assignment_id, tool_name, tool_code, license_present, missing_notes
       FROM audits.audit_license_items WHERE audit_id = $1 ORDER BY tool_code`,
      [auditId],
    )) as LicenseItemRow[];
  }

  private toEquipmentItemView(i: EquipmentItemRow) {
    return {
      id: i.id,
      equipmentId: i.equipment_id,
      equipmentCode: i.equipment_code,
      brand: i.equipment_brand,
      model: i.equipment_model,
      type: i.equipment_type,
      macEligible: isMacEligible(i.equipment_type),
      physicallyPresent: i.physically_present,
      labelMarked: i.label_marked,
      macAddress: i.mac_address,
      inventoryMacAddress: i.inventory_mac_address,
      macSyncedToInventory: i.mac_synced_to_inventory,
      unassignedDuringAudit: i.unassigned_during_audit,
      notPresentReason: i.not_present_reason,
      simVerified: i.sim_verified,
      simCard: i.sim_card_id
        ? { id: i.sim_card_id, simCode: i.sim_code, phoneNumber: i.sim_phone_number, plan: i.sim_plan_name }
        : null,
      simNotes: i.sim_notes,
      equipmentNotes: i.equipment_notes,
    };
  }

  private toLicenseItemView(l: LicenseItemRow) {
    return {
      id: l.id,
      assignmentId: l.assignment_id,
      toolName: l.tool_name,
      toolCode: l.tool_code,
      licensePresent: l.license_present,
      missingNotes: l.missing_notes,
    };
  }

  async getAuditData(id: string) {
    const m = this.dataSource.manager;
    const a = await this.fetchAudit(m, id);
    const [equipment, licenses] = await Promise.all([this.equipmentItems(m, id), this.licenseItems(m, id)]);

    const maintenanceSection: Record<string, boolean | string | null> = {};
    for (const [column] of MAINTENANCE_CHECKS) maintenanceSection[camel(column)] = a[column];
    maintenanceSection.maintenanceSharedAccounts = a.maintenance_shared_accounts;
    maintenanceSection.maintenanceNotes = a.maintenance_notes;

    return {
      id: a.id,
      auditCode: a.audit_code,
      auditDate: a.audit_date,
      status: a.status,
      completedAt: a.completed_at ? new Date(a.completed_at).toISOString() : null,
      generalNotes: a.general_notes,
      employee: {
        id: a.employee_id,
        fullName: a.employee_name,
        area: a.employee_area,
        position: a.employee_position,
        email: a.employee_email,
        photoUrl: photoUrl(a.employee_email),
      },
      technician: { id: a.technician_id, fullName: a.technician_name },
      maintenanceTicket: a.maintenance_ticket_id
        ? { id: a.maintenance_ticket_id, displayId: a.maintenance_ticket_display_id }
        : null,
      maintenanceApplies: equipment.some((e) => isMaintenanceEligible(e.equipment_type)),
      equipmentItems: equipment.map((e) => this.toEquipmentItemView(e)),
      licenseItems: licenses.map((l) => this.toLicenseItemView(l)),
      maintenanceSection,
      surveySection: {
        surveyEquipmentScore: a.survey_equipment_score,
        surveyEquipmentNotes: a.survey_equipment_notes,
        surveyItServiceScore: a.survey_it_service_score,
        surveyItServiceNotes: a.survey_it_service_notes,
        surveyPlatformScore: a.survey_platform_score,
        surveyPlatformNotes: a.survey_platform_notes,
      },
      createdAt: new Date(a.created_at).toISOString(),
      updatedAt: new Date(a.updated_at).toISOString(),
    };
  }

  async getAudits(query: QueryEquipmentAuditsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const params: unknown[] = [];
    const add = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };
    const where = ['a.deleted_at IS NULL'];
    if (query.employeeId) where.push(`a.employee_id = ${add(query.employeeId)}`);
    if (query.technicianId) where.push(`a.technician_id = ${add(query.technicianId)}`);
    if (query.status) where.push(`a.status = ${add(query.status)}`);
    if (query.dateFrom) where.push(`a.audit_date >= ${add(query.dateFrom)}::date`);
    if (query.dateTo) where.push(`a.audit_date <= ${add(query.dateTo)}::date`);

    const m = this.dataSource.manager;
    const count = (await m.query(
      `SELECT count(*) AS total FROM audits.equipment_audits a WHERE ${where.join(' AND ')}`,
      params,
    )) as { total: string }[];
    const rows = (await m.query(
      `SELECT a.id, a.audit_code, to_char(a.audit_date, 'YYYY-MM-DD') AS audit_date, a.technician_id, a.technician_name,
              a.employee_id, a.employee_name, a.employee_area, a.status, a.completed_at, a.created_at,
              (SELECT count(*) FROM audits.audit_equipment_items i WHERE i.audit_id = a.id) AS equipment_count
       FROM audits.equipment_audits a
       WHERE ${where.join(' AND ')}
       ORDER BY a.audit_date DESC, a.created_at DESC
       LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      params,
    )) as ListRow[];

    const total = Number(count[0]?.total ?? 0);
    return {
      data: rows.map((r) => ({
        id: r.id,
        auditCode: r.audit_code,
        auditDate: r.audit_date,
        technician: { id: r.technician_id, fullName: r.technician_name },
        employee: { id: r.employee_id, fullName: r.employee_name, area: r.employee_area },
        status: r.status,
        completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null,
        equipmentCount: Number(r.equipment_count),
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getAuditStats() {
    const today = todayInMexico();
    const rows = (await this.dataSource.manager.query(
      `SELECT
         count(*) AS total,
         count(*) FILTER (WHERE a.status = 'completada') AS completadas,
         count(*) FILTER (WHERE a.status = 'en_progreso') AS en_progreso,
         count(*) FILTER (WHERE a.status = 'con_observaciones') AS con_observaciones,
         count(*) FILTER (WHERE date_trunc('month', a.audit_date) = date_trunc('month', $1::date)) AS this_month,
         (SELECT count(*) FROM audits.audit_equipment_items i JOIN audits.equipment_audits x ON x.id = i.audit_id
          WHERE x.deleted_at IS NULL AND i.physically_present = false) AS sin_presencia,
         (SELECT count(*) FROM audits.audit_equipment_items i JOIN audits.equipment_audits x ON x.id = i.audit_id
          WHERE x.deleted_at IS NULL AND x.status <> 'en_progreso' AND i.mac_synced_to_inventory
            AND i.mac_address IS NOT NULL) AS macs
       FROM audits.equipment_audits a
       WHERE a.deleted_at IS NULL`,
      [today],
    )) as Record<string, string>[];
    const r = rows[0] ?? {};
    return {
      total: Number(r.total ?? 0),
      completadas: Number(r.completadas ?? 0),
      enProgreso: Number(r.en_progreso ?? 0),
      conObservaciones: Number(r.con_observaciones ?? 0),
      thisMonth: Number(r.this_month ?? 0),
      equiposSinPresencia: Number(r.sin_presencia ?? 0),
      macsSincronizadas: Number(r.macs ?? 0),
    };
  }

  // ── Guardado parcial ───────────────────────────────────────────────────────

  private assertEditable(a: AuditRow): void {
    if (a.status !== 'en_progreso') throw new ConflictException('La auditoría ya fue completada y no se puede modificar.');
  }

  private async touch(m: EntityManager, auditId: string, user: User): Promise<void> {
    await m.query(`UPDATE audits.equipment_audits SET updated_at = NOW(), updated_by = $1 WHERE id = $2`, [user.id, auditId]);
  }

  /** Escribe solo los campos presentes en `dto` y mapeados en `fields`. */
  private async patchRow(
    m: EntityManager,
    table: string,
    fields: Record<string, string>,
    dto: object,
    where: { sql: string; params: unknown[] },
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [key, column] of Object.entries(fields)) {
      const value = (dto as Record<string, unknown>)[key];
      if (value === undefined) continue;
      params.push(emptyToNull(value));
      sets.push(`${column} = $${params.length}`);
    }
    for (const [column, value] of Object.entries(extra)) {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    }
    if (sets.length === 0) return;
    const offset = params.length;
    const whereSql = where.sql.replace(/\$(\d+)/g, (_, n: string) => `$${Number(n) + offset}`);
    await m.query(`UPDATE ${table} SET ${sets.join(', ')} WHERE ${whereSql}`, [...params, ...where.params]);
  }

  async updateAuditProgress(id: string, dto: UpdateEquipmentAuditDto, user: User) {
    if (dto.status === 'completada') {
      // Lo que venga junto con el estado se guarda antes de cerrar.
      const rest: UpdateEquipmentAuditDto = { ...dto };
      delete rest.status;
      if (Object.keys(rest).length > 0) await this.updateAuditProgress(id, rest, user);
      return this.completeAudit(id, user);
    }

    await this.dataSource.transaction(async (m) => {
      this.assertEditable(await this.fetchAudit(m, id, true));
      const extra: Record<string, unknown> = { updated_at: new Date(), updated_by: user.id };
      if (dto.technicianUserId) {
        const technician = await this.resolveTechnician(m, dto.technicianUserId);
        extra.technician_id = technician.id;
        extra.technician_name = technician.name;
      }
      await this.patchRow(m, 'audits.equipment_audits', AUDIT_FIELDS, dto, { sql: 'id = $1', params: [id] }, extra);
    });
    return this.getAuditData(id);
  }

  async updateEquipmentItem(auditId: string, itemId: string, dto: UpdateAuditEquipmentItemDto, user: User) {
    const patch: UpdateAuditEquipmentItemDto = { ...dto };
    const extra: Record<string, unknown> = {};
    if (dto.macAddress !== undefined) {
      const mac = normalizeMac(dto.macAddress);
      if (mac === undefined) throw new BadRequestException('La MAC debe tener el formato XX:XX:XX:XX:XX:XX.');
      patch.macAddress = mac;
    }

    await this.dataSource.transaction(async (m) => {
      this.assertEditable(await this.fetchAudit(m, auditId, true));
      const items = (await m.query(
        `SELECT i.id, i.equipment_type, eq.mac_address AS inventory_mac
         FROM audits.audit_equipment_items i JOIN inventory.equipment eq ON eq.id = i.equipment_id
         WHERE i.id = $1 AND i.audit_id = $2`,
        [itemId, auditId],
      )) as { id: string; equipment_type: string | null; inventory_mac: string | null }[];
      const item = items[0];
      if (!item) throw new NotFoundException('Equipo de la auditoría no encontrado.');

      if (patch.macAddress !== undefined) {
        if (patch.macAddress && !isMacEligible(item.equipment_type)) {
          throw new BadRequestException('Este tipo de equipo no lleva MAC.');
        }
        // Pendiente de sincronizar solo si difiere de la que ya tiene el inventario.
        extra.mac_synced_to_inventory = patch.macAddress === null || patch.macAddress === item.inventory_mac;
      }
      // Si vuelve a estar presente, ya no hay nada que desasignar ni explicar.
      if (patch.physicallyPresent === true) {
        patch.unassignedDuringAudit = false;
        patch.notPresentReason = null;
      }
      await this.patchRow(
        m,
        'audits.audit_equipment_items',
        EQUIPMENT_ITEM_FIELDS,
        patch,
        { sql: 'id = $1', params: [itemId] },
        extra,
      );
      await this.touch(m, auditId, user);
    });
    return this.getAuditData(auditId);
  }

  async updateLicenseItem(auditId: string, itemId: string, dto: UpdateAuditLicenseItemDto, user: User) {
    const patch: UpdateAuditLicenseItemDto = { ...dto };
    if (patch.licensePresent === true) patch.missingNotes = null;

    await this.dataSource.transaction(async (m) => {
      this.assertEditable(await this.fetchAudit(m, auditId, true));
      const found = (await m.query(`SELECT 1 FROM audits.audit_license_items WHERE id = $1 AND audit_id = $2`, [
        itemId,
        auditId,
      ])) as unknown[];
      if (found.length === 0) throw new NotFoundException('Licencia de la auditoría no encontrada.');
      await this.patchRow(m, 'audits.audit_license_items', LICENSE_ITEM_FIELDS, patch, { sql: 'id = $1', params: [itemId] });
      await this.touch(m, auditId, user);
    });
    return this.getAuditData(auditId);
  }

  // ── Completar ──────────────────────────────────────────────────────────────

  /**
   * En una transacción: sincroniza las MAC nuevas al inventario, desasigna los
   * equipos marcados, registra el mantenimiento como ticket cerrado y cierra la
   * auditoría. Las notificaciones salen después del COMMIT y nunca la revierten.
   */
  async completeAudit(id: string, user: User) {
    const notice = await this.dataSource.transaction(async (m): Promise<CompletionNotice> => {
      const a = await this.fetchAudit(m, id, true);
      this.assertEditable(a);
      const [equipment, licenses] = await Promise.all([this.equipmentItems(m, id), this.licenseItems(m, id)]);

      const pending = equipment.filter((e) => e.physically_present === null).length + licenses.filter((l) => l.license_present === null).length;
      if (pending > 0) {
        throw new BadRequestException(
          `Faltan ${pending} ${pending === 1 ? 'verificación' : 'verificaciones'} de equipos o licencias antes de completar.`,
        );
      }

      for (const e of equipment) {
        if (e.mac_address && !e.mac_synced_to_inventory) {
          await m.query(`UPDATE inventory.equipment SET mac_address = $1, updated_at = NOW() WHERE id = $2`, [
            e.mac_address,
            e.equipment_id,
          ]);
          await this.equipmentHistory(m, e.equipment_id, user, 'ACTUALIZADO', 'macAddress', e.inventory_mac_address, e.mac_address, `MAC registrada en la auditoría ${a.audit_code}`);
          await m.query(`UPDATE audits.audit_equipment_items SET mac_synced_to_inventory = true WHERE id = $1`, [e.id]);
        }

        if (e.unassigned_during_audit) {
          // Solo si sigue asignado a este colaborador: pudo reasignarse durante la auditoría.
          const released = (await m.query(
            `UPDATE inventory.equipment
             SET assigned_to_employee_id = NULL, assignment_date = NULL, responsiva = NULL, status = $1, updated_at = NOW()
             WHERE id = $2 AND assigned_to_employee_id = $3 AND deleted_at IS NULL
             RETURNING id`,
            [NOT_PRESENT_EQUIPMENT_STATUS, e.equipment_id, a.employee_id],
          )) as unknown[];
          if (released.length > 0) {
            const reason = e.not_present_reason?.trim();
            await this.equipmentHistory(m, e.equipment_id, user, 'DESASIGNADO', 'assignedToEmployeeId', a.employee_id, null, `No presente en la auditoría ${a.audit_code}${reason ? `: ${reason}` : ''}`);
          }
        }
      }

      const ticket = await this.registerMaintenanceTicket(m, a, equipment, user);
      const status = resolveFinalStatus(
        equipment.map((e) => ({ physicallyPresent: e.physically_present })),
        licenses.map((l) => ({ licensePresent: l.license_present })),
      );
      await m.query(
        `UPDATE audits.equipment_audits
         SET status = $1, completed_at = NOW(), maintenance_ticket_id = $2, updated_at = NOW(), updated_by = $3
         WHERE id = $4`,
        [status, ticket?.id ?? null, user.id, id],
      );

      const people = (await m.query(
        `SELECT emp.auth_user_id AS employee_user_id, boss.auth_user_id AS manager_user_id
         FROM employees.employee_records emp
         LEFT JOIN employees.employee_records boss ON boss.id = emp.direct_report_to_id AND boss.deleted_at IS NULL
         WHERE emp.id = $1`,
        [a.employee_id],
      )) as { employee_user_id: string | null; manager_user_id: string | null }[];

      return {
        auditId: id,
        auditCode: a.audit_code,
        status,
        employeeName: a.employee_name,
        employeeArea: a.employee_area,
        employeeUserId: people[0]?.employee_user_id ?? null,
        managerUserId: people[0]?.manager_user_id ?? null,
        ticketDisplayId: ticket?.displayId ?? null,
      };
    });

    await this.notifyCompleted(notice, user);
    return this.getAuditData(id);
  }

  /** Solo hay mantenimiento que registrar si se auditó una laptop, PC o monitor. */
  private async registerMaintenanceTicket(
    m: EntityManager,
    a: AuditRow,
    equipment: EquipmentItemRow[],
    user: User,
  ): Promise<{ id: string; displayId: string } | null> {
    const eligible = equipment.filter((e) => isMaintenanceEligible(e.equipment_type));
    if (eligible.length === 0) return null;

    const requester = (await m.query(`SELECT auth_user_id FROM employees.employee_records WHERE id = $1`, [
      a.employee_id,
    ])) as { auth_user_id: string | null }[];
    const checks = Object.fromEntries(MAINTENANCE_CHECKS.map(([column]) => [column, a[column]])) as Record<
      MaintenanceColumn,
      boolean | null
    >;
    const main = eligible.find((e) => e.physically_present !== false) ?? eligible[0];

    const ticket = await this.helpdesk.createClosedTicket(m, {
      requester: { userId: requester[0]?.auth_user_id ?? null, name: a.employee_name, area: a.employee_area },
      categorySlug: AUDIT_TICKET_CATEGORY,
      subcategory: AUDIT_TICKET_SUBCATEGORY,
      equipmentDisplayId: main?.equipment_code ?? null,
      title: `Mantenimiento preventivo — ${a.employee_name} — ${a.audit_code}`,
      description: buildMaintenanceSummary({
        auditCode: a.audit_code,
        checks,
        sharedAccounts: a.maintenance_shared_accounts,
        notes: a.maintenance_notes,
        equipment: equipment.map((e) => ({
          code: e.equipment_code,
          label: [e.equipment_type, e.equipment_brand, e.equipment_model].filter(Boolean).join(' '),
          present: e.physically_present,
          unassigned: e.unassigned_during_audit,
        })),
      }),
      assigneeEmail: AUDIT_MAINTENANCE_ASSIGNEE_EMAIL,
      behalfReason: `Mantenimiento preventivo de la auditoría ${a.audit_code} (TIC-RE-18)`,
      actor: user,
    });
    return { id: ticket.id, displayId: ticket.displayId };
  }

  private async equipmentHistory(
    m: EntityManager,
    equipmentId: string,
    user: User,
    action: string,
    field: string,
    oldValue: string | null,
    newValue: string | null,
    notes: string,
  ): Promise<void> {
    await m.query(
      `INSERT INTO inventory.equipment_history
         (equipment_id, changed_by_id, changed_by_name, action, field_changed, old_value, new_value, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [equipmentId, user.id, user.name, action, field, oldValue, newValue, notes],
    );
  }

  // ── Notificaciones ─────────────────────────────────────────────────────────

  /** Cuatro avisos; cada uno por separado para que un fallo no impida los demás. */
  private async notifyCompleted(n: CompletionNotice, actor: User): Promise<void> {
    const byEmail = (await this.dataSource.manager.query(
      `SELECT id, lower(email) AS email FROM auth.users
       WHERE lower(email) IN (lower($1), lower($2)) AND is_active AND deleted_at IS NULL`,
      [AUDIT_TD_OWNER_EMAIL, AUDIT_MAINTENANCE_ASSIGNEE_EMAIL],
    )) as { id: string; email: string }[];
    const userOf = (email: string) => byEmail.find((u) => u.email === email.toLowerCase())?.id ?? null;
    const area = n.employeeArea ? ` (${n.employeeArea})` : '';

    const notices: { recipientId: string | null; title: string; message: string }[] = [
      {
        recipientId: n.employeeUserId,
        title: `Auditoría ${n.auditCode} completada`,
        message: `Gracias por permitir la auditoría de equipos y mantenimiento preventivo. Tu auditoría ${n.auditCode} ha sido completada.`,
      },
      {
        recipientId: n.managerUserId,
        title: `Auditoría de equipos — ${n.employeeName}`,
        message: `${n.employeeName} ha completado la auditoría de equipos TIC-RE-18 y mantenimiento preventivo de este semestre.`,
      },
      {
        recipientId: userOf(AUDIT_TD_OWNER_EMAIL),
        title: `Auditoría ${n.auditCode} completada`,
        message: `Auditoría ${n.auditCode} completada — ${n.employeeName}${area}${n.status === 'con_observaciones' ? '. Cerró con observaciones.' : ''}`,
      },
      {
        recipientId: userOf(AUDIT_MAINTENANCE_ASSIGNEE_EMAIL),
        title: `Auditoría ${n.auditCode} completada`,
        message:
          `Auditoría ${n.auditCode} completada — ${n.employeeName}.` +
          (n.ticketDisplayId ? ` Ticket de mantenimiento ${n.ticketDisplayId} creado.` : ' Sin ticket de mantenimiento (no hubo equipos de cómputo).'),
      },
    ];

    for (const notice of notices) {
      if (!notice.recipientId) {
        this.logger.warn(`Sin usuario para "${notice.title}" (${notice.message.slice(0, 60)}…); se omite.`);
        continue;
      }
      try {
        await this.notifications.create({
          recipientId: notice.recipientId,
          senderId: actor.id,
          senderName: actor.name,
          title: notice.title,
          message: notice.message,
          type: 'informativa',
          module: 'auditoria-equipos',
          entityId: n.auditId,
          entityType: 'equipment_audit',
          actionUrl: `/transformacion/auditoria-equipos/${n.auditId}`,
        });
      } catch (err) {
        this.logger.error(
          `No se pudo notificar la auditoría ${n.auditCode}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
}
