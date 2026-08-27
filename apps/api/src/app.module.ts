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
import { ReportsModule } from './modules/reports/reports.module';
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
        // Pool explícito. Sin esto, node-postgres abre hasta 10 conexiones por
        // task; el db.t3.micro de prod solo admite 81 en total, así que escalar
        // tasks agotaba el servidor antes que la CPU. Con 5 por task, 2 tasks
        // usan 10 y queda margen de sobra para migraciones y sesiones manuales.
        extra: {
          max: 5,
          min: 1,
          // Nombres de node-postgres: 'acquire'/'idle' son de Sequelize y este
          // driver los ignoraría en silencio.
          connectionTimeoutMillis: 30_000,
          idleTimeoutMillis: 10_000,
        },
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
    ReportsModule,
  ],
})
export class AppModule {}
