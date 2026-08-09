import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permission.decorator';
import { User } from '../auth/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AssignEmployeeDto } from './dto/assign-employee.dto';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { QueryEquipmentDto } from './dto/query-equipment.dto';
import { QueryEmployeesWithEquipmentDto } from './dto/query-employees.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { InventoryResponsivasService } from './inventory-responsivas.service';
import { InventoryService } from './inventory.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly service: InventoryService,
    private readonly responsivas: InventoryResponsivasService,
  ) {}

  // ── Vista por colaborador y responsivas ────────────────────────────────────
  // Declaradas antes de las rutas de /equipment para que Nest no las confunda,
  // y con el mismo permiso que el resto del inventario.

  @Get('employees')
  @RequirePermission('transformacion', 'inventario', 'read')
  listEmployeesWithEquipment(@Query() query: QueryEmployeesWithEquipmentDto) {
    return this.responsivas.listEmployeesWithEquipment(query);
  }

  @Get('employees/:employeeId')
  @RequirePermission('transformacion', 'inventario', 'read')
  getEmployeeDetail(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.responsivas.getEmployeeDetail(employeeId);
  }

  @Post('employees/:employeeId/responsiva')
  @RequirePermission('transformacion', 'inventario', 'write')
  generateResponsiva(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentUser() user: User,
  ) {
    return this.responsivas.generateResponsiva(employeeId, user.id);
  }

  @Get('employees/:employeeId/responsiva/download')
  @RequirePermission('transformacion', 'inventario', 'read')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  )
  async downloadResponsiva(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = await this.responsivas.buildResponsivaDocx(employeeId);
    // El nombre lleva acentos y espacios: filename* en UTF-8 y un filename
    // ASCII de respaldo para los clientes que no entienden RFC 5987.
    const ascii = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    res.setHeader('Content-Length', String(buffer.length));
    res.end(buffer);
  }

  // ── Catálogos ──────────────────────────────────────────────────────────────

  @Get('equipment-types')
  @RequirePermission('transformacion', 'inventario', 'read')
  getTypes() {
    return this.service.findTypes();
  }

  @Get('equipment-brands')
  @RequirePermission('transformacion', 'inventario', 'read')
  getBrands() {
    return this.service.findBrands();
  }

  @Get('equipment-statuses')
  @RequirePermission('transformacion', 'inventario', 'read')
  getStatuses() {
    return this.service.findStatuses();
  }

  // ── Inventario ─────────────────────────────────────────────────────────────

  @Get('equipment/stats')
  @RequirePermission('transformacion', 'inventario', 'read')
  getStats() {
    return this.service.getStats();
  }

  @Get('equipment/report/by-area')
  @RequirePermission('transformacion', 'inventario', 'read')
  getReportByArea() {
    return this.service.getReportByArea();
  }

  // Declarado antes de /:id para que no sea interceptado como UUID
  @Get('equipment/my')
  getMyEquipment(@CurrentUser() user: User) {
    return this.service.getMyEquipment(user.email);
  }

  // Declarado antes de /:id por la misma razón. Sin permiso de inventario:
  // lo usa el tab "Equipos y Licencias" de RRHH con su propio permiso.
  @Get('equipment/by-employee/:employeeId')
  @RequirePermission('rrhh', 'empleados.equipos', 'read')
  getEquipmentByEmployee(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.service.getEquipmentByEmployee(employeeId);
  }

  @Get('equipment')
  @RequirePermission('transformacion', 'inventario', 'read')
  findAll(@Query() query: QueryEquipmentDto) {
    return this.service.findAll(query);
  }

  @Get('equipment/:id')
  @RequirePermission('transformacion', 'inventario', 'read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Post('equipment')
  @RequirePermission('transformacion', 'inventario', 'write')
  create(@Body() dto: CreateEquipmentDto, @CurrentUser() user: User) {
    return this.service.create(dto, user.id, user.name);
  }

  @Patch('equipment/:id')
  @RequirePermission('transformacion', 'inventario', 'write')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEquipmentDto,
    @CurrentUser() user: User,
  ) {
    return this.service.update(id, dto, user.id, user.name);
  }

  @Patch('equipment/:id/assign')
  @RequirePermission('transformacion', 'inventario', 'write')
  assignEmployee(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignEmployeeDto,
    @CurrentUser() user: User,
  ) {
    return this.service.assignEmployee(id, dto, user.id, user.name);
  }

  @Patch('equipment/:id/unassign')
  @RequirePermission('transformacion', 'inventario', 'write')
  unassignEmployee(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { notes?: string },
    @CurrentUser() user: User,
  ) {
    return this.service.unassignEmployee(id, user.id, user.name, body?.notes);
  }

  @Get('equipment/:id/employee-equipment')
  @RequirePermission('transformacion', 'inventario', 'read')
  getEmployeeEquipment(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getEmployeeEquipmentFor(id);
  }
}
