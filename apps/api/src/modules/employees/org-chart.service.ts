import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeRecord } from './entities/employee-record.entity';
import {
  buildFilterOptions,
  buildOrgTree,
  distinctLocations,
  filterOrgRows,
  normalizeValue,
  ORG_CHART_SHOW_PHONE,
  type GroupedRow,
  type OrgCounts,
  type OrgFilterOptions,
  type OrgFilters,
  type OrgRow,
  type OrgTreeResult,
} from './org-chart.util';

interface OrgRowRaw {
  id: string;
  display_id: string;
  full_name: string;
  position: string;
  area: string | null;
  level: string | null;
  company_name: string | null;
  division: string | null;
  location: string | null;
  corporate_email: string | null;
  direct_report_to_id: string | null;
  phone: string | null;
}

export interface OrgChartResponse extends OrgTreeResult {
  /** Ubicaciones disponibles para el filtro (el expediente no tiene campo de país). */
  locations: string[];
  /** Para "Mostrando X de Y Colaboradores". */
  counts: OrgCounts;
}

@Injectable()
export class OrgChartService {
  private readonly logger = new Logger(OrgChartService.name);

  constructor(@InjectRepository(EmployeeRecord) private readonly employeesRepo: Repository<EmployeeRecord>) {}

  /**
   * Árbol de empleados activos. Una sola consulta (con el celular unido de
   * `personal_data`, solo esa columna); los filtros (empresa, división, área, nivel
   * y ubicación) y el árbol se resuelven en memoria: el filtro corta el árbol (solo
   * los que coinciden; el jefe pasa a ser el ancestro más cercano que coincide). Los campos de la
   * respuesta salen de una lista blanca: ver `OrgNode`.
   */
  async getOrgChart(filters: OrgFilters = {}): Promise<OrgChartResponse> {
    const phoneSelect = ORG_CHART_SHOW_PHONE ? 'p.phone AS phone' : 'NULL AS phone';
    const phoneJoin = ORG_CHART_SHOW_PHONE ? 'LEFT JOIN employees.personal_data p ON p.employee_id = e.id' : '';
    const rows = (await this.employeesRepo.query(
      `SELECT e.id, e.display_id, e.full_name, e.position, e.area, e.level, e.company_name, e.division,
              e.location, e.corporate_email, e.direct_report_to_id, ${phoneSelect}
       FROM employees.employee_records e
       ${phoneJoin}
       WHERE e.status = 'active' AND e.deleted_at IS NULL`,
    )) as OrgRowRaw[];

    const orgRows: OrgRow[] = rows.map((r) => ({
      id: r.id,
      displayId: r.display_id,
      fullName: r.full_name,
      position: r.position,
      area: r.area,
      level: r.level,
      companyName: r.company_name,
      division: r.division,
      location: r.location,
      corporateEmail: r.corporate_email,
      phone: r.phone,
      directReportToId: r.direct_report_to_id,
    }));

    const filtered = filterOrgRows(orgRows, filters);
    const result = buildOrgTree(filtered.rows, { onCycle: (message) => this.logger.warn(message) });
    return {
      ...result,
      // Las ubicaciones del filtro salen de todos los activos, no solo de los filtrados.
      locations: distinctLocations(orgRows.map((r) => r.location)),
      counts: { matched: filtered.matched, total: orgRows.length },
    };
  }

  /**
   * Opciones de los filtros con conteos y combinaciones reales Empresa/División/Área,
   * a partir de UNA consulta agrupada sobre empleados activos y no eliminados. El
   * orden de los niveles usa `catalogs.org_levels.sort_order` cuando existe.
   */
  async getFilters(): Promise<OrgFilterOptions> {
    const rows = (await this.employeesRepo.query(
      `SELECT e.company_name AS company, e.division, e.area, e.level, e.location, COUNT(*)::int AS count
       FROM employees.employee_records e
       WHERE e.status = 'active' AND e.deleted_at IS NULL
       GROUP BY e.company_name, e.division, e.area, e.level, e.location`,
    )) as GroupedRow[];

    const catalogOrder = new Map<string, number>();
    try {
      const levels = (await this.employeesRepo.query(
        `SELECT code, sort_order FROM catalogs.org_levels WHERE is_active = true`,
      )) as { code: string; sort_order: number }[];
      for (const l of levels) catalogOrder.set(normalizeValue(l.code), l.sort_order);
    } catch (err) {
      // Sin catálogo se ordena por valor romano; el filtro no debe fallar por esto.
      this.logger.warn(`No se pudo leer catalogs.org_levels: ${err instanceof Error ? err.message : String(err)}`);
    }
    return buildFilterOptions(rows, catalogOrder);
  }
}
