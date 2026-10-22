import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeRecord } from './entities/employee-record.entity';
import {
  buildOrgTree,
  distinctLocations,
  ORG_CHART_SHOW_PHONE,
  type OrgRow,
  type OrgTreeResult,
} from './org-chart.util';

interface OrgRowRaw {
  id: string;
  display_id: string;
  full_name: string;
  position: string;
  area: string | null;
  location: string | null;
  corporate_email: string | null;
  direct_report_to_id: string | null;
  phone: string | null;
}

export interface OrgChartResponse extends OrgTreeResult {
  /** Ubicaciones disponibles para el filtro (el expediente no tiene campo de país). */
  locations: string[];
}

@Injectable()
export class OrgChartService {
  private readonly logger = new Logger(OrgChartService.name);

  constructor(@InjectRepository(EmployeeRecord) private readonly employeesRepo: Repository<EmployeeRecord>) {}

  /**
   * Árbol de empleados activos. Una sola consulta (con el celular unido de
   * `personal_data`, solo esa columna) y el árbol se arma en memoria. Los campos
   * de la respuesta salen de una lista blanca: ver `OrgNode`.
   */
  async getOrgChart(location?: string): Promise<OrgChartResponse> {
    const params: unknown[] = [];
    const where = ["e.status = 'active'", 'e.deleted_at IS NULL'];
    if (location) {
      params.push(location);
      where.push(`e.location = $${params.length}`);
    }

    const phoneSelect = ORG_CHART_SHOW_PHONE ? 'p.phone AS phone' : 'NULL AS phone';
    const phoneJoin = ORG_CHART_SHOW_PHONE ? 'LEFT JOIN employees.personal_data p ON p.employee_id = e.id' : '';
    const rows = (await this.employeesRepo.query(
      `SELECT e.id, e.display_id, e.full_name, e.position, e.area, e.location, e.corporate_email,
              e.direct_report_to_id, ${phoneSelect}
       FROM employees.employee_records e
       ${phoneJoin}
       WHERE ${where.join(' AND ')}`,
      params,
    )) as OrgRowRaw[];

    // Las ubicaciones del filtro salen de todos los activos, no solo de los filtrados.
    const locations = location
      ? (
          (await this.employeesRepo.query(
            `SELECT DISTINCT location FROM employees.employee_records
             WHERE status = 'active' AND deleted_at IS NULL AND location IS NOT NULL`,
          )) as { location: string }[]
        ).map((r) => r.location)
      : rows.map((r) => r.location);

    const orgRows: OrgRow[] = rows.map((r) => ({
      id: r.id,
      displayId: r.display_id,
      fullName: r.full_name,
      position: r.position,
      area: r.area,
      corporateEmail: r.corporate_email,
      phone: r.phone,
      directReportToId: r.direct_report_to_id,
    }));

    const result = buildOrgTree(orgRows, { onCycle: (message) => this.logger.warn(message) });
    return { ...result, locations: distinctLocations(locations) };
  }
}
