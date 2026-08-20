import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { CatalogDocumentType } from '../catalogs/entities/catalog-document-type.entity';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { DocumentStorageService } from './document-storage.service';
import { ClientContractsService } from './client-contracts.service';
import { Brand } from './entities/brand.entity';
import { ClientDocument } from './entities/client-document.entity';
import { ClientRecord } from './entities/client-record.entity';
import { Company } from './entities/company.entity';
import { Contact } from './entities/contact.entity';
import { FinancialData } from './entities/financial-data.entity';
import { Group } from './entities/group.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClientRecord,
      Group,
      Company,
      Brand,
      FinancialData,
      ClientDocument,
      Contact,
      User,
      CatalogDocumentType,
    ]),
  ],
  controllers: [ClientsController],
  providers: [ClientsService, DocumentStorageService, ClientContractsService],
  exports: [ClientsService],
})
export class ClientsModule {}
