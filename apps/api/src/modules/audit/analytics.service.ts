import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryAnalyticsDto } from './dto/audit.dto';
import { UserActivity } from './entities/user-activity.entity';

/** Umbral para considerar a alguien "sin actividad reciente". */
const INACTIVE_DAYS = 30;

/**
 * Analytics de uso.
 *
 * Todo se agrega en SQL, no en memoria: el volumen de estas tablas crece con
 * cada escritura de la plataforma y traer las filas a Node para contarlas
 * dejaría de funcionar en pocos meses.
 *
 * Las consultas se lanzan en paralelo porque son independientes entre sí.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(UserActivity) private readonly activityRepo: Repository<UserActivity>,
  ) {}

  private range(query: QueryAnalyticsDto) {
    const to = query.dateTo ?? new Date().toISOString().slice(0, 10);
    const from =
      query.dateFrom ??
      new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
    return { from, to: `${to} 23:59:59`, toDate: to };
  }

  async getSummary(query: QueryAnalyticsDto) {
    const { from, to, toDate } = this.range(query);
    const p = [from, to];

    const [
      [totals],
      topUsers,
      leastActive,
      byModule,
      byDepartment,
      errorTotals,
      errorsByModule,
      timeline,
      heatmap,
    ] = await Promise.all([
      this.activityRepo.query(
        `
        SELECT
          (SELECT COUNT(*)::int FROM auth.users WHERE deleted_at IS NULL AND is_active = true) AS total_users,
          (SELECT COUNT(DISTINCT user_id)::int FROM audit.user_sessions
             WHERE login_at BETWEEN $1 AND $2) AS active_users,
          (SELECT COUNT(*)::int FROM audit.user_sessions
             WHERE login_at BETWEEN $1 AND $2) AS total_sessions,
          (SELECT COALESCE(AVG(duration_minutes), 0)::float FROM audit.user_sessions
             WHERE login_at BETWEEN $1 AND $2 AND duration_minutes IS NOT NULL) AS avg_minutes,
          (SELECT COUNT(*)::int FROM audit.user_activity
             WHERE created_at BETWEEN $1 AND $2) AS total_actions
        `,
        p,
      ),

      this.activityRepo.query(
        `
        SELECT a.user_id, a.user_name, a.department,
               COUNT(*)::int AS actions,
               (SELECT COUNT(*)::int FROM audit.user_sessions s
                  WHERE s.user_id = a.user_id AND s.login_at BETWEEN $1 AND $2) AS sessions,
               MAX(a.created_at) AS last_activity
        FROM audit.user_activity a
        WHERE a.created_at BETWEEN $1 AND $2 AND a.user_id IS NOT NULL
        GROUP BY a.user_id, a.user_name, a.department
        ORDER BY actions DESC
        LIMIT 10
        `,
        p,
      ),

      // Usuarios activos de la plataforma sin actividad en 30 días. Sale de
      // auth.users, no del log: alguien que nunca ha entrado no tiene filas y
      // es precisamente a quien hay que detectar.
      this.activityRepo.query(
        `
        SELECT u.id AS user_id, u.name AS user_name, e.area AS department,
               (SELECT MAX(a.created_at) FROM audit.user_activity a WHERE a.user_id = u.id)
                 AS last_activity
        FROM auth.users u
        LEFT JOIN employees.employee_records e ON e.corporate_email = u.email
        WHERE u.deleted_at IS NULL AND u.is_active = true
          AND NOT EXISTS (
            SELECT 1 FROM audit.user_activity a
            WHERE a.user_id = u.id AND a.created_at > NOW() - ($1::int * INTERVAL '1 day')
          )
        ORDER BY last_activity ASC NULLS FIRST
        LIMIT 15
        `,
        [INACTIVE_DAYS],
      ),

      this.activityRepo.query(
        `
        SELECT a.module,
               COALESCE(c.display_name, a.module) AS display_name,
               COUNT(*)::int AS actions,
               COUNT(DISTINCT a.user_id)::int AS unique_users,
               (SELECT a2.action FROM audit.user_activity a2
                 WHERE a2.module = a.module AND a2.created_at BETWEEN $1 AND $2
                 GROUP BY a2.action ORDER BY COUNT(*) DESC LIMIT 1) AS top_action
        FROM audit.user_activity a
        LEFT JOIN audit.module_config c ON c.module = a.module
        WHERE a.created_at BETWEEN $1 AND $2
        GROUP BY a.module, c.display_name
        ORDER BY actions DESC
        `,
        p,
      ),

      this.activityRepo.query(
        `
        SELECT COALESCE(a.department, 'Sin área') AS department,
               COUNT(DISTINCT a.user_id)::int AS users,
               COUNT(*)::int AS actions,
               (SELECT COUNT(*)::int FROM audit.user_sessions s
                  WHERE COALESCE(s.department, 'Sin área') = COALESCE(a.department, 'Sin área')
                    AND s.login_at BETWEEN $1 AND $2) AS sessions
        FROM audit.user_activity a
        WHERE a.created_at BETWEEN $1 AND $2
        GROUP BY COALESCE(a.department, 'Sin área')
        ORDER BY actions DESC
        `,
        p,
      ),

      this.activityRepo.query(
        `
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE resolved = false AND http_status >= 500)::int AS critical_unresolved
        FROM audit.platform_errors
        WHERE created_at BETWEEN $1 AND $2
        `,
        p,
      ),

      this.activityRepo.query(
        `
        SELECT COALESCE(module, 'sin módulo') AS module,
               COUNT(*)::int AS count,
               MAX(created_at) AS last_error
        FROM audit.platform_errors
        WHERE created_at BETWEEN $1 AND $2
        GROUP BY COALESCE(module, 'sin módulo')
        ORDER BY count DESC
        `,
        p,
      ),

      // Serie diaria completa: generate_series rellena los días sin actividad,
      // que si no desaparecerían de la gráfica y la harían mentir.
      this.activityRepo.query(
        `
        SELECT TO_CHAR(d.day, 'YYYY-MM-DD') AS date,
               (SELECT COUNT(*)::int FROM audit.user_sessions s
                  WHERE s.login_at::date = d.day) AS sessions,
               (SELECT COUNT(*)::int FROM audit.user_activity a
                  WHERE a.created_at::date = d.day) AS actions,
               (SELECT COUNT(*)::int FROM audit.platform_errors e
                  WHERE e.created_at::date = d.day) AS errors
        FROM generate_series($1::date, $2::date, '1 day') AS d(day)
        ORDER BY d.day ASC
        `,
        [from, toDate],
      ),

      this.activityRepo.query(
        `
        SELECT h.hour::int AS hour,
               COALESCE(COUNT(a.id), 0)::int AS actions
        FROM generate_series(0, 23) AS h(hour)
        LEFT JOIN audit.user_activity a
          ON EXTRACT(HOUR FROM a.created_at) = h.hour
         AND a.created_at BETWEEN $1 AND $2
        GROUP BY h.hour
        ORDER BY h.hour ASC
        `,
        p,
      ),
    ]);

    const totalActions = totals?.total_actions ?? 0;
    const totalErrors = errorTotals?.[0]?.total ?? 0;

    return {
      period: { from, to: toDate },
      totalUsers: totals?.total_users ?? 0,
      activeUsers: totals?.active_users ?? 0,
      totalSessions: totals?.total_sessions ?? 0,
      avgSessionMinutes: round1(totals?.avg_minutes ?? 0),
      totalActions,

      topUsers: topUsers.map((r: Record<string, unknown>) => ({
        userId: r.user_id as string,
        userName: (r.user_name as string) ?? 'Sin nombre',
        department: (r.department as string) ?? null,
        sessions: r.sessions as number,
        actions: r.actions as number,
        lastActivity: r.last_activity as Date,
      })),

      leastActiveUsers: leastActive.map((r: Record<string, unknown>) => ({
        userId: r.user_id as string,
        userName: (r.user_name as string) ?? 'Sin nombre',
        department: (r.department as string) ?? null,
        lastActivity: (r.last_activity as Date) ?? null,
      })),

      byModule: byModule.map((r: Record<string, unknown>) => ({
        module: r.module as string,
        displayName: r.display_name as string,
        actions: r.actions as number,
        uniqueUsers: r.unique_users as number,
        topAction: (r.top_action as string) ?? null,
      })),

      byDepartment: byDepartment.map((r: Record<string, unknown>) => ({
        department: r.department as string,
        users: r.users as number,
        sessions: r.sessions as number,
        actions: r.actions as number,
      })),

      errorRate: {
        total: totalErrors,
        // Errores por cada 100 acciones: un número absoluto de errores no dice
        // nada sin saber sobre cuánta operación ocurrieron.
        percent: totalActions > 0 ? round1((totalErrors / totalActions) * 100) : 0,
        byModule: errorsByModule.map((r: Record<string, unknown>) => ({
          module: r.module as string,
          count: r.count as number,
          lastError: r.last_error as Date,
        })),
        criticalUnresolved: errorTotals?.[0]?.critical_unresolved ?? 0,
      },

      activityTimeline: timeline.map((r: Record<string, unknown>) => ({
        date: r.date as string,
        sessions: r.sessions as number,
        actions: r.actions as number,
        errors: r.errors as number,
      })),

      moduleHeatmap: heatmap.map((r: Record<string, unknown>) => ({
        hour: r.hour as number,
        actions: r.actions as number,
      })),
    };
  }

  /** Perfil de actividad de un usuario: su ficha dentro del analytics. */
  async getUserProfile(userId: string, query: QueryAnalyticsDto) {
    const { from, to, toDate } = this.range(query);

    const [[totals], byModule, byAction, recent] = await Promise.all([
      this.activityRepo.query(
        `
        SELECT
          (SELECT COUNT(*)::int FROM audit.user_activity
             WHERE user_id = $1 AND created_at BETWEEN $2 AND $3) AS actions,
          (SELECT COUNT(*)::int FROM audit.user_sessions
             WHERE user_id = $1 AND login_at BETWEEN $2 AND $3) AS sessions,
          (SELECT COALESCE(AVG(duration_minutes), 0)::float FROM audit.user_sessions
             WHERE user_id = $1 AND duration_minutes IS NOT NULL) AS avg_minutes,
          (SELECT MAX(created_at) FROM audit.user_activity WHERE user_id = $1) AS last_activity
        `,
        [userId, from, to],
      ),
      this.activityRepo.query(
        `
        SELECT module, COUNT(*)::int AS actions
        FROM audit.user_activity
        WHERE user_id = $1 AND created_at BETWEEN $2 AND $3
        GROUP BY module ORDER BY actions DESC
        `,
        [userId, from, to],
      ),
      this.activityRepo.query(
        `
        SELECT action, COUNT(*)::int AS count
        FROM audit.user_activity
        WHERE user_id = $1 AND created_at BETWEEN $2 AND $3
        GROUP BY action ORDER BY count DESC
        `,
        [userId, from, to],
      ),
      this.activityRepo.query(
        `
        SELECT action, module, entity_name, created_at
        FROM audit.user_activity
        WHERE user_id = $1
        ORDER BY created_at DESC LIMIT 20
        `,
        [userId],
      ),
    ]);

    return {
      userId,
      period: { from, to: toDate },
      totalActions: totals?.actions ?? 0,
      totalSessions: totals?.sessions ?? 0,
      avgSessionMinutes: round1(totals?.avg_minutes ?? 0),
      lastActivity: totals?.last_activity ?? null,
      byModule,
      byAction,
      recentActivity: recent,
    };
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
