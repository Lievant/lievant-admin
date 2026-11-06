import { Module } from '@nestjs/common';
import { EmployeeDevelopmentModule } from '../employee-development/employee-development.module';
import { JobRequisitionsModule } from '../job-requisitions/job-requisitions.module';
import { OkrEvaluationsReportService } from './okr-evaluations-report.service';
import { OkrEvaluationsController } from './okr-evaluations.controller';
import { OkrEvaluationsService } from './okr-evaluations.service';

/**
 * Evaluación de OKRs (RRHH 2.0 · M7). Reutiliza la verificación de líder (M8) y la
 * regla de acceso por empleado (M5). SQL directo en el esquema `hr`; AuditService es global.
 */
@Module({
  imports: [EmployeeDevelopmentModule, JobRequisitionsModule],
  controllers: [OkrEvaluationsController],
  providers: [OkrEvaluationsService, OkrEvaluationsReportService],
})
export class OkrEvaluationsModule {}
