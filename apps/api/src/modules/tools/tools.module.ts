import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogToolCategory } from '../catalogs/entities/catalog-tool-category.entity';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import { License } from './entities/license.entity';
import { ToolAssignmentRecord } from './entities/tool-assignment-record.entity';
import { Tool } from './entities/tool.entity';
import { ToolLicensesController } from './licenses.controller';
import { ToolLicensesService } from './licenses.service';
import { ToolsController } from './tools.controller';
import { ToolsService } from './tools.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tool,
      ToolAssignmentRecord,
      License,
      EmployeeRecord,
      CatalogToolCategory,
    ]),
  ],
  controllers: [ToolsController, ToolLicensesController],
  providers: [ToolsService, ToolLicensesService],
  exports: [ToolsService, ToolLicensesService],
})
export class ToolsModule {}
