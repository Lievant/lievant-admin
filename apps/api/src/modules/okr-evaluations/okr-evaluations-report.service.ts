import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { ReportQueryDto } from './dto/okr-evaluations.dto';
import { buildOkrWorkbook, type OkrDetailRow } from './okr-report-excel';
import {
  DEFAULT_LIMIT,
  EXPORT_MAX_ROWS,
  buildReportWhere,
  buildSummary,
  describeFilters,
  reportFileName,
  type EvaluationStatus,
  type OkrFact,
  type ReportFilters,
  type ReportSummary,
} from './okr-evaluations.util';
import type { Actor } from './okr-evaluations.service';

export interface ReportRowView {
  employeeId: string;
  employeeName: string;
  area: string | null;
  leaderName: string | null;
  period: string;
  objective: string;
  keyResult: string;
  weight: number | null;
  score: number | null;
  status: EvaluationStatus;
}

export interface ReportPage {
  data: ReportRowView[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: ReportSummary;
}

interface DbRow {
  employee_id: string;
  full_name: string;
  area: string | null;
  leader_name: string | null;
  period: string;
  objective: string;
  key_result: string;
  weight: string | null;
  score: string | null;
  status: EvaluationStatus | null;
  evaluated_at: Date | null;
  total_count?: string | number;
}

const SELECT = `
  SELECT e.id AS employee_id, e.full_name, e.area, l.full_name AS leader_name,
         o.period, o.objective, o.key_result, o.weight, ev.score, ev.status, ev.evaluated_at`;
const FROM = `
  FROM hr.employee_okrs o
  JOIN employees.employee_records e ON e.id = o.employee_id
  LEFT JOIN employees.employee_records l ON l.id = e.direct_report_to_id AND l.deleted_at IS NULL
  LEFT JOIN hr.okr_evaluations ev ON ev.employee_okr_id = o.id AND ev.deleted_at IS NULL`;
const ORDER = 'ORDER BY o.period DESC, e.full_name ASC, o.sort_order ASC, o.created_at ASC';

const num = (v: string | null): number | null => (v === null ? null : Number(v));

const toRow = (r: DbRow): ReportRowView => ({
  employeeId: r.employee_id,
  employeeName: r.full_name,
  area: r.area,
  leaderName: r.leader_name,
  period: r.period,
  objective: r.objective,
  keyResult: r.key_result,
  weight: num(r.weight),
  score: num(r.score),
  status: r.status ?? 'pendiente',
});

const toFilters = (dto: ReportQueryDto): ReportFilters => ({
  period: dto.period,
  area: dto.area?.trim() || undefined,
  employeeId: dto.employeeId,
});

/**
 * Reporte de OKRs de RRHH (solo lectura; `rrhh.okrs.read`). El resumen y los
 * promedios se calculan sobre TODO el conjunto filtrado, no solo sobre la
 * página. La consulta del reporte no se audita; la exportación sí.
 */
@Injectable()
export class OkrEvaluationsReportService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  /** Periodos con OKRs asignados y áreas, para los filtros. */
  async getOptions(): Promise<{ periods: string[]; areas: string[] }> {
    const [periods, areas] = await Promise.all([
      this.dataSource.query(
        `SELECT DISTINCT o.period AS v FROM hr.employee_okrs o JOIN employees.employee_records e ON e.id = o.employee_id
         WHERE o.deleted_at IS NULL AND o.is_active = true AND e.status = 'active' AND e.deleted_at IS NULL ORDER BY o.period DESC`,
      ) as Promise<{ v: string }[]>,
      this.dataSource.query(
        `SELECT DISTINCT e.area AS v FROM hr.employee_okrs o JOIN employees.employee_records e ON e.id = o.employee_id
         WHERE o.deleted_at IS NULL AND o.is_active = true AND e.status = 'active' AND e.deleted_at IS NULL
           AND e.area IS NOT NULL AND e.area <> '' ORDER BY e.area ASC`,
      ) as Promise<{ v: string }[]>,
    ]);
    return { periods: periods.map((p) => p.v), areas: areas.map((a) => a.v) };
  }

  /** Hechos mínimos de TODO el filtro para los promedios (una consulta, sin N+1). */
  private async loadFacts(where: string, params: unknown[]): Promise<OkrFact[]> {
    const rows = (await this.dataSource.query(`${SELECT} ${FROM} WHERE ${where}`, params)) as DbRow[];
    return rows.map((r) => ({
      employeeId: r.employee_id,
      employeeName: r.full_name,
      area: r.area,
      period: r.period,
      weight: num(r.weight),
      score: num(r.score),
    }));
  }

  async getReport(dto: ReportQueryDto): Promise<ReportPage> {
    const filters = toFilters(dto);
    const page = dto.page ?? 1;
    const limit = dto.limit ?? DEFAULT_LIMIT;
    const { where, params } = buildReportWhere(filters);

    const [rows, facts] = await Promise.all([
      this.dataSource.query(
        `${SELECT}, COUNT(*) OVER() AS total_count ${FROM} WHERE ${where} ${ORDER}
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, (page - 1) * limit],
      ) as Promise<DbRow[]>,
      this.loadFacts(where, params),
    ]);
    // El total sale de la misma consulta o, en una página fuera de rango, de los hechos ya cargados.
    const total = rows[0] ? Number(rows[0].total_count) : facts.length;
    return { data: rows.map(toRow), total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)), summary: buildSummary(facts) };
  }

  /** Excel con TODO el filtro (tope de filas), hojas Detalle y Resumen, y auditoría de la exportación. */
  async exportExcel(dto: ReportQueryDto, actor: Actor): Promise<{ buffer: Buffer; fileName: string }> {
    const filters = toFilters(dto);
    const { where, params } = buildReportWhere(filters);

    const rows = (await this.dataSource.query(
      `${SELECT} ${FROM} WHERE ${where} ${ORDER} LIMIT $${params.length + 1}`,
      [...params, EXPORT_MAX_ROWS + 1],
    )) as DbRow[];
    if (rows.length > EXPORT_MAX_ROWS) {
      throw new BadRequestException(`El reporte supera ${EXPORT_MAX_ROWS.toLocaleString('es-MX')} filas; acota los filtros e inténtalo de nuevo`);
    }

    const facts: OkrFact[] = rows.map((r) => ({
      employeeId: r.employee_id,
      employeeName: r.full_name,
      area: r.area,
      period: r.period,
      weight: num(r.weight),
      score: num(r.score),
    }));
    const detail: OkrDetailRow[] = rows.map((r) => ({
      employeeName: r.full_name,
      area: r.area,
      leaderName: r.leader_name,
      period: r.period,
      objective: r.objective,
      keyResult: r.key_result,
      weight: num(r.weight),
      score: num(r.score),
      status: r.status ?? 'pendiente',
      evaluatedAt: r.evaluated_at,
    }));

    let employeeName: string | null = null;
    if (filters.employeeId) {
      const found = (await this.dataSource.query(`SELECT full_name FROM employees.employee_records WHERE id = $1`, [filters.employeeId])) as { full_name: string }[];
      employeeName = found[0]?.full_name ?? null;
    }

    const generatedAt = new Date();
    const wb = buildOkrWorkbook({
      rows: detail,
      summary: buildSummary(facts),
      periodLabel: filters.period ?? 'Todos',
      filtersText: describeFilters(filters, employeeName),
      generatedAt,
    });
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const fileName = reportFileName(filters.period);

    // La consulta no se audita; la exportación sí: quién, cuándo (created_at) y con qué filtros.
    await this.audit.logActivity({
      userId: actor.id ?? null,
      userEmail: actor.email ?? null,
      userName: actor.name ?? null,
      action: 'export',
      module: 'okrs',
      entityType: 'okr_report',
      entityName: fileName,
      changes: { filters, rows: rows.length },
    });
    return { buffer, fileName };
  }
}
