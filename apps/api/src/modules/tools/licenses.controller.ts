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
import { LICENSE_STATUSES, TOOL_CURRENCIES } from './constants/tools.constants';
import {
  CreateLicenseDto,
  QueryLicensesDto,
  RevokeLicenseDto,
  UpdateLicenseDto,
} from './dto/license.dto';
import { ToolLicensesService } from './licenses.service';

/**
 * Se monta en /tool-licenses y no en /licenses porque ese prefijo ya lo ocupa el
 * Maestro de Licenciamientos (LicensesController, rutas /licenses/employees y
 * /licenses/tools). Un `GET /licenses/:id` aquí capturaría esas dos rutas según
 * el orden en que Nest registre los módulos: funcionaría hoy y se rompería en
 * silencio el día que alguien reordene los imports de AppModule.
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('tool-licenses')
export class ToolLicensesController {
  constructor(private readonly service: ToolLicensesService) {}

  // Rutas literales antes de /:id para que no se parseen como UUID.
  @Get('options')
  @RequirePermission('transformacion', 'licencias', 'read')
  getOptions() {
    return { statuses: LICENSE_STATUSES, currencies: TOOL_CURRENCIES };
  }

  @Get('stats')
  @RequirePermission('transformacion', 'licencias', 'read')
  getStats() {
    return this.service.getStats();
  }

  @Get('by-tool/:toolId')
  @RequirePermission('transformacion', 'licencias', 'read')
  findByTool(@Param('toolId', ParseUUIDPipe) toolId: string) {
    return this.service.findByTool(toolId);
  }

  @Get('by-employee/:employeeId')
  @RequirePermission('transformacion', 'licencias', 'read')
  findByEmployee(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.service.findByEmployee(employeeId);
  }

  @Get()
  @RequirePermission('transformacion', 'licencias', 'read')
  findAll(@Query() query: QueryLicensesDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermission('transformacion', 'licencias', 'read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermission('transformacion', 'licencias', 'write')
  create(@Body() dto: CreateLicenseDto, @CurrentUser() user: User) {
    return this.service.createLicense(dto, user.id);
  }

  @Patch(':id')
  @RequirePermission('transformacion', 'licencias', 'write')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLicenseDto,
    @CurrentUser() user: User,
  ) {
    return this.service.updateLicense(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermission('transformacion', 'licencias', 'write')
  revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevokeLicenseDto,
    @CurrentUser() user: User,
  ) {
    return this.service.revokeLicense(id, user.id, dto ?? {});
  }
}
