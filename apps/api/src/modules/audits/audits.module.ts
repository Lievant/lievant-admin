import { Module } from '@nestjs/common';
import { HelpdeskModule } from '../helpdesk/helpdesk.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EquipmentAuditController } from './equipment-audit.controller';
import { EquipmentAuditService } from './equipment-audit.service';

/**
 * Auditoría de Equipos (TIC-RE-18). No confundir con `modules/audit` (bitácora
 * de actividad). SQL directo sobre el `DataSource`: completar una auditoría toca
 * inventario, HelpDesk y la propia auditoría en una sola transacción.
 */
@Module({
  imports: [HelpdeskModule, NotificationsModule],
  controllers: [EquipmentAuditController],
  providers: [EquipmentAuditService],
})
export class AuditsModule {}
