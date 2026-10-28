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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permission.decorator';
import { User } from '../auth/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import {
  CreateActivityDto,
  CreateAreaDto,
  CreateKpiDto,
  CreateOkrDto,
  CreatePositionDto,
  ImportBodyDto,
  OkrQueryDto,
  PositionQueryDto,
  UpdateActivityDto,
  UpdateKpiDto,
  UpdateOkrDto,
  UpdatePositionDto,
} from './dto/job-position.dto';
import { JobPositionsImportService } from './job-positions-import.service';
import { MAX_IMPORT_BYTES } from './job-positions-import.parser';
import { JobPositionActivitiesService } from './job-position-activities.service';
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
    private readonly activities: JobPositionActivitiesService,
    private readonly importer: JobPositionsImportService,
  ) {}

  // ── Puestos ────────────────────────────────────────────────────────────────

  @Get('job-positions/options')
  @RequirePermission('rrhh', 'matriz-puestos', 'read')
  options() {
    return this.positions.getOptions();
  }

  /** Importación desde Excel (`mode` = preview | apply; el mismo archivo se reenvía para aplicar). Va antes de `:id`. */
  @Post('job-positions/import')
  @RequirePermission('rrhh', 'matriz-puestos', 'import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMPORT_BYTES + 1, files: 1 } }))
  importPositions(@Body() body: ImportBodyDto, @UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() user: User) {
    return this.importer.run(body.mode, body.division, file, actorOf(user));
  }

  /** Agrega un área al catálogo (la Matriz no deja capturar áreas como texto libre). */
  @Post('job-position-areas')
  @RequirePermission('rrhh', 'matriz-puestos', 'update')
  createArea(@Body() dto: CreateAreaDto, @CurrentUser() user: User) {
    return this.positions.createArea(dto, actorOf(user));
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

  // ── Actividades ────────────────────────────────────────────────────────────

  @Get('job-positions/:id/activities')
  @RequirePermission('rrhh', 'matriz-puestos', 'read')
  listActivities(@Param('id', ParseUUIDPipe) id: string) {
    return this.activities.list(id);
  }

  @Post('job-positions/:id/activities')
  @RequirePermission('rrhh', 'matriz-puestos', 'update')
  createActivity(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateActivityDto, @CurrentUser() user: User) {
    return this.activities.create(id, dto, actorOf(user));
  }

  @Patch('job-position-activities/:activityId')
  @RequirePermission('rrhh', 'matriz-puestos', 'update')
  updateActivity(@Param('activityId', ParseUUIDPipe) activityId: string, @Body() dto: UpdateActivityDto, @CurrentUser() user: User) {
    return this.activities.update(activityId, dto, actorOf(user));
  }

  @Delete('job-position-activities/:activityId')
  @RequirePermission('rrhh', 'matriz-puestos', 'update')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeActivity(@Param('activityId', ParseUUIDPipe) activityId: string, @CurrentUser() user: User) {
    return this.activities.remove(activityId, actorOf(user));
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
