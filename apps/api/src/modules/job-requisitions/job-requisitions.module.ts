import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { VacationsModule } from '../vacations/vacations.module';
import { JobRequisitionsReviewService } from './job-requisitions-review.service';
import { JobRequisitionsController } from './job-requisitions.controller';
import { JobRequisitionsService } from './job-requisitions.service';
import { RequisitionLeaderService } from './requisition-leader.service';

/**
 * Solicitud de Puesto (RRHH 2.0 · M8). SQL directo en el esquema `hr`. Reutiliza
 * VacationsService para saber si un usuario es líder y el módulo de
 * notificaciones (flujos sembrados en la migración 038). AuditService es global.
 */
@Module({
  imports: [NotificationsModule, VacationsModule],
  controllers: [JobRequisitionsController],
  providers: [JobRequisitionsService, JobRequisitionsReviewService, RequisitionLeaderService],
  // El M7 (evaluación de OKRs) reutiliza la verificación de líder.
  exports: [RequisitionLeaderService],
})
export class JobRequisitionsModule {}
