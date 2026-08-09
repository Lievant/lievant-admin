import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import { ExpensesModule } from '../expenses/expenses.module';
import { VacationsModule } from '../vacations/vacations.module';
import { EmailService } from './email.service';
import { FlowRecipient } from './entities/flow-recipient.entity';
import { Notification } from './entities/notification.entity';
import { NotificationFlow } from './entities/notification-flow.entity';
import { NotificationFlowsService } from './notification-flows.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';

/**
 * No importa AuthModule a propósito: AuthModule ya importa este módulo para
 * usar EmailService, y hacerlo mutuo crearía un ciclo. Los guards solo
 * necesitan Reflector y la estrategia JWT global de Passport, así que basta con
 * registrar JwtModule aquí para que el gateway pueda verificar tokens.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationFlow,
      FlowRecipient,
      EmployeeRecord,
      User,
    ]),
    // NotificationFlowsService debe exportarse para que RRHH dispare el flujo de
    // baja; ya estaba en exports junto al resto.
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'CHANGE_THIS_IN_SECRETS_MANAGER'),
      }),
    }),
    forwardRef(() => VacationsModule),
    forwardRef(() => ExpensesModule),
  ],
  controllers: [NotificationsController],
  providers: [EmailService, NotificationsService, NotificationFlowsService, NotificationsGateway],
  exports: [EmailService, NotificationsService, NotificationFlowsService],
})
export class NotificationsModule {}
