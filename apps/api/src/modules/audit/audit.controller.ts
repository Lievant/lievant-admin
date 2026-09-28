import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permission.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { SystemRole } from '../auth/constants/roles.constant';
import { User } from '../auth/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AnalyticsService } from './analytics.service';
import { AuditService } from './audit.service';
import {
  QueryActivityDto,
  QueryAnalyticsDto,
  QueryErrorsDto,
  QuerySecurityDto,
  QuerySessionsDto,
  UpdateModuleConfigDto,
} from './dto/audit.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('audit')
export class AuditController {
  constructor(
    private readonly service: AuditService,
    private readonly analytics: AnalyticsService,
  ) {}

  // ── Logs ──────────────────────────────────────────────────────────────────

  @Get('security')
  @RequirePermission('admin', 'audit', 'read')
  findSecurity(@Query() query: QuerySecurityDto) {
    return this.service.findSecurity(query);
  }

  @Get('activity')
  @RequirePermission('admin', 'audit', 'read')
  findActivity(@Query() query: QueryActivityDto) {
    return this.service.findActivity(query);
  }

  @Get('errors')
  @RequirePermission('admin', 'audit', 'read')
  findErrors(@Query() query: QueryErrorsDto) {
    return this.service.findErrors(query);
  }

  @Patch('errors/:id/resolve')
  @RequirePermission('admin', 'audit', 'write')
  resolveError(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.resolveError(id, user.id);
  }

  @Get('sessions')
  @RequirePermission('admin', 'audit', 'read')
  findSessions(@Query() query: QuerySessionsDto) {
    return this.service.findSessions(query);
  }

  // ── Configuración ─────────────────────────────────────────────────────────

  @Get('config')
  @RequirePermission('admin', 'audit', 'read')
  getConfig() {
    return this.service.getConfig();
  }

  @Patch('config/:module')
  @RequirePermission('admin', 'audit', 'write')
  updateConfig(
    @Param('module') module: string,
    @Body() dto: UpdateModuleConfigDto,
    @CurrentUser() user: User,
  ) {
    return this.service.updateConfig(module, dto, user.id);
  }

  // ── Analytics ─────────────────────────────────────────────────────────────

  @Get('analytics/summary')
  @RequirePermission('admin', 'analytics', 'read')
  getSummary(@Query() query: QueryAnalyticsDto) {
    return this.analytics.getSummary(query);
  }

  @Get('analytics/user/:userId')
  @RequirePermission('admin', 'analytics', 'read')
  getUserProfile(@Param('userId') userId: string, @Query() query: QueryAnalyticsDto) {
    return this.analytics.getUserProfile(userId, query);
  }

  // ── Mantenimiento ─────────────────────────────────────────────────────────

  /**
   * Purga destructiva: solo SUPER_ADMIN. RolesGuard va a nivel de método porque
   * el resto del controlador se rige por permisos, no por rol.
   */
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @Delete('cleanup')
  cleanup() {
    return this.service.cleanup();
  }
}
