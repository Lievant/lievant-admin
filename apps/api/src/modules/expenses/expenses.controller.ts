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
import {
  AuthorizeExpenseReportDto,
  CreateExpenseReportDto,
  ProcessExpenseReportDto,
  QueryExpenseReportsDto,
  UpdateExpenseReportDto,
} from './dto/expense-report.dto';
import { ALLOWED_INVOICE_MIME_TYPES } from './expenses-storage.service';
import { ExpensesService } from './expenses.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly service: ExpensesService) {}

  // Las rutas literales van antes que ':id' para que no entren por el parámetro.

  @Get('catalogs')
  @RequirePermission('herramientas', 'reembolsos', 'read')
  getCatalogs() {
    return this.service.getCatalogs();
  }

  @Get('to-authorize')
  @RequirePermission('herramientas', 'reembolsos', 'read')
  getReportsToAuthorize(@CurrentUser() user: User) {
    return this.service.getReportsToAuthorize(user);
  }

  @Get('all')
  @RequirePermission('finanzas', 'reembolsos', 'read')
  getAllReports(@Query() query: QueryExpenseReportsDto) {
    return this.service.getAllReports(query);
  }

  @Get()
  @RequirePermission('herramientas', 'reembolsos', 'read')
  getMyReports(@Query() query: QueryExpenseReportsDto, @CurrentUser() user: User) {
    return this.service.getMyReports(user, query);
  }

  @Post()
  @RequirePermission('herramientas', 'reembolsos', 'write')
  createReport(@Body() dto: CreateExpenseReportDto, @CurrentUser() user: User) {
    return this.service.createReport(user, dto);
  }

  // Sin @RequirePermission: lo consultan el solicitante, su autorizador y
  // Finanzas, y el guard solo evalúa un permiso. El acceso se resuelve en
  // getReportDetail() contra los tres casos.
  @Get(':id')
  getReportDetail(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.getReportDetail(id, user);
  }

  @Patch(':id')
  @RequirePermission('herramientas', 'reembolsos', 'write')
  updateReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseReportDto,
    @CurrentUser() user: User,
  ) {
    return this.service.updateReport(id, user, dto);
  }

  @Delete(':id')
  @RequirePermission('herramientas', 'reembolsos', 'write')
  deleteReport(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.deleteReport(id, user);
  }

  @Patch(':id/submit')
  @RequirePermission('herramientas', 'reembolsos', 'write')
  submitReport(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.submitReport(id, user);
  }

  // Sin @RequirePermission: autoriza quien fue designado en el reporte, sin
  // importar su sección. El servicio valida que sea él.
  @Patch(':id/authorize')
  authorizeReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AuthorizeExpenseReportDto,
    @CurrentUser() user: User,
  ) {
    return this.service.authorizeReport(id, user, dto);
  }

  @Patch(':id/process')
  @RequirePermission('finanzas', 'reembolsos', 'process')
  processReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProcessExpenseReportDto,
    @CurrentUser() user: User,
  ) {
    return this.service.processReport(id, user, dto);
  }

  @Post(':id/lines/:lineId/invoice')
  @RequirePermission('herramientas', 'reembolsos', 'write')
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

  @Get(':id/lines/:lineId/invoice')
  getInvoiceUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @CurrentUser() user: User,
  ) {
    return this.service.getInvoiceUrl(id, lineId, user);
  }
}
