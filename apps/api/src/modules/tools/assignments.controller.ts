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
import { AssignmentsService } from './assignments.service';
import {
  CreateAssignerDto,
  CreateAssignmentDto,
  QueryAssignmentsDto,
  RevokeAssignmentDto,
  UpdateLastUsedDto,
} from './dto/assignment.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly service: AssignmentsService) {}

  // Rutas literales antes de /:id para que no se parseen como UUID.
  @Get('stats')
  @RequirePermission('transformacion', 'asignaciones', 'read')
  getStats() {
    return this.service.getStats();
  }

  @Get('areas')
  @RequirePermission('transformacion', 'asignaciones', 'read')
  getAreas() {
    return this.service.getAreas();
  }

  @Get('assigners')
  @RequirePermission('transformacion', 'asignaciones', 'read')
  getAssigners() {
    return this.service.getAssigners();
  }

  @Post('assigners')
  @RequirePermission('transformacion', 'asignaciones', 'write')
  addAssigner(@Body() dto: CreateAssignerDto) {
    return this.service.addAssigner(dto);
  }

  @Delete('assigners/:id')
  @RequirePermission('transformacion', 'asignaciones', 'write')
  removeAssigner(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeAssigner(id);
  }

  // Sin permiso de asignaciones: lo consume la pestaña "Equipos y Licencias"
  // del expediente, que tiene el suyo. Declarado antes de /:id por ruteo.
  @Get('by-employee/:employeeId')
  @RequirePermission('rrhh', 'empleados.licencias', 'read')
  getByEmployee(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.service.getByEmployee(employeeId);
  }

  @Get()
  @RequirePermission('transformacion', 'asignaciones', 'read')
  getAssignments(@Query() query: QueryAssignmentsDto) {
    return this.service.getAssignments(query);
  }

  @Get(':id')
  @RequirePermission('transformacion', 'asignaciones', 'read')
  getAssignment(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getAssignment(id);
  }

  @Post()
  @RequirePermission('transformacion', 'asignaciones', 'write')
  createAssignment(@Body() dto: CreateAssignmentDto, @CurrentUser() user: User) {
    return this.service.createAssignment(dto, user.id);
  }

  @Patch(':id/revoke')
  @RequirePermission('transformacion', 'asignaciones', 'write')
  revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevokeAssignmentDto,
    @CurrentUser() user: User,
  ) {
    return this.service.revokeAssignment(id, user.id, dto ?? {});
  }

  @Patch(':id/last-used')
  @RequirePermission('transformacion', 'asignaciones', 'write')
  updateLastUsed(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLastUsedDto) {
    return this.service.updateLastUsed(id, dto.date);
  }
}
