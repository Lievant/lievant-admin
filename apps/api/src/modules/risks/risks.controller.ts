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
import { CreateRiskDto, UpdateRiskDto } from './dto/risk.dto';
import { RisksService } from './risks.service';

/** Matriz de Riesgos (TIC-RE-08): lectura con `sgsi.riesgos.read`, escritura con `.write`. */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('risks')
export class RisksController {
  constructor(private readonly service: RisksService) {}

  @Get()
  @RequirePermission('sgsi', 'riesgos', 'read')
  list() {
    return this.service.list();
  }

  /** Candidatos a dueño: solo id, nombre y correo. Va antes de `:id`. */
  @Get('owner-candidates')
  @RequirePermission('sgsi', 'riesgos', 'write')
  ownerCandidates(@Query('q') q?: string) {
    return this.service.searchOwnerCandidates(q);
  }

  @Get(':id')
  @RequirePermission('sgsi', 'riesgos', 'read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Post()
  @RequirePermission('sgsi', 'riesgos', 'write')
  create(@Body() dto: CreateRiskDto, @CurrentUser() user: User) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @RequirePermission('sgsi', 'riesgos', 'write')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRiskDto,
    @CurrentUser() user: User,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission('sgsi', 'riesgos', 'write')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.remove(id, user);
  }
}
