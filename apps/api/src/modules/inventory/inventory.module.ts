import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import { EquipmentBrand } from './entities/equipment-brand.entity';
import { EquipmentHistory } from './entities/equipment-history.entity';
import { EquipmentResponsiva } from './entities/equipment-responsiva.entity';
import { EquipmentStatus } from './entities/equipment-status.entity';
import { EquipmentType } from './entities/equipment-type.entity';
import { Equipment } from './entities/equipment.entity';
import { InventoryResponsivasService } from './inventory-responsivas.service';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Equipment,
      EquipmentHistory,
      EquipmentType,
      EquipmentBrand,
      EquipmentStatus,
      EquipmentResponsiva,
      EmployeeRecord,
    ]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService, InventoryResponsivasService],
  exports: [InventoryService, InventoryResponsivasService],
})
export class InventoryModule {}
