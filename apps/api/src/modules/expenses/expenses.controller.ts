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
  PresignedUploadDto,
  ProcessExpenseReportDto,
  QueryExpenseReportsDto,
  RegisterInvoiceDto,
  UpdateExpenseReportDto,
} from './dto/expense-report.dto';
import { ALLOWED_INVOICE_MIME_TYPES } from './expenses-storage.service';
import { MAX_UPLOAD_BYTES } from '../../common/s3-upload.util';
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
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
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

  /** Paso 1 del upload directo a S3: devuelve { uploadUrl, s3Key }. */
  @Post(':id/lines/:lineId/invoice/presigned-upload')
  @RequirePermission('herramientas', 'reembolsos', 'write')
  createPresignedInvoiceUpload(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: PresignedUploadDto,
    @CurrentUser() user: User,
  ) {
    return this.service.createPresignedInvoiceUpload(id, lineId, user, dto);
  }

  /** Paso 3: registra en BD la factura que el navegador ya subió a S3. */
  @Post(':id/lines/:lineId/invoice/register')
  @RequirePermission('herramientas', 'reembolsos', 'write')
  registerInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: RegisterInvoiceDto,
    @CurrentUser() user: User,
  ) {
    return this.service.registerInvoice(id, lineId, user, dto);
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
