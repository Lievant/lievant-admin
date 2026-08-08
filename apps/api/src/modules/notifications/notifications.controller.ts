import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permission.decorator';
import { User } from '../auth/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { RespondNotificationDto } from './dto/respond-notification.dto';
import { NotificationsService } from './notifications.service';

/**
 * Todos los endpoints operan sobre las notificaciones del usuario autenticado;
 * no existe forma de leer ni responder las de otro (el service valida la
 * pertenencia además del permiso).
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @RequirePermission('herramientas', 'notificaciones', 'read')
  getMyNotifications(@Query() query: QueryNotificationsDto, @CurrentUser() user: User) {
    return this.service.getMyNotifications(user.id, query);
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
