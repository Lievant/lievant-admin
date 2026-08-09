import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { CatalogDocumentType } from '../catalogs/entities/catalog-document-type.entity';
import { HelpdeskModule } from '../helpdesk/helpdesk.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DocumentsService } from './documents.service';
import { EmployeeAssignmentSearchController } from './employee-assignment-search.controller';
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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmployeeRecord,
      PersonalData,
      Compensation,
      EmergencyContact,
      TerminationData,
      User,
      EmployeeDocument,
      EmployeePhoto,
      CatalogDocumentType,
    ]),
    // La baja de un empleado abre un ticket de TI y dispara notificaciones.
    // forwardRef en notificaciones porque ese módulo ya participa en ciclos con
    // vacaciones y gastos.
    HelpdeskModule,
    forwardRef(() => NotificationsModule),
  ],
  // EmployeeAssignmentSearchController debe registrarse antes que
  // EmployeesController: su ruta estática GET /employees/search-for-assignment
  // sería capturada por el GET /employees/:id de EmployeesController si se
  // registrara después (Nest/Express hacen match por orden de registro).
  controllers: [EmployeeAssignmentSearchController, EmployeesController],
  providers: [EmployeesService, DocumentsService, EmployeeStorageService, EmployeePhotosService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
