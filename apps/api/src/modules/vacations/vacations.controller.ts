import {
  Body,
  Controller,
  Delete,
  Get,
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
import { AdminCreateVacationRequestDto } from './dto/admin-create-vacation-request.dto';
import { CreateVacationRequestDto } from './dto/create-vacation-request.dto';
import {
  CalculateDaysDto,
  HolidaysQueryDto,
  VacationMasterQueryDto,
  VacationReportQueryDto,
} from './dto/query-vacations.dto';
import { RejectVacationRequestDto } from './dto/reject-vacation-request.dto';
import { VacationsService } from './vacations.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('vacations')
export class VacationsController {
  constructor(private readonly service: VacationsService) {}

  // ── Colaborador ──────────────────────────────────────────────────────────

  @Get('my-balance')
  @RequirePermission('herramientas', 'vacaciones', 'read')
  getMyBalance(@CurrentUser() user: User) {
    return this.service.getMyBalance(user.id);
  }

  @Get('my-requests')
  @RequirePermission('herramientas', 'vacaciones', 'read')
  getMyRequests(@CurrentUser() user: User) {
    return this.service.getMyRequests(user.id);
  }

  @Post('requests')
  @RequirePermission('herramientas', 'vacaciones', 'write')
  createRequest(@Body() dto: CreateVacationRequestDto, @CurrentUser() user: User) {
    return this.service.createRequest(dto, user.id);
  }

  @Get('calculate-days')
  @RequirePermission('herramientas', 'vacaciones', 'read')
  calculateDays(@Query() query: CalculateDaysDto, @CurrentUser() user: User) {
    return this.service.calculateDaysForUser(query.startDate, query.endDate, user.id, query.employeeId);
  }

  @Get('holidays')
  @RequirePermission('herramientas', 'vacaciones', 'read')
  getHolidays(@Query() query: HolidaysQueryDto) {
    const year = query.year ?? new Date().getUTCFullYear();
    return this.service.getHolidays(year);
  }

  // ── Jefe / aprobaciones ──────────────────────────────────────────────────

  @Get('pending-approvals')
  @RequirePermission('herramientas', 'vacaciones', 'read')
  getPendingApprovals(@CurrentUser() user: User) {
    return this.service.getPendingApprovals(user.id);
  }

  @Patch('requests/:id/approve')
  @RequirePermission('herramientas', 'vacaciones', 'write')
  approveRequest(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.approveRequest(id, user);
  }

  @Patch('requests/:id/reject')
  @RequirePermission('herramientas', 'vacaciones', 'write')
  rejectRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectVacationRequestDto,
    @CurrentUser() user: User,
  ) {
    return this.service.rejectRequest(id, user, dto.reason);
  }

  // ── RRHH ───────────────────────────────────────────────────────────────────

  @Get('employees/:id/summary')
  @RequirePermission('rrhh', 'empleados.vacaciones', 'read')
  getEmployeeSummary(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getEmployeeVacationSummary(id);
  }

  @Get('report')
  @RequirePermission('rrhh', 'reportes.vacaciones', 'read')
  getReport(@Query() query: VacationReportQueryDto) {
    return this.service.getVacationReport(query.startDate, query.endDate);
  }

  @Get('report/master')
  @RequirePermission('rrhh', 'reportes.vacaciones', 'read')
  getMasterReport(@Query() query: VacationMasterQueryDto) {
    return this.service.getVacationMasterReport({
      search: query.search,
      anniversaryWithin: query.anniversary_within,
    });
  }

  // ── Gestión manual (rrhh.vacaciones.manage) ────────────────────────────────
  // La aprobación admin va en 'admin-approve' y no en 'approve' porque esa ruta
  // ya está tomada por el flujo de jefatura directa (herramientas.vacaciones.
  // write); declarar dos handlers en la misma ruta haría que Nest resolviera
  // siempre el primero y el permiso manage nunca aplicaría.

  @Post('requests/admin')
  @RequirePermission('rrhh', 'vacaciones', 'manage')
  adminCreateRequest(@Body() dto: AdminCreateVacationRequestDto, @CurrentUser() user: User) {
    return this.service.adminCreateRequest(dto, user);
  }

  // Mismo cálculo que 'calculate-days', pero autorizado por manage: un usuario
  // de RRHH puede no tener herramientas.vacaciones.read y el modal de alta
  // necesita los días hábiles del colaborador.
  @Get('admin/calculate-days')
  @RequirePermission('rrhh', 'vacaciones', 'manage')
  adminCalculateDays(@Query() query: CalculateDaysDto, @CurrentUser() user: User) {
    return this.service.calculateDaysForUser(query.startDate, query.endDate, user.id, query.employeeId);
  }

  @Patch('requests/:id/admin-approve')
  @RequirePermission('rrhh', 'vacaciones', 'manage')
  adminApproveRequest(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.adminApproveRequest(id, user);
  }

  // Sin @RequirePermission a propósito: la regla es un OR (el dueño la borra
  // con herramientas.vacaciones.read, RRHH con rrhh.vacaciones.manage) y el
  // guard solo evalúa un permiso. Exigir herramientas.vacaciones.read aquí
  // dejaría fuera a los usuarios de RRHH que no lo tienen —el mismo caso que
  // documenta 'admin/calculate-days' arriba—, así que la autorización completa
  // vive en deleteRequest().
  @Delete('requests/:id')
  deleteRequest(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.deleteRequest(id, user);
  }

  // ── Cron manual ────────────────────────────────────────────────────────────

  @Post('process-anniversaries')
  @RequirePermission('rrhh', 'empleados.vacaciones', 'write')
  processAnniversaries() {
    return this.service.processAnniversaries();
  }
}
