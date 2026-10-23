import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { TrainingReportQueryDto } from './dto/trainings-report.dto';
import { buildRiacWorkbook } from './trainings-report-excel';
import {
  RIAC_DEFAULT_LIMIT,
  RIAC_EXPORT_MAX_ROWS,
  buildRiacWhere,
  describeRiacFilters,
  riacFileName,
  toRiacItem,
  validateRiacRange,
  type RiacFilters,
  type RiacItem,
  type RiacRow,
} from './trainings-report.util';
import type { TrainingActor } from './trainings.service';

export interface RiacReportPage {
  data: RiacItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const SELECT = `
  SELECT e.display_id, e.full_name, e.area, e.position,
         t.name, t.institution, t.development_type, t.level,
         to_char(t.start_date, 'YYYY-MM-DD') AS start_date,
         to_char(t.end_date, 'YYYY-MM-DD') AS end_date,
         t.duration_value, t.duration_unit, t.is_company_recognition`;
const FROM = `
  FROM employees.employee_trainings t
  JOIN employees.employee_records e ON e.id = t.employee_id`;
const ORDER = 'ORDER BY e.full_name ASC, t.start_date DESC, t.created_at DESC';

function toFilters(dto: TrainingReportQueryDto): RiacFilters {
  validateRiacRange(dto.from, dto.to);
  return {
    from: dto.from,
    to: dto.to,
    type: dto.type,
    area: dto.area?.trim() || undefined,
    division: dto.division?.trim() || undefined,
    employeeId: dto.employeeId,
  };
}

/**
 * RIAC: consolida las capacitaciones de los colaboradores activos en un rango.
 * Una sola consulta con join a `employee_records` (sin N+1); solo lectura.
 */
@Injectable()
export class TrainingsReportService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  /** Áreas y divisiones de los empleados activos, para los filtros. */
  async getOptions(): Promise<{ areas: string[]; divisions: string[] }> {
    const distinct = async (col: 'area' | 'division'): Promise<string[]> => {
      const rows = (await this.dataSource.query(
        `SELECT DISTINCT ${col} AS v FROM employees.employee_records
         WHERE deleted_at IS NULL AND status = 'active' AND ${col} IS NOT NULL AND ${col} <> ''
         ORDER BY ${col} ASC`,
      )) as { v: string }[];
      return rows.map((r) => r.v);
    };
    const [areas, divisions] = await Promise.all([distinct('area'), distinct('division')]);
    return { areas, divisions };
  }

  async getReport(dto: TrainingReportQueryDto): Promise<RiacReportPage> {
    const filters = toFilters(dto);
    const page = dto.page ?? 1;
    const limit = dto.limit ?? RIAC_DEFAULT_LIMIT;
    const { where, params } = buildRiacWhere(filters);

    // El total sale de la misma consulta (COUNT(*) OVER()).
    const rows = (await this.dataSource.query(
      `${SELECT}, COUNT(*) OVER() AS total_count ${FROM} WHERE ${where} ${ORDER}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    )) as RiacRow[];

    let total = rows[0] ? Number(rows[0].total_count) : 0;
    if (!rows[0] && page > 1) {
      // Página fuera de rango: la ventana no devuelve filas, así que el total se cuenta aparte.
      const counted = (await this.dataSource.query(`SELECT COUNT(*) AS n ${FROM} WHERE ${where}`, params)) as { n: string }[];
      total = Number(counted[0]?.n ?? 0);
    }
    return { data: rows.map(toRiacItem), total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  /** Excel con TODOS los registros que cumplen los filtros (tope de seguridad) y auditoría de la exportación. */
  async exportExcel(dto: TrainingReportQueryDto, actor: TrainingActor): Promise<{ buffer: Buffer; fileName: string }> {
    const filters = toFilters(dto);
    const { where, params } = buildRiacWhere(filters);

    const rows = (await this.dataSource.query(
      `${SELECT} ${FROM} WHERE ${where} ${ORDER} LIMIT $${params.length + 1}`,
      [...params, RIAC_EXPORT_MAX_ROWS + 1],
    )) as RiacRow[];
    if (rows.length > RIAC_EXPORT_MAX_ROWS) {
      throw new BadRequestException(
        `El reporte supera ${RIAC_EXPORT_MAX_ROWS.toLocaleString('es-MX')} registros; acota los filtros e inténtalo de nuevo`,
      );
    }

    let employeeName: string | null = null;
    if (filters.employeeId) {
      const found = (await this.dataSource.query(`SELECT full_name FROM employees.employee_records WHERE id = $1`, [
        filters.employeeId,
      ])) as { full_name: string }[];
      employeeName = found[0]?.full_name ?? null;
    }

    const generatedAt = new Date();
    const wb = buildRiacWorkbook({
      items: rows.map(toRiacItem),
      from: filters.from,
      to: filters.to,
      filtersText: describeRiacFilters(filters, employeeName),
      generatedAt,
    });
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const fileName = riacFileName(filters.from, filters.to);

    // La consulta no se audita, la exportación sí: quién, cuándo (created_at) y con qué filtros.
    await this.audit.logActivity({
      userId: actor.id ?? null,
      userEmail: actor.email ?? null,
      userName: actor.name ?? null,
      action: 'export',
      module: 'empleados',
      entityType: 'riac_report',
      entityName: fileName,
      changes: { filters, rows: rows.length },
    });
    return { buffer, fileName };
  }
}
