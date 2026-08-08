import {
  BadRequestException,
  Body,
  Controller,
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
import { ALLOWED_INVOICE_MIME_TYPES } from './credit-cards-storage.service';
import { CreditCardsService } from './credit-cards.service';
import {
  CreateCardReportDto,
  CreateCreditCardDto,
  ProcessCardReportDto,
  QueryCardReportsDto,
  QueryCreditCardsDto,
  UpdateCardReportDto,
  UpdateCreditCardDto,
} from './dto/credit-cards.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('credit-cards')
export class CreditCardsController {
  constructor(private readonly service: CreditCardsService) {}

  // ══════════════════════════════════════════════════════════════════════════
  // Reportes
  //
  // Van ANTES del maestro: 'reports' entraría por ':id' de las rutas de
  // tarjeta, que además exigen permiso de finanzas.
  // ══════════════════════════════════════════════════════════════════════════

  @Get('reports/all')
  @RequirePermission('finanzas', 'gastos-tarjeta', 'read')
  getAllReports(@Query() query: QueryCardReportsDto) {
    return this.service.getAllReports(query);
  }

  @Get('reports')
  @RequirePermission('herramientas', 'gastos-tarjeta', 'read')
  getMyReports(@Query() query: QueryCardReportsDto, @CurrentUser() user: User) {
    return this.service.getMyReports(user, query);
  }

  @Post('reports')
  @RequirePermission('herramientas', 'gastos-tarjeta', 'write')
  createReport(@Body() dto: CreateCardReportDto, @CurrentUser() user: User) {
    return this.service.createReport(user, dto);
  }

  // Sin @RequirePermission: lo consultan el creador, el titular de la tarjeta y
  // Finanzas; el guard solo evalúa un permiso y el servicio cubre los tres casos.
  @Get('reports/:id')
  getReportDetail(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.getReportDetail(id, user);
  }

  @Patch('reports/:id')
  @RequirePermission('herramientas', 'gastos-tarjeta', 'write')
  updateReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCardReportDto,
    @CurrentUser() user: User,
  ) {
    return this.service.updateReport(id, user, dto);
  }

  @Delete('reports/:id')
  @RequirePermission('herramientas', 'gastos-tarjeta', 'write')
  deleteReport(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.deleteReport(id, user);
  }

  @Patch('reports/:id/submit')
  @RequirePermission('herramientas', 'gastos-tarjeta', 'write')
  submitReport(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.submitReport(id, user);
  }

  @Patch('reports/:id/process')
  @RequirePermission('finanzas', 'gastos-tarjeta', 'process')
  processReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProcessCardReportDto,
    @CurrentUser() user: User,
  ) {
    return this.service.processReport(id, user, dto);
  }

  @Post('reports/:id/lines/:lineId/invoice')
  @RequirePermission('herramientas', 'gastos-tarjeta', 'write')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo.');
    if (!(ALLOWED_INVOICE_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipo no permitido. Acepta: ${ALLOWED_INVOICE_MIME_TYPES.join(', ')}`,
      );
    }
    return this.service.uploadInvoice(id, lineId, user, file);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Maestro de tarjetas
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Las activas las necesita cualquiera que capture un reporte, así que basta
   * el permiso de la herramienta: solo expone últimos 4, alias y titular.
   */
  @Get('active')
  @RequirePermission('herramientas', 'gastos-tarjeta', 'read')
  getActiveCards() {
    return this.service.getActiveCards();
  }

  @Get()
  @RequirePermission('finanzas', 'tarjetas', 'read')
  getCards(@Query() query: QueryCreditCardsDto) {
    return this.service.getCards(query);
  }

  @Post()
  @RequirePermission('finanzas', 'tarjetas', 'write')
  createCard(@Body() dto: CreateCreditCardDto) {
    return this.service.createCard(dto);
  }

  @Patch(':id/toggle')
  @RequirePermission('finanzas', 'tarjetas', 'write')
  toggleActive(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.toggleActive(id);
  }

  @Patch(':id')
  @RequirePermission('finanzas', 'tarjetas', 'write')
  updateCard(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCreditCardDto) {
    return this.service.updateCard(id, dto);
  }

  @Delete(':id')
  @RequirePermission('finanzas', 'tarjetas', 'write')
  deleteCard(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteCard(id);
  }
}
