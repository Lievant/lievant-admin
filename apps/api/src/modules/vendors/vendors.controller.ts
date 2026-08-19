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
import { User } from '../auth/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { QueryInvoicesDto } from './dto/query-invoices.dto';
import { QueryPurchaseOrdersDto } from './dto/query-purchase-orders.dto';
import { QueryVendorsDto } from './dto/query-vendors.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import {
  PresignedUploadDto,
  RegisterVendorDocumentDto,
  UploadVendorDocumentDto,
} from './dto/upload-vendor-document.dto';
import { ALLOWED_DOCUMENT_MIME_TYPES } from './vendor-storage.service';
import { VendorsService } from './vendors.service';

@UseGuards(JwtAuthGuard)
@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  findAll(@Query() query: QueryVendorsDto) {
    return this.vendorsService.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateVendorDto, @CurrentUser() user: User) {
    return this.vendorsService.create(dto, user.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.vendorsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVendorDto, @CurrentUser() user: User) {
    return this.vendorsService.update(id, dto, user.id);
  }

  @Get(':id/products')
  getProducts(@Param('id', ParseUUIDPipe) id: string) {
    return this.vendorsService.getProducts(id);
  }

  @Post(':id/products')
  addProduct(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateProductDto, @CurrentUser() user: User) {
    return this.vendorsService.addProduct(id, dto, user.id);
  }

  @Get(':id/purchase-orders')
  getPurchaseOrders(@Param('id', ParseUUIDPipe) id: string, @Query() query: QueryPurchaseOrdersDto) {
    return this.vendorsService.getPurchaseOrders(id, query);
  }

  @Get(':id/invoices')
  getInvoices(@Param('id', ParseUUIDPipe) id: string, @Query() query: QueryInvoicesDto) {
    return this.vendorsService.getInvoices(id, query);
  }

  @Get(':id/statement')
  getStatement(@Param('id', ParseUUIDPipe) id: string) {
    return this.vendorsService.getStatement(id);
  }

  @Get(':id/documents')
  getDocuments(@Param('id', ParseUUIDPipe) id: string) {
    return this.vendorsService.getDocuments(id);
  }

  @Post(':id/documents')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        if (!(ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
          callback(new BadRequestException('Tipo de archivo no permitido'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadVendorDocumentDto,
    @CurrentUser() user: User,
  ) {
    if (!file) {
      throw new BadRequestException('El archivo es obligatorio');
    }
    return this.vendorsService.uploadDocument(id, file, dto, user.id);
  }

  /** Paso 1 del upload directo a S3: devuelve { uploadUrl, s3Key }. */
  @Post(':id/documents/presigned-upload')
  createPresignedUpload(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PresignedUploadDto,
  ) {
    return this.vendorsService.createPresignedUpload(id, dto);
  }

  /** Paso 3: registra en BD el objeto que el navegador ya subió a S3. */
  @Post(':id/documents/register')
  registerDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterVendorDocumentDto,
    @CurrentUser() user: User,
  ) {
    return this.vendorsService.registerDocument(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.vendorsService.remove(id);
  }

  @Delete('documents/:docId')
  removeDocument(@Param('docId', ParseUUIDPipe) docId: string) {
    return this.vendorsService.removeDocument(docId);
  }
}
