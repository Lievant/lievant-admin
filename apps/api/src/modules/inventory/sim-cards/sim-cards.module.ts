import { Module } from '@nestjs/common';
import { SimCardsController } from './sim-cards.controller';
import { SimCardsService } from './sim-cards.service';

/**
 * Líneas Telefónicas (SIMs). Usa SQL directo sobre el `DataSource` del módulo
 * raíz: casi todas las lecturas cruzan planes, proveedores, empleados y equipos,
 * y las escrituras necesitan transacción con historial.
 */
@Module({
  controllers: [SimCardsController],
  providers: [SimCardsService],
})
export class SimCardsModule {}
