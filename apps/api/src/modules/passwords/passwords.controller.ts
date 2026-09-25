import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
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
  CreateAccountPasswordDto,
  CreatePasswordApplicationDto,
  QueryPasswordsDto,
  RevealQueryDto,
  UpdateAccountPasswordDto,
  UpdatePasswordApplicationDto,
} from './dto/password.dto';
import { PasswordsService } from './passwords.service';

/**
 * TIC-RE-17. El permiso dice qué puede hacer el usuario; el alcance (qué
 * cuentas) lo fija el propio dato: solo las de colaboradores que le reportan.
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('passwords')
export class PasswordsController {
  constructor(private readonly service: PasswordsService) {}

  // Rutas literales antes de /:id para que no se parseen como UUID.

  // ── Catálogo de aplicaciones ───────────────────────────────────────────────

  // Sin permiso: cualquier usuario autenticado puede ver el catálogo.
  @Get('applications')
  listApplications() {
    return this.service.listApplications();
  }

  @Post('applications')
  @RequirePermission('herramientas', 'passwords', 'write')
  createApplication(@Body() dto: CreatePasswordApplicationDto) {
    return this.service.createApplication(dto);
  }

  @Patch('applications/:id')
  @RequirePermission('herramientas', 'passwords', 'write')
  updateApplication(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePasswordApplicationDto) {
    return this.service.updateApplication(id, dto);
  }

  @Delete('applications/:id')
  @RequirePermission('herramientas', 'passwords', 'write')
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivateApplication(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deactivateApplication(id);
  }

  // ── Equipo ─────────────────────────────────────────────────────────────────
  // Sin @RequirePermission, igual que /vacations/team: ser jefe no es un
  // permiso y un usuario sin equipo recibe false o una lista vacía.

  @Get('is-manager')
  isManager(@CurrentUser() user: User) {
    return this.service.isManager(user.id);
  }

  @Get('team-employees')
  getTeamEmployees(@CurrentUser() user: User) {
    return this.service.getTeamEmployees(user.id);
  }

  // SUPER_ADMIN se valida en el servicio.
  @Get('audit-log')
  getAuditLog(@CurrentUser() user: User) {
    return this.service.getAuditLog(user);
  }

  // ── Contraseñas ────────────────────────────────────────────────────────────

  @Get()
  @RequirePermission('herramientas', 'passwords', 'read')
  list(@CurrentUser() user: User, @Query() query: QueryPasswordsDto) {
    return this.service.list(user, query);
  }

  @Get(':id/reveal')
  @RequirePermission('herramientas', 'passwords', 'read')
  reveal(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: RevealQueryDto,
    @Ip() ip: string,
  ) {
    return this.service.reveal(user, id, query.action ?? 'ver', ip ?? null);
  }

  @Post()
  @RequirePermission('herramientas', 'passwords', 'write')
  create(@CurrentUser() user: User, @Body() dto: CreateAccountPasswordDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @RequirePermission('herramientas', 'passwords', 'write')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountPasswordDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermission('herramientas', 'passwords', 'write')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.revoke(user, id);
  }
}
