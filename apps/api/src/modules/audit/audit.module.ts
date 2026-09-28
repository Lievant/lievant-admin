import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';
import { AuditModuleConfig } from './entities/audit-module-config.entity';
import { PlatformError } from './entities/platform-error.entity';
import { SecurityEvent } from './entities/security-event.entity';
import { UserActivity } from './entities/user-activity.entity';
import { UserSession } from './entities/user-session.entity';

/**
 * Global: cualquier módulo puede inyectar AuditService para registrar eventos
 * propios (login, revelado de contraseña, exportaciones) sin tener que
 * importarlo en cada uno.
 *
 * El interceptor se registra aquí con APP_INTERCEPTOR y no en AppModule para
 * que su dependencia de AuditService se resuelva en el mismo contexto donde
 * está declarado.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      SecurityEvent,
      UserActivity,
      PlatformError,
      UserSession,
      AuditModuleConfig,
    ]),
  ],
  controllers: [AuditController],
  providers: [
    AuditService,
    AnalyticsService,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditService],
})
export class AuditModule {}
