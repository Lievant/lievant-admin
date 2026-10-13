import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { Risk } from './entities/risk.entity';
import { RisksController } from './risks.controller';
import { RisksService } from './risks.service';

@Module({
  imports: [TypeOrmModule.forFeature([Risk, User]), NotificationsModule],
  controllers: [RisksController],
  providers: [RisksService],
})
export class RisksModule {}
