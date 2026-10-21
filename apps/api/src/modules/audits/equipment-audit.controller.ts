import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permission.decorator';
import { User } from '../auth/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import {
  CreateEquipmentAuditDto,
  QueryEquipmentAuditsDto,
  UpdateAuditEquipmentItemDto,
  UpdateAuditLicenseItemDto,
  UpdateEquipmentAuditDto,
} from './dto/equipment-audit.dto';
import { EquipmentAuditService } from './equipment-audit.service';

/**
 * Auditoría de Equipos (TIC-RE-18): lectura con
 * `transformacion.auditoria-equipos.read`, escritura con `.write`. Las rutas
 * fijas (`stats`, `technicians`) van antes de `:id`.
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('audits/equipment')
export class EquipmentAuditController {
  constructor(private readonly service: EquipmentAuditService) {}

  @Get('stats')
  @RequirePermission('transformacion', 'auditoria-equipos', 'read')
  stats() {
    return this.service.getAuditStats();
  }

  /** Técnicos elegibles: agentes de la mesa de servicio con usuario, más la sesión. */
  @Get('technicians')
  @RequirePermission('transformacion', 'auditoria-equipos', 'read')
  technicians(@CurrentUser() user: User) {
    return this.service.technicians(user);
  }

  @Get()
  @RequirePermission('transformacion', 'auditoria-equipos', 'read')
  list(@Query() query: QueryEquipmentAuditsDto) {
    return this.service.getAudits(query);
  }

  @Post()
  @RequirePermission('transformacion', 'auditoria-equipos', 'write')
  create(@Body() dto: CreateEquipmentAuditDto, @CurrentUser() user: User) {
    return this.service.createAudit(dto, user);
  }

  @Get(':id')
  @RequirePermission('transformacion', 'auditoria-equipos', 'read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getAuditData(id);
  }

  @Patch(':id')
  @RequirePermission('transformacion', 'auditoria-equipos', 'write')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEquipmentAuditDto, @CurrentUser() user: User) {
    return this.service.updateAuditProgress(id, dto, user);
  }

  @Patch(':id/equipment-items/:itemId')
  @RequirePermission('transformacion', 'auditoria-equipos', 'write')
  updateEquipmentItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateAuditEquipmentItemDto,
    @CurrentUser() user: User,
  ) {
    return this.service.updateEquipmentItem(id, itemId, dto, user);
  }

  @Patch(':id/license-items/:itemId')
  @RequirePermission('transformacion', 'auditoria-equipos', 'write')
  updateLicenseItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateAuditLicenseItemDto,
    @CurrentUser() user: User,
  ) {
    return this.service.updateLicenseItem(id, itemId, dto, user);
  }

  @Post(':id/complete')
  @HttpCode(200)
  @RequirePermission('transformacion', 'auditoria-equipos', 'write')
  complete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.completeAudit(id, user);
  }
}
