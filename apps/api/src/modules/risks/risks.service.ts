import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { todayInMexico } from '../../common/business-date';
import { User } from '../auth/entities/user.entity';
import { userHasPermission } from '../auth/permissions.util';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateRiskDto, UpdateRiskDto } from './dto/risk.dto';
import { Risk } from './entities/risk.entity';
import { calculateRisk, RiskLevel } from './risk-calculation';
import {
  ACCENTED,
  buildOwnerNotification,
  normalizeSearchWords,
  OWNER_SEARCH_MAX_RESULTS,
  UNACCENTED,
} from './risk-owner.util';

export interface RiskItem {
  id: string;
  category: string;
  threat: string;
  vulnerability: string;
  affectedAsset: string;
  risk: string;
  vulnerabilityScore: number;
  severityScore: number;
  probabilityScore: number;
  riskValue: number;
  control: string;
  controlEfficacy: number;
  residualRisk: number;
  level: RiskLevel;
  reportedAt: string | null;
  mitigationStrategy: string | null;
  actions: string | null;
  estimatedResolutionDate: string | null;
  ownerUserId: string;
  /** Nombre del dueño (copia guardada al asignarlo). */
  owner: string;
  actionStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface RiskList {
  data: RiskItem[];
  /** Máximo `updated_at` de los riesgos activos; null si no hay ninguno. */
  lastUpdate: string | null;
}

/** Lo único que expone la búsqueda de candidatos a dueño. */
export interface OwnerCandidate {
  id: string;
  name: string;
  email: string;
}

interface OwnerRow {
  id: string;
  name: string;
  is_active: boolean;
}

/** Texto vacío o solo espacios se guarda como null en los campos opcionales. */
function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

@Injectable()
export class RisksService {
  private readonly logger = new Logger(RisksService.name);

  constructor(
    @InjectRepository(Risk) private readonly risksRepo: Repository<Risk>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    private readonly notificationsService: NotificationsService,
  ) {}

  private toItem(r: Risk): RiskItem {
    return {
      id: r.id,
      category: r.category,
      threat: r.threat,
      vulnerability: r.vulnerability,
      affectedAsset: r.affectedAsset,
      risk: r.risk,
      vulnerabilityScore: r.vulnerabilityScore,
      severityScore: r.severityScore,
      probabilityScore: r.probabilityScore,
      riskValue: r.riskValue,
      control: r.control,
      controlEfficacy: r.controlEfficacy,
      residualRisk: r.residualRisk,
      level: calculateRisk(
        r.vulnerabilityScore,
        r.severityScore,
        r.probabilityScore,
        r.controlEfficacy,
      ).level,
      reportedAt: r.reportedAt,
      mitigationStrategy: r.mitigationStrategy,
      actions: r.actions,
      estimatedResolutionDate: r.estimatedResolutionDate,
      ownerUserId: r.ownerUserId,
      owner: r.owner,
      actionStatus: r.actionStatus,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  private async findActiveOrFail(id: string): Promise<Risk> {
    const risk = await this.risksRepo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!risk) throw new NotFoundException('Riesgo no encontrado.');
    return risk;
  }

  // ── Dueño ──────────────────────────────────────────────────────────────────

  /**
   * Usuarios activos cuyo nombre (del expediente si está vinculado, o el de la
   * cuenta) o correo contiene cada palabra buscada, sin mayúsculas ni acentos.
   * Solo id, nombre y correo.
   */
  async searchOwnerCandidates(query?: string): Promise<OwnerCandidate[]> {
    const words = normalizeSearchWords(query);
    if (words.length === 0) return [];

    const params: unknown[] = [ACCENTED, UNACCENTED];
    const conditions = words.map((word) => {
      params.push(`%${word}%`);
      const p = `$${params.length}`;
      return `(translate(lower(COALESCE(e.full_name, u.name)), $1, $2) LIKE ${p} ESCAPE '\\'
               OR translate(lower(u.name), $1, $2) LIKE ${p} ESCAPE '\\'
               OR lower(u.email) LIKE ${p} ESCAPE '\\')`;
    });
    params.push(OWNER_SEARCH_MAX_RESULTS);

    const rows = (await this.risksRepo.manager.query(
      `SELECT u.id, COALESCE(e.full_name, u.name) AS name, u.email
       FROM auth.users u
       LEFT JOIN LATERAL (
         SELECT full_name FROM employees.employee_records
         WHERE auth_user_id = u.id AND deleted_at IS NULL
         ORDER BY created_at DESC LIMIT 1
       ) e ON true
       WHERE u.deleted_at IS NULL AND u.is_active = true
         AND ${conditions.join(' AND ')}
       ORDER BY name ASC
       LIMIT $${params.length}`,
      params,
    )) as OwnerCandidate[];

    return rows.map((r) => ({ id: r.id, name: r.name, email: r.email }));
  }

  /** El dueño debe existir y estar activo; devuelve el nombre a guardar como copia. */
  private async resolveActiveOwner(userId: string): Promise<{ id: string; name: string }> {
    const rows = (await this.risksRepo.manager.query(
      `SELECT u.id, COALESCE(e.full_name, u.name) AS name, u.is_active
       FROM auth.users u
       LEFT JOIN LATERAL (
         SELECT full_name FROM employees.employee_records
         WHERE auth_user_id = u.id AND deleted_at IS NULL
         ORDER BY created_at DESC LIMIT 1
       ) e ON true
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [userId],
    )) as OwnerRow[];

    const owner = rows[0];
    if (!owner) throw new BadRequestException('El dueño indicado no existe.');
    if (!owner.is_active) throw new BadRequestException('El dueño indicado está inactivo.');
    return { id: owner.id, name: owner.name };
  }

  /**
   * Avisa al dueño dentro de la app. Nunca lanza: un fallo se registra y el
   * riesgo ya quedó guardado. No se notifica a quien se asigna a sí mismo.
   */
  private async notifyOwner(risk: Risk, actor: User): Promise<void> {
    try {
      if (risk.ownerUserId === actor.id) return;

      const recipient = await this.usersRepo.findOne({
        where: { id: risk.ownerUserId },
        relations: { roles: { permissions: true }, userPermissions: { permission: true } },
      });
      const { level } = calculateRisk(
        risk.vulnerabilityScore,
        risk.severityScore,
        risk.probabilityScore,
        risk.controlEfficacy,
      );
      const content = buildOwnerNotification({
        actorName: actor.name ?? actor.email,
        risk: risk.risk,
        residualRisk: risk.residualRisk,
        level,
        canOpenMatrix: recipient ? userHasPermission(recipient, 'sgsi', 'riesgos', 'read') : false,
      });

      await this.notificationsService.create({
        recipientId: risk.ownerUserId,
        senderId: actor.id,
        senderName: actor.name ?? actor.email,
        title: content.title,
        message: content.message,
        type: content.type,
        module: 'sgsi',
        entityId: risk.id,
        entityType: 'risk',
        ...(content.actionUrl ? { actionUrl: content.actionUrl } : {}),
      });
    } catch (err) {
      this.logger.error(
        `No se pudo notificar al dueño del riesgo ${risk.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  /** Todos los activos, sin paginar: la tabla ordena en el cliente. */
  async list(): Promise<RiskList> {
    const rows = await this.risksRepo.find({
      where: { deletedAt: IsNull() },
      order: { updatedAt: 'DESC' },
    });
    const last = rows.reduce<Date | null>(
      (max, r) => (max === null || r.updatedAt > max ? r.updatedAt : max),
      null,
    );
    return { data: rows.map((r) => this.toItem(r)), lastUpdate: last?.toISOString() ?? null };
  }

  async get(id: string): Promise<RiskItem> {
    return this.toItem(await this.findActiveOrFail(id));
  }

  async create(dto: CreateRiskDto, user: User): Promise<RiskItem> {
    const owner = await this.resolveActiveOwner(dto.ownerUserId);
    const { riskValue, residualRisk } = calculateRisk(
      dto.vulnerabilityScore,
      dto.severityScore,
      dto.probabilityScore,
      dto.controlEfficacy,
    );

    const saved = await this.risksRepo.save(
      this.risksRepo.create({
        category: dto.category,
        threat: dto.threat,
        vulnerability: dto.vulnerability,
        affectedAsset: dto.affectedAsset,
        risk: dto.risk,
        vulnerabilityScore: dto.vulnerabilityScore,
        severityScore: dto.severityScore,
        probabilityScore: dto.probabilityScore,
        riskValue,
        control: dto.control,
        controlEfficacy: dto.controlEfficacy,
        residualRisk,
        reportedAt: dto.reportedAt ?? todayInMexico(),
        mitigationStrategy: emptyToNull(dto.mitigationStrategy),
        actions: emptyToNull(dto.actions),
        estimatedResolutionDate: dto.estimatedResolutionDate ?? null,
        ownerUserId: owner.id,
        owner: owner.name,
        actionStatus: dto.actionStatus,
        createdBy: user.id,
        updatedBy: user.id,
      }),
    );

    await this.notifyOwner(saved, user);
    return this.toItem(saved);
  }

  async update(id: string, dto: UpdateRiskDto, user: User): Promise<RiskItem> {
    const risk = await this.findActiveOrFail(id);

    // Solo un dueño distinto se valida (activo) y se notifica; conservar al
    // actual no se bloquea aunque hoy esté inactivo.
    const ownerChanged = dto.ownerUserId !== undefined && dto.ownerUserId !== risk.ownerUserId;
    if (ownerChanged && dto.ownerUserId !== undefined) {
      const owner = await this.resolveActiveOwner(dto.ownerUserId);
      risk.ownerUserId = owner.id;
      risk.owner = owner.name;
    }

    if (dto.category !== undefined) risk.category = dto.category;
    if (dto.threat !== undefined) risk.threat = dto.threat;
    if (dto.vulnerability !== undefined) risk.vulnerability = dto.vulnerability;
    if (dto.affectedAsset !== undefined) risk.affectedAsset = dto.affectedAsset;
    if (dto.risk !== undefined) risk.risk = dto.risk;
    if (dto.vulnerabilityScore !== undefined) risk.vulnerabilityScore = dto.vulnerabilityScore;
    if (dto.severityScore !== undefined) risk.severityScore = dto.severityScore;
    if (dto.probabilityScore !== undefined) risk.probabilityScore = dto.probabilityScore;
    if (dto.control !== undefined) risk.control = dto.control;
    if (dto.controlEfficacy !== undefined) risk.controlEfficacy = dto.controlEfficacy;
    if (dto.actionStatus !== undefined) risk.actionStatus = dto.actionStatus;
    if (dto.reportedAt !== undefined) risk.reportedAt = dto.reportedAt;
    if (dto.mitigationStrategy !== undefined) risk.mitigationStrategy = emptyToNull(dto.mitigationStrategy);
    if (dto.actions !== undefined) risk.actions = emptyToNull(dto.actions);
    if (dto.estimatedResolutionDate !== undefined) {
      risk.estimatedResolutionDate = dto.estimatedResolutionDate;
    }

    // Siempre se recalculan con los valores resultantes, nunca con lo que mande el cliente.
    const { riskValue, residualRisk } = calculateRisk(
      risk.vulnerabilityScore,
      risk.severityScore,
      risk.probabilityScore,
      risk.controlEfficacy,
    );
    risk.riskValue = riskValue;
    risk.residualRisk = residualRisk;
    risk.updatedBy = user.id;

    const saved = await this.risksRepo.save(risk);
    if (ownerChanged) await this.notifyOwner(saved, user);
    return this.toItem(saved);
  }

  /** Baja lógica: el registro se conserva y deja de listarse. */
  async remove(id: string, user: User): Promise<{ deleted: true }> {
    const risk = await this.findActiveOrFail(id);
    risk.deletedAt = new Date();
    risk.deletedBy = user.id;
    risk.updatedBy = user.id;
    await this.risksRepo.save(risk);
    return { deleted: true };
  }
}
