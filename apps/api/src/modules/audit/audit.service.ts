import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  PlatformErrorInput,
  QueryActivityDto,
  QueryErrorsDto,
  QuerySecurityDto,
  QuerySessionsDto,
  SecurityEventInput,
  UpdateModuleConfigDto,
  UserActivityInput,
  UserSessionInput,
} from './dto/audit.dto';
import { AuditModuleConfig } from './entities/audit-module-config.entity';
import { PlatformError } from './entities/platform-error.entity';
import { SecurityEvent } from './entities/security-event.entity';
import { UserActivity } from './entities/user-activity.entity';
import { UserSession } from './entities/user-session.entity';

const DEFAULT_LIMIT = 50;

/** Una sesión sin actividad por más de esto se considera terminada. */
const SESSION_IDLE_MINUTES = 30;

/**
 * La configuración por módulo se cachea: el interceptor la consulta en cada
 * escritura de la plataforma y pegarle a la tabla cada vez convertiría una
 * mejora de observabilidad en un impuesto de latencia sobre todo el sistema.
 */
const CONFIG_TTL_MS = 60_000;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private configCache: Map<string, AuditModuleConfig> | null = null;
  private configLoadedAt = 0;

  constructor(
    @InjectRepository(SecurityEvent) private readonly securityRepo: Repository<SecurityEvent>,
    @InjectRepository(UserActivity) private readonly activityRepo: Repository<UserActivity>,
    @InjectRepository(PlatformError) private readonly errorsRepo: Repository<PlatformError>,
    @InjectRepository(UserSession) private readonly sessionsRepo: Repository<UserSession>,
    @InjectRepository(AuditModuleConfig) private readonly configRepo: Repository<AuditModuleConfig>,
  ) {}

  // -------------------------------------------------------------------------
  // Escritura de logs — fire and forget
  // -------------------------------------------------------------------------

  /**
   * Un fallo al auditar nunca debe tumbar la operación auditada: se registra en
   * el log de la aplicación y se sigue. Por eso todos los `log*` resuelven
   * siempre y los llamadores no necesitan try/catch.
   */
  async logSecurity(input: SecurityEventInput): Promise<void> {
    try {
      await this.securityRepo.save(this.securityRepo.create({
        eventType: input.eventType,
        userId: input.userId ?? null,
        userEmail: input.userEmail ?? null,
        ipAddress: normalizeIp(input.ipAddress),
        userAgent: input.userAgent ?? null,
        module: input.module ?? null,
        resourceId: input.resourceId ?? null,
        details: input.details ?? null,
        severity: input.severity ?? 'info',
      }));
    } catch (err) {
      this.logger.error(`No se pudo registrar el evento de seguridad: ${(err as Error).message}`);
    }
  }

  async logActivity(input: UserActivityInput): Promise<void> {
    try {
      await this.activityRepo.save(this.activityRepo.create({
        userId: input.userId ?? null,
        userEmail: input.userEmail ?? null,
        userName: input.userName ?? null,
        department: input.department ?? null,
        action: input.action,
        module: input.module,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        entityName: input.entityName ?? null,
        changes: input.changes ?? null,
        ipAddress: normalizeIp(input.ipAddress),
      }));
    } catch (err) {
      this.logger.error(`No se pudo registrar la actividad: ${(err as Error).message}`);
    }
  }

  async logError(input: PlatformErrorInput): Promise<void> {
    try {
      await this.errorsRepo.save(this.errorsRepo.create({
        errorCode: input.errorCode ?? null,
        message: input.message,
        stackTrace: input.stackTrace ?? null,
        module: input.module ?? null,
        endpoint: input.endpoint ?? null,
        httpMethod: input.httpMethod ?? null,
        httpStatus: input.httpStatus ?? null,
        userId: input.userId ?? null,
        userEmail: input.userEmail ?? null,
        requestBody: redact(input.requestBody),
        durationMs: input.durationMs ?? null,
        environment: process.env.NODE_ENV ?? 'production',
      }));
    } catch (err) {
      this.logger.error(`No se pudo registrar el error de plataforma: ${(err as Error).message}`);
    }
  }

  /**
   * Abre una sesión, o reutiliza la que el usuario ya tenga abierta. El índice
   * único parcial sobre (user_id) WHERE logout_at IS NULL garantiza que no haya
   * dos; sin eso, cada pestaña abriría la suya y las métricas de sesión se
   * multiplicarían.
   */
  async logSession(input: UserSessionInput): Promise<void> {
    try {
      const open = await this.sessionsRepo.findOne({
        where: { userId: input.userId, logoutAt: IsNull() },
      });

      if (open) {
        open.lastActivityAt = new Date();
        await this.sessionsRepo.save(open);
        return;
      }

      // El área se resuelve aquí y no en el llamador: auth no tiene acceso al
      // padrón de RRHH y no vale la pena acoplarlo solo para esto.
      const department =
        input.department ?? (input.userEmail ? await this.departmentOf(input.userEmail) : null);

      await this.sessionsRepo.save(this.sessionsRepo.create({
        userId: input.userId,
        userEmail: input.userEmail ?? null,
        department,
        loginAt: new Date(),
        lastActivityAt: new Date(),
        ipAddress: normalizeIp(input.ipAddress),
        userAgent: input.userAgent ?? null,
        modulesVisited: [],
      }));
    } catch (err) {
      this.logger.error(`No se pudo registrar la sesión: ${(err as Error).message}`);
    }
  }

  /** Área del colaborador según su correo corporativo; null si no tiene expediente. */
  private async departmentOf(email: string): Promise<string | null> {
    const rows = await this.sessionsRepo.query(
      `SELECT area FROM employees.employee_records WHERE corporate_email = $1 LIMIT 1`,
      [email],
    );
    return (rows as { area: string | null }[])[0]?.area ?? null;
  }

  /** Marca actividad en la sesión abierta y acumula el módulo visitado. */
  async touchSession(userId: string, module: string | null): Promise<void> {
    try {
      await this.sessionsRepo.query(
        `
        UPDATE audit.user_sessions
        SET last_activity_at = NOW(),
            modules_visited = CASE
              WHEN $2::text IS NULL OR modules_visited @> to_jsonb(ARRAY[$2::text])
                THEN modules_visited
              ELSE modules_visited || to_jsonb(ARRAY[$2::text])
            END
        WHERE user_id = $1 AND logout_at IS NULL
        `,
        [userId, module],
      );
    } catch (err) {
      this.logger.error(`No se pudo actualizar la sesión: ${(err as Error).message}`);
    }
  }

  async closeSession(userId: string): Promise<void> {
    try {
      await this.sessionsRepo.query(
        `
        UPDATE audit.user_sessions
        SET logout_at = NOW(),
            duration_minutes = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - login_at)) / 60)::int
        WHERE user_id = $1 AND logout_at IS NULL
        `,
        [userId],
      );
    } catch (err) {
      this.logger.error(`No se pudo cerrar la sesión: ${(err as Error).message}`);
    }
  }

  // -------------------------------------------------------------------------
  // Configuración por módulo
  // -------------------------------------------------------------------------

  private async getConfigMap(): Promise<Map<string, AuditModuleConfig>> {
    const fresh = this.configCache && Date.now() - this.configLoadedAt < CONFIG_TTL_MS;
    if (fresh && this.configCache) return this.configCache;

    const rows = await this.configRepo.find();
    this.configCache = new Map(rows.map((r) => [r.module, r]));
    this.configLoadedAt = Date.now();
    return this.configCache;
  }

  /**
   * Un módulo sin fila de configuración NO se audita. Es deliberado: la lista
   * es la declaración explícita de qué vigilamos, y auditar por defecto todo lo
   * que aparezca en una URL llenaría la tabla de ruido.
   */
  async shouldLogWrite(module: string | null): Promise<boolean> {
    if (!module) return false;
    const config = (await this.getConfigMap()).get(module);
    return Boolean(config?.auditEnabled && config.logWrites);
  }

  getConfig() {
    return this.configRepo.find({ order: { displayName: 'ASC' } });
  }

  async updateConfig(module: string, dto: UpdateModuleConfigDto, userId: string) {
    const config = await this.configRepo.findOne({ where: { module } });
    if (!config) throw new NotFoundException(`Módulo "${module}" no está en la configuración`);

    Object.assign(config, {
      ...(dto.auditEnabled !== undefined && { auditEnabled: dto.auditEnabled }),
      ...(dto.logReads !== undefined && { logReads: dto.logReads }),
      ...(dto.logWrites !== undefined && { logWrites: dto.logWrites }),
      ...(dto.retentionDays !== undefined && { retentionDays: dto.retentionDays }),
      updatedBy: userId,
    });

    const saved = await this.configRepo.save(config);
    this.configCache = null; // El cambio debe verse en el siguiente request.
    return saved;
  }

  // -------------------------------------------------------------------------
  // Consultas
  // -------------------------------------------------------------------------

  /**
   * Paginación por cursor sobre created_at. Un OFFSET sobre una tabla que crece
   * mientras se pagina salta y repite filas, que es lo peor que le puede pasar
   * a un log de auditoría.
   */
  private applyCursor<T extends import('typeorm').ObjectLiteral>(
    qb: import('typeorm').SelectQueryBuilder<T>,
    cursor?: string,
  ) {
    if (cursor) qb.andWhere('t.created_at < :cursor', { cursor });
    return qb;
  }

  async findSecurity(query: QuerySecurityDto) {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const qb = this.securityRepo
      .createQueryBuilder('t')
      .orderBy('t.created_at', 'DESC')
      .limit(limit + 1);

    if (query.eventType) qb.andWhere('t.event_type = :et', { et: query.eventType });
    if (query.severity) qb.andWhere('t.severity = :sev', { sev: query.severity });
    if (query.userId) qb.andWhere('t.user_id = :uid', { uid: query.userId });
    if (query.dateFrom) qb.andWhere('t.created_at >= :from', { from: query.dateFrom });
    if (query.dateTo) qb.andWhere('t.created_at <= :to', { to: `${query.dateTo} 23:59:59` });
    this.applyCursor(qb, query.cursor);

    return page(await qb.getMany(), limit);
  }

  async findActivity(query: QueryActivityDto) {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const qb = this.activityRepo
      .createQueryBuilder('t')
      .orderBy('t.created_at', 'DESC')
      .limit(limit + 1);

    if (query.userId) qb.andWhere('t.user_id = :uid', { uid: query.userId });
    if (query.module) qb.andWhere('t.module = :mod', { mod: query.module });
    if (query.action) qb.andWhere('t.action = :act', { act: query.action });
    if (query.department) qb.andWhere('t.department = :dep', { dep: query.department });
    if (query.dateFrom) qb.andWhere('t.created_at >= :from', { from: query.dateFrom });
    if (query.dateTo) qb.andWhere('t.created_at <= :to', { to: `${query.dateTo} 23:59:59` });
    this.applyCursor(qb, query.cursor);

    return page(await qb.getMany(), limit);
  }

  async findErrors(query: QueryErrorsDto) {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const qb = this.errorsRepo
      .createQueryBuilder('t')
      .orderBy('t.created_at', 'DESC')
      .limit(limit + 1);

    if (query.module) qb.andWhere('t.module = :mod', { mod: query.module });
    if (query.httpStatus) qb.andWhere('t.http_status = :st', { st: query.httpStatus });
    if (query.resolved !== undefined) qb.andWhere('t.resolved = :res', { res: query.resolved });
    if (query.dateFrom) qb.andWhere('t.created_at >= :from', { from: query.dateFrom });
    if (query.dateTo) qb.andWhere('t.created_at <= :to', { to: `${query.dateTo} 23:59:59` });
    this.applyCursor(qb, query.cursor);

    const result = page(await qb.getMany(), limit);
    const [{ count }] = await this.errorsRepo.query(
      `SELECT COUNT(*)::int AS count FROM audit.platform_errors WHERE resolved = false`,
    );
    return { ...result, unresolvedCount: count as number };
  }

  async resolveError(id: string, userId: string) {
    const error = await this.errorsRepo.findOne({ where: { id } });
    if (!error) throw new NotFoundException(`Error ${id} no encontrado`);

    error.resolved = true;
    error.resolvedAt = new Date();
    error.resolvedBy = userId;
    return this.errorsRepo.save(error);
  }

  async findSessions(query: QuerySessionsDto) {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const qb = this.sessionsRepo
      .createQueryBuilder('t')
      .orderBy('t.login_at', 'DESC')
      .limit(limit + 1);

    if (query.userId) qb.andWhere('t.user_id = :uid', { uid: query.userId });
    if (query.department) qb.andWhere('t.department = :dep', { dep: query.department });
    if (query.dateFrom) qb.andWhere('t.login_at >= :from', { from: query.dateFrom });
    if (query.dateTo) qb.andWhere('t.login_at <= :to', { to: `${query.dateTo} 23:59:59` });
    if (query.cursor) qb.andWhere('t.login_at < :cursor', { cursor: query.cursor });

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    return {
      data,
      nextCursor: hasMore ? (data.at(-1)?.loginAt.toISOString() ?? null) : null,
    };
  }

  // -------------------------------------------------------------------------
  // Mantenimiento
  // -------------------------------------------------------------------------

  /**
   * Purga por retención. Cada módulo tiene su propio `retention_days` porque no
   * todo caduca igual: un movimiento de proveedores se conserva dos años y una
   * reserva de sala medio.
   *
   * Los eventos de seguridad y las sesiones no tienen módulo asociado, así que
   * usan la retención más larga configurada: borrar un `login_failed` antes que
   * la actividad que lo rodea dejaría la investigación coja.
   */
  async cleanup() {
    const configs = await this.configRepo.find();
    const maxRetention = Math.max(365, ...configs.map((c) => c.retentionDays));

    let activity = 0;
    for (const c of configs) {
      const res = await this.activityRepo.query(
        `DELETE FROM audit.user_activity WHERE module = $1 AND created_at < NOW() - ($2::int * INTERVAL '1 day')`,
        [c.module, c.retentionDays],
      );
      activity += res?.[1] ?? 0;
    }

    const [, securityDeleted] = await this.securityRepo.query(
      `DELETE FROM audit.security_events WHERE created_at < NOW() - ($1::int * INTERVAL '1 day')`,
      [maxRetention],
    );
    const [, errorsDeleted] = await this.errorsRepo.query(
      `DELETE FROM audit.platform_errors WHERE resolved = true AND created_at < NOW() - ($1::int * INTERVAL '1 day')`,
      [maxRetention],
    );
    const [, sessionsDeleted] = await this.sessionsRepo.query(
      `DELETE FROM audit.user_sessions WHERE login_at < NOW() - ($1::int * INTERVAL '1 day')`,
      [maxRetention],
    );

    return {
      deleted: {
        activity,
        security: securityDeleted ?? 0,
        errors: errorsDeleted ?? 0,
        sessions: sessionsDeleted ?? 0,
      },
    };
  }

  /**
   * Purga semanal, domingos a las 2:00. Se corre fuera de horario porque los
   * DELETE masivos sobre las tablas de log compiten con las escrituras que el
   * interceptor hace en cada request.
   *
   * De paso cierra las sesiones colgadas: si no, se acumulan abiertas para
   * siempre y la duración promedio del analytics se vuelve inútil.
   */
  @Cron('0 2 * * 0', { timeZone: 'America/Mexico_City' })
  async cleanupOldLogs(): Promise<void> {
    try {
      await this.closeIdleSessions();
      const result = await this.cleanup();
      const { activity, security, errors, sessions } = result.deleted;
      this.logger.log(
        `Purga de auditoría: ${activity} actividades, ${security} eventos, ` +
          `${errors} errores y ${sessions} sesiones eliminados.`,
      );
    } catch (err) {
      this.logger.error(`La purga de auditoría falló: ${(err as Error).message}`);
    }
  }

  /**
   * Cierra sesiones que quedaron abiertas sin actividad. Sin esto, una pestaña
   * cerrada sin logout deja la sesión viva para siempre y la duración promedio
   * se dispara.
   */
  async closeIdleSessions() {
    await this.sessionsRepo.query(
      `
      UPDATE audit.user_sessions
      SET logout_at = last_activity_at,
          duration_minutes = GREATEST(0, EXTRACT(EPOCH FROM (last_activity_at - login_at)) / 60)::int
      WHERE logout_at IS NULL
        AND last_activity_at < NOW() - ($1::int * INTERVAL '1 minute')
      `,
      [SESSION_IDLE_MINUTES],
    );
  }
}

function page<T extends { createdAt: Date }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  return { data, nextCursor: hasMore ? (data.at(-1)?.createdAt.toISOString() ?? null) : null };
}

/**
 * La columna es INET y Postgres rechaza cualquier cosa que no sea una IP.
 * Express entrega '::ffff:10.0.0.1' detrás del ALB y a veces una lista; se
 * toma la primera y se limpia el prefijo IPv4-mapped.
 */
function normalizeIp(raw?: string | null): string | null {
  if (!raw) return null;
  const first = raw.split(',')[0]?.trim() ?? '';
  const cleaned = first.startsWith('::ffff:') ? first.slice(7) : first;
  return /^[0-9a-fA-F.:]+$/.test(cleaned) && cleaned.length > 0 ? cleaned : null;
}

const SENSITIVE_KEYS = ['password', 'token', 'secret', 'authorization', 'apikey', 'api_key'];

/** Nunca se guarda una credencial en el log de errores. */
function redact(body?: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!body) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    out[k] = SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s)) ? '[redactado]' : v;
  }
  return out;
}
