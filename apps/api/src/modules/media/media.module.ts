import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { ClientRecord } from '../clients/entities/client-record.entity';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import { AdAccount } from './entities/ad-account.entity';
import { ApiCredential } from './entities/api-credential.entity';
import { MediaBudget } from './entities/budget.entity';
import { DailySpend } from './entities/daily-spend.entity';
import { MediaAlert } from './entities/media-alert.entity';
import { MediaAuditLog } from './entities/media-audit-log.entity';
import { PacingSnapshot } from './entities/pacing-snapshot.entity';
import { Platform } from './entities/platform.entity';
import { SyncLog } from './entities/sync-log.entity';
import { MediaController } from './media.controller';
import { MediaPacingService } from './media-pacing.service';
import { MediaSyncService } from './media-sync.service';
import { MediaService } from './media.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Platform,
      ApiCredential,
      AdAccount,
      DailySpend,
      MediaBudget,
      PacingSnapshot,
      MediaAlert,
      MediaAuditLog,
      SyncLog,
      // Entidades de otros módulos usadas para relaciones/lecturas
      ClientRecord,
      EmployeeRecord,
      User,
    ]),
  ],
  controllers: [MediaController],
  providers: [MediaService, MediaPacingService, MediaSyncService],
  exports: [MediaService, MediaSyncService],
})
export class MediaModule {}
