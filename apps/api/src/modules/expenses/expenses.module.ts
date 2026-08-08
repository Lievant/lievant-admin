import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { CatalogExpenseConcept } from './entities/catalog-expense-concept.entity';
import { CatalogExpenseType } from './entities/catalog-expense-type.entity';
import { ExpenseLine } from './entities/expense-line.entity';
import { ExpenseReport } from './entities/expense-report.entity';
import { ExpensesController } from './expenses.controller';
import { ExpensesStorageService } from './expenses-storage.service';
import { ExpensesService } from './expenses.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExpenseReport,
      ExpenseLine,
      CatalogExpenseConcept,
      CatalogExpenseType,
      EmployeeRecord,
    ]),
    ConfigModule,
    // forwardRef por consistencia con el resto: NotificationsModule ya participa
    // en un ciclo con vacaciones y arrastra ese grafo al resolverse.
    forwardRef(() => NotificationsModule),
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService, ExpensesStorageService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
