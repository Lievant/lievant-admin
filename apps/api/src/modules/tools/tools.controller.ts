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
import { CreateToolDto } from './dto/create-tool.dto';
import { QueryToolsDto } from './dto/query-tools.dto';
import { UpdateToolDto } from './dto/update-tool.dto';
import { ToolsService } from './tools.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('tools')
export class ToolsController {
  constructor(private readonly service: ToolsService) {}

  // Rutas literales antes de /:id para que 'options' y 'stats' no se parseen
  // como UUID.
  // Las categorías salen de catalogs.tool_categories, así que las arma el
  // servicio y no una constante del controlador.
  @Get('options')
  @RequirePermission('transformacion', 'herramientas', 'read')
  getOptions() {
    return this.service.getOptions();
  }

  @Get('stats')
  @RequirePermission('transformacion', 'herramientas', 'read')
  getStats() {
    return this.service.getStats();
  }

  @Get()
  @RequirePermission('transformacion', 'herramientas', 'read')
  findAll(@Query() query: QueryToolsDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermission('transformacion', 'herramientas', 'read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermission('transformacion', 'herramientas', 'write')
  create(@Body() dto: CreateToolDto, @CurrentUser() user: User) {
    return this.service.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermission('transformacion', 'herramientas', 'write')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateToolDto,
    @CurrentUser() user: User,
  ) {
    return this.service.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermission('transformacion', 'herramientas', 'write')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.remove(id, user.id);
  }
}
