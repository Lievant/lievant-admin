import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  Res,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSION_KEY, RequirePermission } from '../auth/decorators/permission.decorator';
import { User } from '../auth/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { PeriodQueryDto, ReportQueryDto, SaveEvaluationDto } from './dto/okr-evaluations.dto';
import { OkrEvaluationsReportService } from './okr-evaluations-report.service';
import { OkrEvaluationsService, type Actor } from './okr-evaluations.service';

const actorOf = (u: User): Actor => ({ id: u.id, email: u.email, name: u.name });

/**
 * Evaluación de OKRs (RRHH 2.0 · M7).
 * - `my-team/*`: líderes. Solo sesión; el servicio verifica que sea líder y que el
 *   colaborador sea su subordinado DIRECTO (si no, 404). RRHH nunca califica.
 * - `report/*`: RRHH con `rrhh.okrs.read` (solo lectura).
 * Las rutas fijas (`my-team/periods`, `report/*`) van antes de las que llevan `:employeeId`.
 */
@Controller('hr/okr-evaluations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OkrEvaluationsController {
  constructor(
    private readonly evaluations: OkrEvaluationsService,
    private readonly report: OkrEvaluationsReportService,
  ) {}

  // ── Líder ──────────────────────────────────────────────────────────────────

  @Get('my-team/periods')
  @SetMetadata(PERMISSION_KEY, null)
  periods(@CurrentUser() user: User) {
    return this.evaluations.periods(user.id);
  }

  @Get('my-team')
  @SetMetadata(PERMISSION_KEY, null)
  myTeam(@CurrentUser() user: User, @Query() query: PeriodQueryDto) {
    return this.evaluations.myTeam(user.id, query.period);
  }

  @Get('my-team/:employeeId')
  @SetMetadata(PERMISSION_KEY, null)
  member(@CurrentUser() user: User, @Param('employeeId', ParseUUIDPipe) employeeId: string, @Query() query: PeriodQueryDto) {
    return this.evaluations.memberOkrs(user, employeeId, query.period);
  }

  @Put('my-team/:employeeId/okrs/:employeeOkrId')
  @SetMetadata(PERMISSION_KEY, null)
  save(
    @CurrentUser() user: User,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('employeeOkrId', ParseUUIDPipe) employeeOkrId: string,
    @Body() dto: SaveEvaluationDto,
  ) {
    return this.evaluations.save(user, employeeId, employeeOkrId, dto, actorOf(user));
  }

  // ── RRHH ───────────────────────────────────────────────────────────────────

  @Get('report/options')
  @RequirePermission('rrhh', 'okrs', 'read')
  reportOptions() {
    return this.report.getOptions();
  }

  @Get('report/export')
  @RequirePermission('rrhh', 'okrs', 'read')
  async exportReport(@Query() dto: ReportQueryDto, @CurrentUser() user: User, @Res({ passthrough: true }) res: Response) {
    const { buffer, fileName } = await this.report.exportExcel(dto, actorOf(user));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
    return undefined;
  }

  @Get('report')
  @RequirePermission('rrhh', 'okrs', 'read')
  getReport(@Query() dto: ReportQueryDto) {
    return this.report.getReport(dto);
  }
}
