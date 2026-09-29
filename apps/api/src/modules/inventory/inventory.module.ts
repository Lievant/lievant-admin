import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import { TicketAssignee } from '../helpdesk/entities/ticket-assignee.entity';
import { EquipmentBrand } from './entities/equipment-brand.entity';
import { EquipmentHistory } from './entities/equipment-history.entity';
import { EquipmentMaintenance } from './entities/equipment-maintenance.entity';
import { EquipmentResponsiva } from './entities/equipment-responsiva.entity';
import { EquipmentStatus } from './entities/equipment-status.entity';
import { EquipmentType } from './entities/equipment-type.entity';
import { Equipment } from './entities/equipment.entity';
import { InventoryResponsivasService } from './inventory-responsivas.service';
import { InventoryStorageService } from './inventory-storage.service';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Equipment,
      EquipmentHistory,
      EquipmentMaintenance,
      EquipmentType,
      EquipmentBrand,
      EquipmentStatus,
      EquipmentResponsiva,
      EmployeeRecord,
      // Para validar/copiar el técnico (RN-4). Entidad plana: no arrastra HelpdeskModule.
      TicketAssignee,
    ]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService, InventoryResponsivasService, InventoryStorageService],
  exports: [InventoryService, InventoryResponsivasService],
})
export class InventoryModule {}
