import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../auth/decorators/permission.decorator';
import { User } from '../../auth/entities/user.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import {
  AssignSimCardDto,
  CreateSimCardDto,
  CreateSimPlanDto,
  QuerySimCardsDto,
  UnassignSimCardDto,
  UpdateSimCardDto,
  UpdateSimPlanDto,
} from './dto/sim-card.dto';
import { SimCardsService } from './sim-cards.service';

/**
 * Líneas Telefónicas: lectura con `transformacion.sim-cards.read`, escritura con
 * `.write`. Las rutas fijas (`plans`, `stats`, `expiring`, `by-*`) van antes de
 * `:id` para que Nest no las tome por un id.
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sim-cards')
export class SimCardsController {
  constructor(private readonly service: SimCardsService) {}

  // ── Planes ─────────────────────────────────────────────────────────────────

  @Get('plans')
  @RequirePermission('transformacion', 'sim-cards', 'read')
  listPlans() {
    return this.service.listPlans();
  }

  @Post('plans')
  @RequirePermission('transformacion', 'sim-cards', 'write')
  createPlan(@Body() dto: CreateSimPlanDto, @CurrentUser() user: User) {
    return this.service.createPlan(dto, user);
  }

  @Patch('plans/:id')
  @RequirePermission('transformacion', 'sim-cards', 'write')
  updatePlan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSimPlanDto, @CurrentUser() user: User) {
    return this.service.updatePlan(id, dto, user);
  }

  @Delete('plans/:id')
  @RequirePermission('transformacion', 'sim-cards', 'write')
  deletePlan(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.deletePlan(id, user);
  }

  // ── Consultas fijas ────────────────────────────────────────────────────────

  @Get('stats')
  @RequirePermission('transformacion', 'sim-cards', 'read')
  stats() {
    return this.service.stats();
  }

  @Get('expiring')
  @RequirePermission('transformacion', 'sim-cards', 'read')
  expiring(@CurrentUser() user: User) {
    return this.service.expiring(user);
  }

  /** Líneas sin equipo, para "Asociar línea" en la pestaña Asignación. */
  @Get('without-equipment')
  @RequirePermission('transformacion', 'sim-cards', 'read')
  withoutEquipment(@CurrentUser() user: User) {
    return this.service.withoutEquipment(user);
  }

  // Sin @RequirePermission: acepta `sim-cards.read` o `rrhh.empleados.read`, y un
  // decorador solo admite un permiso. La comprobación vive en el servicio.
  @Get('by-employee/:employeeId')
  byEmployee(@Param('employeeId', ParseUUIDPipe) employeeId: string, @CurrentUser() user: User) {
    return this.service.byEmployee(employeeId, user);
  }

  @Get('by-equipment/:equipmentId')
  @RequirePermission('transformacion', 'sim-cards', 'read')
  byEquipment(@Param('equipmentId', ParseUUIDPipe) equipmentId: string, @CurrentUser() user: User) {
    return this.service.byEquipment(equipmentId, user);
  }

  // ── Líneas ─────────────────────────────────────────────────────────────────

  @Get()
  @RequirePermission('transformacion', 'sim-cards', 'read')
  list(@Query() query: QuerySimCardsDto, @CurrentUser() user: User) {
    return this.service.list(query, user);
  }

  @Get(':id')
  @RequirePermission('transformacion', 'sim-cards', 'read')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.get(id, user);
  }

  @Post()
  @RequirePermission('transformacion', 'sim-cards', 'write')
  create(@Body() dto: CreateSimCardDto, @CurrentUser() user: User) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @RequirePermission('transformacion', 'sim-cards', 'write')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSimCardDto, @CurrentUser() user: User) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/assign')
  @HttpCode(200)
  @RequirePermission('transformacion', 'sim-cards', 'write')
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignSimCardDto, @CurrentUser() user: User) {
    return this.service.assign(id, dto, user);
  }

  @Post(':id/unassign')
  @HttpCode(200)
  @RequirePermission('transformacion', 'sim-cards', 'write')
  unassign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UnassignSimCardDto, @CurrentUser() user: User) {
    return this.service.unassign(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission('transformacion', 'sim-cards', 'write')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.remove(id, user);
  }
}
