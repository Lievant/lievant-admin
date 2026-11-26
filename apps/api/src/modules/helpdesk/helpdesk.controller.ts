import {
  BadRequestException,
  Body,
  ForbiddenException,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permission.decorator';
import { User } from '../auth/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ChangeTicketCategoryDto } from './dto/change-ticket-category.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateTicketSurveyDto } from './dto/create-ticket-survey.dto';
import { EscalateTicketDto } from './dto/escalate-ticket.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { ALLOWED_ATTACHMENT_MIME_TYPES } from './helpdesk-storage.service';
import { UpsertCategoryDto, UpsertSubcategoryDto } from './dto/helpdesk-catalog.dto';
import { HelpdeskService } from './helpdesk.service';
import { isTdUser } from './td-user.util';

@UseGuards(JwtAuthGuard)
@Controller('helpdesk')
export class HelpdeskController {
  constructor(private readonly service: HelpdeskService) {}

  // ------- Catalogs -------------------------------------------------------

  @Get('categories')
  getCategories() {
    return this.service.findCategories();
  }

  @Get('categories/:slug/subcategories')
  getSubcategories(@Param('slug') slug: string) {
    return this.service.findSubcategories(slug);
  }

  // ── Administración del catálogo de categorías ───────────────────────────
  // Rutas literales bajo /admin para no chocar con /categories/:slug.
  @Get('admin/categories')
  @RequirePermission('admin', 'helpdesk-categorias', 'read')
  findAllCategories() {
    return this.service.findAllCategories();
  }

  @Get('admin/subcategories')
  @RequirePermission('admin', 'helpdesk-categorias', 'read')
  findAllSubcategories() {
    return this.service.findAllSubcategories();
  }

  @Post('admin/categories')
  @RequirePermission('admin', 'helpdesk-categorias', 'write')
  createCategory(@Body() dto: UpsertCategoryDto) {
    return this.service.createCategory(dto);
  }

  @Patch('admin/categories/:slug')
  @RequirePermission('admin', 'helpdesk-categorias', 'write')
  updateCategory(@Param('slug') slug: string, @Body() dto: UpsertCategoryDto) {
    return this.service.updateCategory(slug, dto);
  }

  @Delete('admin/categories/:slug')
  @RequirePermission('admin', 'helpdesk-categorias', 'write')
  deactivateCategory(@Param('slug') slug: string) {
    return this.service.deactivateCategory(slug);
  }

  @Post('admin/categories/:slug/subcategories')
  @RequirePermission('admin', 'helpdesk-categorias', 'write')
  createSubcategory(@Param('slug') slug: string, @Body() dto: UpsertSubcategoryDto) {
    return this.service.createSubcategory(slug, dto);
  }

  @Patch('admin/subcategories/:id')
  @RequirePermission('admin', 'helpdesk-categorias', 'write')
  updateSubcategory(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpsertSubcategoryDto) {
    return this.service.updateSubcategory(id, dto);
  }

  @Delete('admin/subcategories/:id')
  @RequirePermission('admin', 'helpdesk-categorias', 'write')
  deactivateSubcategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deactivateSubcategory(id);
  }

  @Get('assignees')
  getAssignees() {
    return this.service.findAssignees();
  }

  // ------- Tickets --------------------------------------------------------

  @Get('tickets/stats')
  @UseGuards(PermissionsGuard)
  @RequirePermission('transformacion', 'tickets.reportes', 'read')
  getStats(
    @Query('from', new DefaultValuePipe('')) from: string,
    @Query('to', new DefaultValuePipe('')) to: string,
  ) {
    return this.service.getStats(from || undefined, to || undefined);
  }

  @Get('tickets/my')
  getMyTickets(@Query() query: QueryTicketsDto, @CurrentUser() user: User) {
    return this.service.findMyTickets(user.id, query);
  }

  /** Detalle para "Mis tickets": solo el solicitante; sin notas internas ni diagnóstico. */
  @Get('tickets/my/:id')
  getMyTicket(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.findMyTicketDetail(user.id, id);
  }

  @Get('tickets')
  findAll(@Query() query: QueryTicketsDto, @CurrentUser() user: User) {
    return this.service.findAll(query, isTdUser(user), user.id);
  }

  /** TD ve cualquier ticket; los demás, solo el suyo y sin notas internas (404 si no). */
  @Get('tickets/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.findById(id, { userId: user.id, isTd: isTdUser(user) });
  }

  @Post('tickets')
  create(@Body() dto: CreateTicketDto, @CurrentUser() user: User) {
    return this.service.create(dto, user, isTdUser(user));
  }

  @Patch('tickets/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('transformacion', 'tickets.gestion', 'write')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: User,
  ) {
    return this.service.updateTicket(id, dto, user);
  }

  /** Solo personal de TD (mismo criterio que abrir en nombre de otro). El solicitante recibe 403. */
  @Patch('tickets/:id/category')
  changeCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeTicketCategoryDto,
    @CurrentUser() user: User,
  ) {
    if (!isTdUser(user)) throw new ForbiddenException('Solo el personal de TD puede cambiar la categoría.');
    return this.service.changeCategory(id, dto, user);
  }

  /** Encuesta de satisfacción: solo el solicitante de un ticket cerrado, una vez. */
  @Post('tickets/:id/survey')
  answerSurvey(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTicketSurveyDto,
    @CurrentUser() user: User,
  ) {
    return this.service.answerSurvey(id, dto, user);
  }

  /** La ven el solicitante y TD; nadie más. */
  @Get('tickets/:id/survey')
  getSurvey(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.getSurvey(id, user, isTdUser(user));
  }

  /** TD: cualquier transición. Solicitante: solo reabrir su ticket cerrado (≤ 7 días). Resto: 403. */
  @Patch('tickets/:id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.service.updateStatus(id, dto, user, isTdUser(user));
  }

  /** "Confirmar resolución": solo el solicitante, en su ticket resuelto. Sin tickets.gestion. */
  @Patch('tickets/:id/confirm-resolution')
  confirmResolution(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.confirmResolution(id, user);
  }

  @Patch('tickets/:id/escalate')
  @UseGuards(PermissionsGuard)
  @RequirePermission('transformacion', 'tickets.gestion', 'write')
  escalate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EscalateTicketDto,
    @CurrentUser() user: User,
  ) {
    return this.service.escalate(id, dto, user);
  }

  @Delete('tickets/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('transformacion', 'tickets.gestion', 'write')
  deleteTicket(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteTicket(id);
  }

  // ------- Attachments ----------------------------------------------------

  @Get('tickets/:id/attachments')
  getAttachments(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getAttachments(id);
  }

  @Post('tickets/:id/attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadAttachment(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo.');
    if (!(ALLOWED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipo no permitido. Acepta: ${ALLOWED_ATTACHMENT_MIME_TYPES.join(', ')}`,
      );
    }
    return this.service.uploadAttachment(id, file, user.id);
  }
}
