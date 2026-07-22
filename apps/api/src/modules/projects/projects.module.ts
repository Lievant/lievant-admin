import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Brand } from '../clients/entities/brand.entity';
import { ClientRecord } from '../clients/entities/client-record.entity';
import { Company } from '../clients/entities/company.entity';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import { ProjectBillingMilestone } from './entities/project-billing-milestone.entity';
import { ProjectBusinessUnit } from './entities/project-business-unit.entity';
import { ProjectDocument } from './entities/project-document.entity';
import { ProjectFinancials } from './entities/project-financials.entity';
import { ProjectHistory } from './entities/project-history.entity';
import { ProjectMember } from './entities/project-member.entity';
import { ProjectRecord } from './entities/project-record.entity';
import { ProjectStorageService } from './project-storage.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProjectRecord,
      ProjectMember,
      ProjectBusinessUnit,
      ProjectFinancials,
      ProjectBillingMilestone,
      ProjectDocument,
      ProjectHistory,
      ClientRecord,
      Company,
      Brand,
      EmployeeRecord,
    ]),
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectStorageService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
