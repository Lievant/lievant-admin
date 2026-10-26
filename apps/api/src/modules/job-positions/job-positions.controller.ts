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
import {
  CreateKpiDto,
  CreateOkrDto,
  CreatePositionDto,
  OkrQueryDto,
  PositionQueryDto,
  UpdateKpiDto,
  UpdateOkrDto,
  UpdatePositionDto,
} from './dto/job-position.dto';
import { JobPositionItemsService } from './job-position-items.service';
import { JobPositionsService, type Actor } from './job-positions.service';

const actorOf = (u: User): Actor => ({ id: u.id, email: u.email, name: u.name });

/**
 * Matriz de Puestos (RRHH 2.0 · M6-A). Datos confidenciales (C3): todo exige
 * `rrhh.matriz-puestos.<acción>`. Las rutas fijas (`options`) van antes de `:id`.
 */
@Controller('hr')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class JobPositionsController {
  constructor(
    private readonly positions: JobPositionsService,
    private readonly items: JobPositionItemsService,
  ) {}

  // ── Puestos ────────────────────────────────────────────────────────────────

  @Get('job-positions/options')
  @RequirePermission('rrhh', 'matriz-puestos', 'read')
  options() {
    return this.positions.getOptions();
  }

  @Get('job-positions')
  @RequirePermission('rrhh', 'matriz-puestos', 'read')
  list(@Query() query: PositionQueryDto) {
    return this.positions.list(query);
  }

  @Post('job-positions')
  @RequirePermission('rrhh', 'matriz-puestos', 'create')
  create(@Body() dto: CreatePositionDto, @CurrentUser() user: User) {
    return this.positions.create(dto, actorOf(user));
  }

  @Get('job-positions/:id')
  @RequirePermission('rrhh', 'matriz-puestos', 'read')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.positions.getDetail(id);
  }

  @Patch('job-positions/:id')
  @RequirePermission('rrhh', 'matriz-puestos', 'update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePositionDto, @CurrentUser() user: User) {
    return this.positions.update(id, dto, actorOf(user));
  }

  @Delete('job-positions/:id')
  @RequirePermission('rrhh', 'matriz-puestos', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.positions.remove(id, actorOf(user));
  }

  @Post('job-positions/:id/approve-description')
  @RequirePermission('rrhh', 'matriz-puestos', 'approve')
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.positions.approveDescription(id, actorOf(user));
  }

  // ── OKRs ───────────────────────────────────────────────────────────────────

  @Get('job-positions/:id/okrs')
  @RequirePermission('rrhh', 'matriz-puestos', 'read')
  listOkrs(@Param('id', ParseUUIDPipe) id: string, @Query() query: OkrQueryDto) {
    return this.items.listOkrs(id, query.period);
  }

  @Post('job-positions/:id/okrs')
  @RequirePermission('rrhh', 'matriz-puestos', 'update')
  createOkr(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateOkrDto, @CurrentUser() user: User) {
    return this.items.createOkr(id, dto, actorOf(user));
  }

  @Patch('job-position-okrs/:okrId')
  @RequirePermission('rrhh', 'matriz-puestos', 'update')
  updateOkr(@Param('okrId', ParseUUIDPipe) okrId: string, @Body() dto: UpdateOkrDto, @CurrentUser() user: User) {
    return this.items.updateOkr(okrId, dto, actorOf(user));
  }

  @Delete('job-position-okrs/:okrId')
  @RequirePermission('rrhh', 'matriz-puestos', 'update')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeOkr(@Param('okrId', ParseUUIDPipe) okrId: string, @CurrentUser() user: User) {
    return this.items.removeOkr(okrId, actorOf(user));
  }

  // ── KPIs ───────────────────────────────────────────────────────────────────

  @Get('job-positions/:id/kpis')
  @RequirePermission('rrhh', 'matriz-puestos', 'read')
  listKpis(@Param('id', ParseUUIDPipe) id: string) {
    return this.items.listKpis(id);
  }

  @Post('job-positions/:id/kpis')
  @RequirePermission('rrhh', 'matriz-puestos', 'update')
  createKpi(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateKpiDto, @CurrentUser() user: User) {
    return this.items.createKpi(id, dto, actorOf(user));
  }

  @Patch('job-position-kpis/:kpiId')
  @RequirePermission('rrhh', 'matriz-puestos', 'update')
  updateKpi(@Param('kpiId', ParseUUIDPipe) kpiId: string, @Body() dto: UpdateKpiDto, @CurrentUser() user: User) {
    return this.items.updateKpi(kpiId, dto, actorOf(user));
  }

  @Delete('job-position-kpis/:kpiId')
  @RequirePermission('rrhh', 'matriz-puestos', 'update')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeKpi(@Param('kpiId', ParseUUIDPipe) kpiId: string, @CurrentUser() user: User) {
    return this.items.removeKpi(kpiId, actorOf(user));
  }
}
