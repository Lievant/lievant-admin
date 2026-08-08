import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import { CatalogExpenseConcept } from '../expenses/entities/catalog-expense-concept.entity';
import { CatalogExpenseType } from '../expenses/entities/catalog-expense-type.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { CreditCardsController } from './credit-cards.controller';
import { CreditCardsStorageService } from './credit-cards-storage.service';
import { CreditCardsService } from './credit-cards.service';
import { CardExpenseLine } from './entities/card-expense-line.entity';
import { CardExpenseReport } from './entities/card-expense-report.entity';
import { CreditCard } from './entities/credit-card.entity';

/**
 * No hay ciclo con notificaciones —los reportes de tarjeta no se resuelven
 * respondiendo una notificación, solo se procesan desde Finanzas—, pero se usa
 * forwardRef porque NotificationsModule ya participa en ciclos con vacaciones y
 * gastos y Nest necesita el diferido para ordenar el grafo completo.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CreditCard,
      CardExpenseReport,
      CardExpenseLine,
      CatalogExpenseConcept,
      CatalogExpenseType,
      EmployeeRecord,
    ]),
    ConfigModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [CreditCardsController],
  providers: [CreditCardsService, CreditCardsStorageService],
  exports: [CreditCardsService],
})
export class CreditCardsModule {}
