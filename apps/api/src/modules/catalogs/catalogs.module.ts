import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogsController } from './catalogs.controller';
import { CatalogsService } from './catalogs.service';
import { CatalogArea } from './entities/catalog-area.entity';
import { CatalogBloodType } from './entities/catalog-blood-type.entity';
import { CatalogCompany } from './entities/catalog-company.entity';
import { CatalogContractSchema } from './entities/catalog-contract-schema.entity';
import { CatalogContractType } from './entities/catalog-contract-type.entity';
import { CatalogDivision } from './entities/catalog-division.entity';
import { CatalogDocumentType } from './entities/catalog-document-type.entity';
import { CatalogIndustry } from './entities/catalog-industry.entity';
import { CatalogLocation } from './entities/catalog-location.entity';
import { CatalogMaritalStatus } from './entities/catalog-marital-status.entity';
import { CatalogModality } from './entities/catalog-modality.entity';
import { CatalogOrgLevel } from './entities/catalog-org-level.entity';
import { CatalogVendorCategory } from './entities/catalog-vendor-category.entity';
import { CatalogEmployeeDocumentType } from './entities/catalog-employee-document-type.entity';
import { TicketAssignee } from '../helpdesk/entities/ticket-assignee.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CatalogCompany,
      CatalogLocation,
      CatalogModality,
      CatalogDivision,
      CatalogArea,
      CatalogContractSchema,
      CatalogContractType,
      CatalogOrgLevel,
      CatalogBloodType,
      CatalogMaritalStatus,
      CatalogIndustry,
      CatalogDocumentType,
      CatalogVendorCategory,
      CatalogEmployeeDocumentType,
      TicketAssignee,
    ]),
  ],
  controllers: [CatalogsController],
  providers: [CatalogsService],
  exports: [CatalogsService],
})
export class CatalogsModule {}
