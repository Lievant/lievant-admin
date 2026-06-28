import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { CatalogDocumentType } from '../catalogs/entities/catalog-document-type.entity';
import { DocumentsService } from './documents.service';
import { EmployeePhotosService } from './employee-photos.service';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { EmployeeStorageService } from './employee-storage.service';
import { Compensation } from './entities/compensation.entity';
import { EmergencyContact } from './entities/emergency-contact.entity';
import { EmployeeDocument } from './entities/employee-document.entity';
import { EmployeePhoto } from './entities/employee-photo.entity';
import { EmployeeRecord } from './entities/employee-record.entity';
import { PersonalData } from './entities/personal-data.entity';
import { TerminationData } from './entities/termination-data.entity';
import { Vacation } from './entities/vacation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmployeeRecord,
      PersonalData,
      Compensation,
      Vacation,
      EmergencyContact,
      TerminationData,
      User,
      EmployeeDocument,
      EmployeePhoto,
      CatalogDocumentType,
    ]),
  ],
  controllers: [EmployeesController],
  providers: [EmployeesService, DocumentsService, EmployeeStorageService, EmployeePhotosService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
