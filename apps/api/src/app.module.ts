import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogsModule } from './modules/catalogs/catalogs.module';
import { ClientsModule } from './modules/clients/clients.module';
import { CreditCardsModule } from './modules/credit-cards/credit-cards.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { HelpdeskModule } from './modules/helpdesk/helpdesk.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { IsobotModule } from './modules/isobot/isobot.module';
import { LicensesModule } from './modules/licenses/licenses.module';
import { MediaModule } from './modules/media/media.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { VacationsModule } from './modules/vacations/vacations.module';
import { VendorsModule } from './modules/vendors/vendors.module';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env', '../../.env.local', '../../.env'],
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'),
        schema: config.get<string>('DATABASE_SCHEMA', 'auth'),
        autoLoadEntities: true,
        synchronize: false,
        logging: config.get<string>('NODE_ENV') === 'development',
        ssl: config.get<string>('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
      }),
    }),
    AuthModule,
    ClientsModule,
    EmployeesModule,
    CatalogsModule,
    VendorsModule,
    RoomsModule,
    HelpdeskModule,
    InventoryModule,
    ProjectsModule,
    LicensesModule,
    IsobotModule,
    VacationsModule,
    MediaModule,
    NotificationsModule,
    ExpensesModule,
    CreditCardsModule,
  ],
})
export class AppModule {}
