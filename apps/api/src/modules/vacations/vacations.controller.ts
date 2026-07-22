import {
  Body,
  Controller,
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
import { CreateVacationRequestDto } from './dto/create-vacation-request.dto';
import {
  CalculateDaysDto,
  HolidaysQueryDto,
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

  // ── Cron manual ────────────────────────────────────────────────────────────

  @Post('process-anniversaries')
  @RequirePermission('rrhh', 'empleados.vacaciones', 'write')
  processAnniversaries() {
    return this.service.processAnniversaries();
  }
}
