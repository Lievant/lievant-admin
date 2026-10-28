import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { ExportOrgChartDto } from './dto/export-org-chart.dto';

export interface ExportActor {
  id?: string;
  email?: string;
  name?: string;
}

export const ORGANIZATION_NAME = 'Lievant';

/**
 * Visto bueno de la exportación del organigrama a PDF. El PDF se dibuja en el navegador con lo que ya está
 * en pantalla; este paso es lo que exige el permiso `rrhh.organigrama.export` en el servidor y deja constancia
 * en `audit.user_activity` (quién, cuándo, vista, filtros y papel).
 */
@Injectable()
export class OrgChartExportService {
  constructor(private readonly audit: AuditService) {}

  async register(dto: ExportOrgChartDto, actor: ExportActor): Promise<{ authorized: true; generatedAt: string; organization: string }> {
    const generatedAt = new Date().toISOString();
    const filters: Record<string, string> = {};
    for (const key of ['company', 'division', 'area', 'level', 'location'] as const) {
      const value = dto[key];
      if (value) filters[key] = value;
    }
    await this.audit.logActivity({
      userId: actor.id ?? null,
      userEmail: actor.email ?? null,
      userName: actor.name ?? null,
      action: 'export',
      module: 'organigrama',
      entityType: 'org_chart',
      entityName: 'Organigrama',
      changes: {
        view: { from: null, to: dto.view },
        paper: { from: null, to: dto.paper },
        filters: { from: null, to: filters },
        ...(dto.pages !== undefined ? { pages: { from: null, to: dto.pages } } : {}),
        ...(dto.employees !== undefined ? { employees: { from: null, to: dto.employees } } : {}),
      },
    });
    return { authorized: true, generatedAt, organization: ORGANIZATION_NAME };
  }
}
