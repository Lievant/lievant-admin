import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogToolCategory } from '../catalogs/entities/catalog-tool-category.entity';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { Assigner } from './entities/assigner.entity';
import { Assignment } from './entities/assignment.entity';
import { Tool } from './entities/tool.entity';
import { ToolsController } from './tools.controller';
import { ToolsService } from './tools.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tool, Assignment, Assigner, EmployeeRecord, CatalogToolCategory]),
    NotificationsModule,
  ],
  controllers: [ToolsController, AssignmentsController],
  providers: [ToolsService, AssignmentsService],
  exports: [ToolsService, AssignmentsService],
})
export class ToolsModule {}
