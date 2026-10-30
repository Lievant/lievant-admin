import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { SystemRole } from '../../auth/constants/roles.constant';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CreateCompetencyDto, UpdateCompetencyDto } from './competencies.dto';
import { CompetenciesService } from './competencies.service';

/**
 * Catálogo de Competencias. Se declara ANTES que `CatalogsController` en el módulo para que sus rutas
 * (`catalogs/competencies/…`) no las tome el controlador genérico `catalogs/:entity/…`. Misma protección que el
 * resto de catálogos: SUPER_ADMIN para administrar y solo sesión para `/active`.
 */
@UseGuards(JwtAuthGuard)
@Controller('catalogs/competencies')
export class CompetenciesController {
  constructor(private readonly competencies: CompetenciesService) {}

  @Get('active')
  findActive() {
    return this.competencies.findActive();
  }

  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @Get()
  findAll() {
    return this.competencies.findAll();
  }

  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @Post()
  create(@Body() dto: CreateCompetencyDto) {
    return this.competencies.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCompetencyDto) {
    return this.competencies.update(id, dto);
  }

  /** Igual que los demás catálogos: desactiva. */
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @Delete(':id')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.competencies.deactivate(id);
  }

  /** Eliminación lógica (ruta propia: no choca con el DELETE que desactiva). */
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @Delete(':id/remove')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.competencies.remove(id);
  }
}
