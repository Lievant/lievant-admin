import { Module } from '@nestjs/common';
import { JobPositionItemsService } from './job-position-items.service';
import { JobPositionsController } from './job-positions.controller';
import { JobPositionsService } from './job-positions.service';

/**
 * Matriz de Puestos (RRHH 2.0 · M6-A). SQL directo sobre el `DataSource` en el
 * esquema `hr`; AuditService es global.
 */
@Module({
  controllers: [JobPositionsController],
  providers: [JobPositionsService, JobPositionItemsService],
})
export class JobPositionsModule {}
