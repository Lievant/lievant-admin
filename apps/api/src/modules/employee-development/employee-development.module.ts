import { Module } from '@nestjs/common';
import { EmployeeDevelopmentController } from './employee-development.controller';
import { EmployeeDevelopmentService } from './employee-development.service';

/**
 * Desarrollo Organizacional (RRHH 2.0 · M5). SQL directo en el esquema `hr`;
 * AuditService es global. Exporta el servicio para Mi Información (EmployeesModule)
 * y para el futuro M7.
 */
@Module({
  controllers: [EmployeeDevelopmentController],
  providers: [EmployeeDevelopmentService],
  exports: [EmployeeDevelopmentService],
})
export class EmployeeDevelopmentModule {}
