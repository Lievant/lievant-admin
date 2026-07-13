import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import { Holiday } from './entities/holiday.entity';
import { VacationBalance } from './entities/vacation-balance.entity';
import { VacationMovement } from './entities/vacation-movement.entity';
import { VacationPolicy } from './entities/vacation-policy.entity';
import { VacationRequest } from './entities/vacation-request.entity';
import { VacationsController } from './vacations.controller';
import { VacationsService } from './vacations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmployeeRecord,
      VacationBalance,
      VacationRequest,
      VacationMovement,
      VacationPolicy,
      Holiday,
      User,
    ]),
  ],
  controllers: [VacationsController],
  providers: [VacationsService],
  exports: [VacationsService],
})
export class VacationsModule {}
