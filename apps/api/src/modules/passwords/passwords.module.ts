import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { AccountPassword } from './entities/account-password.entity';
import { PasswordApplication } from './entities/password-application.entity';
import { PasswordsController } from './passwords.controller';
import { PasswordsService } from './passwords.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PasswordApplication, AccountPassword, EmployeeRecord]),
    ConfigModule,
    // forwardRef por la misma razón que HelpDesk: notificaciones ya participa
    // en ciclos con vacaciones y gastos.
    forwardRef(() => NotificationsModule),
  ],
  controllers: [PasswordsController],
  providers: [PasswordsService],
})
export class PasswordsModule {}
