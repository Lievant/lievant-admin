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
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permission.decorator';
import { User } from '../auth/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ClientsService } from './clients.service';
import { ALLOWED_DOCUMENT_MIME_TYPES } from './document-storage.service';
import { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';
import { PresignedUploadDto, RegisterDocumentDto, UploadDocumentDto } from './dto/document.dto';
import { GenerateContractDto } from './dto/contract.dto';
import { ClientContractsService } from './client-contracts.service';
import { UpdateFinancialDto } from './dto/financial.dto';
import { QueryClientsDto } from './dto/query-clients.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@UseGuards(JwtAuthGuard)
@Controller('clients')
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly clientContractsService: ClientContractsService,
  ) {}

  @Get()
  findAll(@Query() query: QueryClientsDto) {
    return this.clientsService.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission('finanzas', 'clientes', 'read')
  @Get('reports/missing-documents')
  getMissingDocumentsReport() {
    return this.clientsService.getMissingDocumentsReport();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.remove(id);
  }

  @Get(':id/companies')
  listCompanies(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.listCompanies(id);
  }

  @Post(':id/companies')
  addCompany(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateCompanyDto) {
    return this.clientsService.addCompany(id, dto);
  }

  @Patch('companies/:companyId')
  updateCompany(@Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: UpdateCompanyDto) {
    return this.clientsService.updateCompany(companyId, dto);
  }

  @Post('companies/:companyId/brands')
  addBrand(@Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: CreateBrandDto) {
    return this.clientsService.addBrand(companyId, dto);
  }

  @Patch('brands/:brandId')
  updateBrand(@Param('brandId', ParseUUIDPipe) brandId: string, @Body() dto: UpdateBrandDto) {
    return this.clientsService.updateBrand(brandId, dto);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission('finanzas', 'clientes.financiero', 'read')
  @Get(':id/financial')
  getFinancial(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.getFinancial(id);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission('finanzas', 'clientes.financiero', 'write')
  @Patch(':id/financial')
  updateFinancial(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFinancialDto) {
    return this.clientsService.updateFinancial(id, dto);
  }

  @Get(':id/documents')
  listDocuments(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.listDocuments(id);
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
  addDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @CurrentUser() user: User,
  ) {
    if (!file) {
      throw new BadRequestException('El archivo es obligatorio');
    }
    return this.clientsService.addDocument(id, file, dto, user.id);
  }

  /** Datos del cliente para pre-llenar el formulario de contrato. */
  @Get(':id/contracts/prefill')
  @UseGuards(PermissionsGuard)
  @RequirePermission('finanzas', 'clientes', 'read')
  getContractPrefill(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientContractsService.getPrefill(id);
  }

  /**
   * Genera el .docx del contrato y lo devuelve como descarga. No se persiste en
   * S3 ni en BD: es un borrador para imprimir y firmar, no un documento del
   * expediente. Si más adelante debe archivarse, va por el flujo de documentos.
   */
  @Post(':id/contracts/generate')
  @UseGuards(PermissionsGuard)
  @RequirePermission('finanzas', 'clientes', 'write')
  async generateContract(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GenerateContractDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const contrato = await this.clientContractsService.generateContract(id, dto);

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${contrato.fileName}"`,
      'Content-Length': String(contrato.buffer.length),
      // Diagnóstico visible en la respuesta sin ensuciar el .docx.
      'X-Contract-Markers': `${contrato.marcadoresRellenados}/${contrato.marcadoresTotales}`,
    });

    return new StreamableFile(contrato.buffer);
  }

  /**
   * Paso 1 del upload directo a S3. Devuelve { uploadUrl, s3Key } para que el
   * navegador haga PUT contra S3 sin pasar por la compute de Amplify.
   */
  @Post(':id/documents/presigned-upload')
  createPresignedUpload(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PresignedUploadDto,
  ) {
    return this.clientsService.createPresignedUpload(id, dto);
  }

  /** Paso 3: registra en BD el objeto que el navegador ya subió a S3. */
  @Post(':id/documents/register')
  registerDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterDocumentDto,
    @CurrentUser() user: User,
  ) {
    return this.clientsService.registerDocument(id, dto, user.id);
  }

  @Delete('documents/:docId')
  removeDocument(@Param('docId', ParseUUIDPipe) docId: string) {
    return this.clientsService.removeDocument(docId);
  }

  @Get(':id/contacts')
  listContacts(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.listContacts(id);
  }

  @Post(':id/contacts')
  addContact(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateContactDto) {
    return this.clientsService.addContact(id, dto);
  }

  @Patch('contacts/:contactId')
  updateContact(@Param('contactId', ParseUUIDPipe) contactId: string, @Body() dto: UpdateContactDto) {
    return this.clientsService.updateContact(contactId, dto);
  }

  @Delete('contacts/:contactId')
  removeContact(@Param('contactId', ParseUUIDPipe) contactId: string) {
    return this.clientsService.removeContact(contactId);
  }
}
