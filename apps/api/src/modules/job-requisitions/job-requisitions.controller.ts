import {
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
import {
  ApproveRequisitionDto,
  CreateRequisitionDto,
  MyRequisitionsQueryDto,
  RejectRequisitionDto,
  ReviewQueryDto,
  UpdateRequisitionDto,
} from './dto/job-requisition.dto';
import { JobRequisitionsReviewService } from './job-requisitions-review.service';
import { JobRequisitionsService, type Actor } from './job-requisitions.service';

const actorOf = (u: User): Actor => ({ id: u.id, email: u.email, name: u.name });

/**
 * Solicitud de Puesto (RRHH 2.0 · M8).
 *
 * - `my/*`: líderes. Solo sesión; el servidor verifica que el usuario sea líder
 *   (empleado activo vinculado con subordinados) y acota todo a su expediente.
 * - El resto: RRHH, con `rrhh.solicitudes-puesto.read|approve`.
 * Las rutas fijas (`my`, `summary`, `options`) van antes de `:id`.
 */
@Controller('hr/job-requisitions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class JobRequisitionsController {
  constructor(
    private readonly mine: JobRequisitionsService,
    private readonly review: JobRequisitionsReviewService,
  ) {}

  // ── Líder (solo sesión + verificación de líder en el servicio) ─────────────

  @Get('my/position-options')
  @SetMetadata(PERMISSION_KEY, null)
  myPositionOptions(@CurrentUser() user: User) {
    return this.mine.positionOptions(user.id);
  }

  @Get('my')
  @SetMetadata(PERMISSION_KEY, null)
  listMine(@CurrentUser() user: User, @Query() query: MyRequisitionsQueryDto) {
    return this.mine.listMine(user.id, query);
  }

  @Post('my')
  @SetMetadata(PERMISSION_KEY, null)
  createMine(@CurrentUser() user: User, @Body() dto: CreateRequisitionDto) {
    return this.mine.create(user.id, dto, actorOf(user));
  }

  @Get('my/:id')
  @SetMetadata(PERMISSION_KEY, null)
  getMine(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.mine.getMine(user.id, id);
  }

  @Patch('my/:id')
  @SetMetadata(PERMISSION_KEY, null)
  updateMine(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRequisitionDto) {
    return this.mine.update(user.id, id, dto, actorOf(user));
  }

  @Post('my/:id/submit')
  @SetMetadata(PERMISSION_KEY, null)
  submitMine(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.mine.submit(user.id, id, actorOf(user));
  }

  @Delete('my/:id')
  @SetMetadata(PERMISSION_KEY, null)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMine(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.mine.remove(user.id, id, actorOf(user));
  }

  // ── RRHH ───────────────────────────────────────────────────────────────────

  @Get('summary')
  @RequirePermission('rrhh', 'solicitudes-puesto', 'read')
  summary() {
    return this.review.getSummary();
  }

  @Get('options')
  @RequirePermission('rrhh', 'solicitudes-puesto', 'read')
  options() {
    return this.review.getOptions();
  }

  @Get()
  @RequirePermission('rrhh', 'solicitudes-puesto', 'read')
  list(@Query() query: ReviewQueryDto) {
    return this.review.list(query);
  }

  @Get(':id')
  @RequirePermission('rrhh', 'solicitudes-puesto', 'read')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.review.getDetail(id);
  }

  @Post(':id/approve')
  @RequirePermission('rrhh', 'solicitudes-puesto', 'approve')
  approve(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ApproveRequisitionDto, @CurrentUser() user: User) {
    return this.review.approve(id, dto.comments, actorOf(user));
  }

  @Post(':id/reject')
  @RequirePermission('rrhh', 'solicitudes-puesto', 'approve')
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectRequisitionDto, @CurrentUser() user: User) {
    return this.review.reject(id, dto.comments, actorOf(user));
  }
}
