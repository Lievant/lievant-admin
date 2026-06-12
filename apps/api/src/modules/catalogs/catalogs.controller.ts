import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { SystemRole } from '../auth/constants/roles.constant';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CatalogsService } from './catalogs.service';
import { CreateCatalogItemDto, UpdateCatalogItemDto } from './dto/catalog-item.dto';

@UseGuards(JwtAuthGuard)
@Controller('catalogs')
export class CatalogsController {
  constructor(private readonly catalogsService: CatalogsService) {}

  @Get(':entity/active')
  findActive(@Param('entity') entity: string) {
    return this.catalogsService.findActive(entity);
  }

  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @Get(':entity')
  findAll(@Param('entity') entity: string) {
    return this.catalogsService.findAll(entity);
  }

  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @Post(':entity')
  create(@Param('entity') entity: string, @Body() dto: CreateCatalogItemDto) {
    return this.catalogsService.create(entity, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @Patch(':entity/:id')
  update(@Param('entity') entity: string, @Param('id') id: string, @Body() dto: UpdateCatalogItemDto) {
    return this.catalogsService.update(entity, id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @Delete(':entity/:id')
  deactivate(@Param('entity') entity: string, @Param('id') id: string) {
    return this.catalogsService.deactivate(entity, id);
  }
}
