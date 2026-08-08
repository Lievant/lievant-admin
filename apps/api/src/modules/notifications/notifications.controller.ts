import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { CreateFlowRecipientDto } from './dto/create-flow-recipient.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { RespondNotificationDto } from './dto/respond-notification.dto';
import { UpdateFlowRecipientDto } from './dto/update-flow-recipient.dto';
import { NotificationFlowsService } from './notification-flows.service';
import { NotificationsService } from './notifications.service';

/**
 * Todos los endpoints operan sobre las notificaciones del usuario autenticado;
 * no existe forma de leer ni responder las de otro (el service valida la
 * pertenencia además del permiso).
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly service: NotificationsService,
    private readonly flowsService: NotificationFlowsService,
  ) {}

  @Get()
  @RequirePermission('herramientas', 'notificaciones', 'read')
  getMyNotifications(@Query() query: QueryNotificationsDto, @CurrentUser() user: User) {
    return this.service.getMyNotifications(user.id, query);
  }

  // ==========================================================================
  // Flujos de notificación — configuración
  //
  // Van antes de las rutas con ':id' para que 'flows' no entre por el parámetro.
  // El permiso es admin.configuracion.write: definen a quién le llega qué en
  // toda la plataforma, no son datos del usuario en sesión.
  // ==========================================================================

  @Get('flows')
  @RequirePermission('admin', 'configuracion', 'write')
  getFlows() {
    return this.flowsService.getFlows();
  }

  @Get('flows/:id')
  @RequirePermission('admin', 'configuracion', 'write')
  getFlow(@Param('id', ParseUUIDPipe) id: string) {
    return this.flowsService.getFlowById(id);
  }

  @Post('flows/:id/recipients')
  @RequirePermission('admin', 'configuracion', 'write')
  addFlowRecipient(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateFlowRecipientDto,
  ) {
    return this.flowsService.addRecipient(id, dto);
  }

  @Patch('flows/:id/recipients/:rid')
  @RequirePermission('admin', 'configuracion', 'write')
  updateFlowRecipient(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('rid', ParseUUIDPipe) rid: string,
    @Body() dto: UpdateFlowRecipientDto,
  ) {
    return this.flowsService.updateRecipient(id, rid, dto);
  }

  @Delete('flows/recipients/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('admin', 'configuracion', 'write')
  async removeFlowRecipient(@Param('id', ParseUUIDPipe) id: string) {
    await this.flowsService.removeRecipient(id);
    return { success: true };
  }

  @Get('unread-count')
  @RequirePermission('herramientas', 'notificaciones', 'read')
  async getUnreadCount(@CurrentUser() user: User) {
    return { count: await this.service.getUnreadCount(user.id) };
  }

  @Get('recent')
  @RequirePermission('herramientas', 'notificaciones', 'read')
  getRecent(@CurrentUser() user: User) {
    return this.service.getRecent(user.id);
  }

  // Antes de ':id/read': si no, 'read-all' entraría por la ruta con parámetro.
  @Patch('read-all')
  @RequirePermission('herramientas', 'notificaciones', 'read')
  async markAllAsRead(@CurrentUser() user: User) {
    await this.service.markAllAsRead(user.id);
    return { success: true };
  }

  @Patch(':id/read')
  @RequirePermission('herramientas', 'notificaciones', 'read')
  async markAsRead(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    await this.service.markAsRead(id, user.id);
    return { success: true };
  }

  @Patch(':id/respond')
  @RequirePermission('herramientas', 'notificaciones', 'read')
  respond(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondNotificationDto,
    @CurrentUser() user: User,
  ) {
    return this.service.respond(id, user, dto);
  }
}
