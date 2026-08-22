import { Module } from '@nestjs/common';
import { DocumentStatusService } from './document-status.service';
import { ReportsController } from './reports.controller';

/**
 * Reportes transversales: cruzan varios esquemas (empleados, clientes,
 * proveedores) y por eso no cuelgan de ninguno de esos módulos. Trabajan con
 * SQL directo sobre el DataSource, así que no registran entidades propias.
 */
@Module({
  controllers: [ReportsController],
  providers: [DocumentStatusService],
  exports: [DocumentStatusService],
})
export class ReportsModule {}
