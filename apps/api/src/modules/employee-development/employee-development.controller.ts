import {
  BadRequestException,
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
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSION_KEY, RequirePermission } from '../auth/decorators/permission.decorator';
import { User } from '../auth/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AssignDto, PeriodQueryDto, SetPositionDto } from './dto/employee-development.dto';
import { EmployeeDevelopmentService, type Actor } from './employee-development.service';

const actorOf = (u: User): Actor => ({ id: u.id, email: u.email, name: u.name });

/**
 * Desarrollo Organizacional (RRHH 2.0 · M5). Lectura por empleado: solo sesión,
 * con la regla de acceso (permiso `read`, el propio empleado o su líder directo)
 * validada en el servicio; escritura siempre con `write`. Las rutas fijas
 * (`position-options`) van antes de `:employeeId`.
 */
@Controller('hr')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmployeeDevelopmentController {
  constructor(private readonly service: EmployeeDevelopmentService) {}

  @Get('employee-development/position-options')
  @RequirePermission('rrhh', 'desarrollo-organizacional', 'read')
  positionOptions() {
    return this.service.positionOptions();
  }

  @Get('employee-development/:employeeId')
  @SetMetadata(PERMISSION_KEY, null)
  get(@Param('employeeId', ParseUUIDPipe) employeeId: string, @Query() query: PeriodQueryDto, @CurrentUser() user: User) {
    return this.service.getForUser(user, employeeId, query.period);
  }

  @Patch('employee-development/:employeeId/position')
  @RequirePermission('rrhh', 'desarrollo-organizacional', 'write')
  setPosition(@Param('employeeId', ParseUUIDPipe) employeeId: string, @Body() dto: SetPositionDto, @CurrentUser() user: User) {
    if (dto.jobPositionId === undefined) throw new BadRequestException('Indica jobPositionId (o null para desvincular)');
    return this.service.setPosition(employeeId, dto.jobPositionId, actorOf(user));
  }

  @Post('employee-development/:employeeId/assign')
  @RequirePermission('rrhh', 'desarrollo-organizacional', 'write')
  assign(@Param('employeeId', ParseUUIDPipe) employeeId: string, @Body() dto: AssignDto, @CurrentUser() user: User) {
    return this.service.assign(employeeId, dto.period, actorOf(user));
  }

  @Delete('employee-okrs/:id')
  @RequirePermission('rrhh', 'desarrollo-organizacional', 'write')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeOkr(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.removeOkr(id, actorOf(user));
  }

  @Delete('employee-kpis/:id')
  @RequirePermission('rrhh', 'desarrollo-organizacional', 'write')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeKpi(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.removeKpi(id, actorOf(user));
  }

  /** Asignación masiva desde la Matriz: exige `matriz-puestos.update` aquí y `desarrollo-organizacional.write` en el servicio. */
  @Post('job-positions/:id/assign-to-employees')
  @RequirePermission('rrhh', 'matriz-puestos', 'update')
  assignToEmployees(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignDto, @CurrentUser() user: User) {
    return this.service.assignToPositionEmployees(user, id, dto.period, actorOf(user));
  }
}
