import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permission.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { SystemRole } from '../auth/constants/roles.constant';
import { User } from '../auth/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateToolDto, UpdateToolDto } from './dto/tool-catalog.dto';
import { QueryLicensesDto } from './dto/query-licenses.dto';
import { UpsertLicensesDto } from './dto/upsert-licenses.dto';
import { LicensesService } from './licenses.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('licenses')
export class LicensesController {
  constructor(private readonly service: LicensesService) {}

  @Get('employees')
  @RequirePermission('transformacion', 'licenciamientos', 'read')
  findAll(@Query() query: QueryLicensesDto) {
    return this.service.findAll(query);
  }

  @Get('employees/stats')
  @RequirePermission('transformacion', 'licenciamientos', 'read')
  getStats() {
    return this.service.getStats();
  }

  // Sin permiso de licenciamientos: lo usa el tab "Equipos y Licencias" de
  // RRHH con su propio permiso. Declarado antes de /:id por seguridad de ruteo.
  @Get('employees/by-employee/:employeeId')
  @RequirePermission('rrhh', 'empleados.licencias', 'read')
  getLicensesByEmployee(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.service.findByEmployee(employeeId);
  }

  @Get('employees/:id')
  @RequirePermission('transformacion', 'licenciamientos', 'read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findByEmployee(id);
  }

  @Put('employees/:id')
  @RequirePermission('transformacion', 'licenciamientos', 'write')
  upsert(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertLicensesDto,
    @CurrentUser() user: User,
  ) {
    return this.service.upsertLicenses(id, dto, user.id);
  }

  @Get('tools')
  @RequirePermission('transformacion', 'licenciamientos', 'read')
  getTools() {
    return this.service.getTools();
  }

  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @Post('tools')
  createTool(@Body() dto: CreateToolDto) {
    return this.service.createTool(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @Patch('tools/:id')
  updateTool(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateToolDto) {
    return this.service.updateTool(id, dto);
  }
}
