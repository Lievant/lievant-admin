import {
  BadRequestException,
  Body,
  Controller,
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
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { QueryInvoicesDto } from './dto/query-invoices.dto';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { InvoicesService } from './invoices.service';
import { ALLOWED_PDF_MIME_TYPES } from './vendor-storage.service';

const pdfFileFilter: NonNullable<MulterOptions['fileFilter']> = (_req, file, callback) => {
  if (!(ALLOWED_PDF_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
    callback(new BadRequestException('Solo se permiten archivos PDF'), false);
    return;
  }
  callback(null, true);
};

@UseGuards(JwtAuthGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  findAll(@Query() query: QueryInvoicesDto) {
    return this.invoicesService.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: User) {
    return this.invoicesService.create(dto, user.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.invoicesService.findOne(id);
  }

  @Patch(':id/pdf')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 }, fileFilter: pdfFileFilter }))
  updatePdf(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('El archivo es obligatorio');
    }
    return this.invoicesService.updatePdf(id, file);
  }

  @Post(':id/payment')
  @UseInterceptors(
    FileInterceptor('voucher', { limits: { fileSize: 20 * 1024 * 1024 }, fileFilter: pdfFileFilter }),
  )
  registerPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterPaymentDto,
    @CurrentUser() user: User,
    @UploadedFile() voucher?: Express.Multer.File,
  ) {
    return this.invoicesService.registerPayment(id, dto, user.id, voucher);
  }
}
