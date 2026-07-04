import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import { EmployeeLicense } from './entities/employee-license.entity';
import { ToolAssignment } from './entities/tool-assignment.entity';
import { ToolCatalog } from './entities/tool-catalog.entity';
import { LicensesController } from './licenses.controller';
import { LicensesService } from './licenses.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmployeeRecord, EmployeeLicense, ToolAssignment, ToolCatalog]),
  ],
  controllers: [LicensesController],
  providers: [LicensesService],
  exports: [LicensesService],
})
export class LicensesModule {}
