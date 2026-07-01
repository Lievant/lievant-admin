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
import { AssignEmployeeDto } from './dto/assign-employee.dto';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { QueryEquipmentDto } from './dto/query-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { InventoryService } from './inventory.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('transformacion', 'inventario', 'read')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  // ── Catálogos ──────────────────────────────────────────────────────────────

  @Get('equipment-types')
  getTypes() {
    return this.service.findTypes();
  }

  @Get('equipment-brands')
  getBrands() {
    return this.service.findBrands();
  }

  @Get('equipment-statuses')
  getStatuses() {
    return this.service.findStatuses();
  }

  // ── Inventario ─────────────────────────────────────────────────────────────

  @Get('equipment/stats')
  getStats() {
    return this.service.getStats();
  }

  @Get('equipment')
  findAll(@Query() query: QueryEquipmentDto) {
    return this.service.findAll(query);
  }

  @Get('equipment/:id')
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
}
