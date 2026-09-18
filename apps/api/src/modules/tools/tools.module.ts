import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import { ToolAssignmentRecord } from './entities/tool-assignment-record.entity';
import { Tool } from './entities/tool.entity';
import { ToolsController } from './tools.controller';
import { ToolsService } from './tools.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tool, ToolAssignmentRecord, EmployeeRecord])],
  controllers: [ToolsController],
  providers: [ToolsService],
  exports: [ToolsService],
})
export class ToolsModule {}
