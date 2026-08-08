import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { VacationsModule } from '../vacations/vacations.module';
import { EmailService } from './email.service';
import { Notification } from './entities/notification.entity';
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
    TypeOrmModule.forFeature([Notification, User]),
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'CHANGE_THIS_IN_SECRETS_MANAGER'),
      }),
    }),
    forwardRef(() => VacationsModule),
  ],
  controllers: [NotificationsController],
  providers: [EmailService, NotificationsService, NotificationsGateway],
  exports: [EmailService, NotificationsService],
})
export class NotificationsModule {}
