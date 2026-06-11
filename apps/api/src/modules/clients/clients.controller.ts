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
import { Roles } from '../auth/decorators/roles.decorator';
import { SystemRole } from '../auth/constants/roles.constant';
import { User } from '../auth/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ClientsService } from './clients.service';
import { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';
import { UploadDocumentDto } from './dto/document.dto';
import { UpdateFinancialDto } from './dto/financial.dto';
import { QueryClientsDto } from './dto/query-clients.dto';
import { UpdateClientDto } from './dto/update-client.dto';

const ALLOWED_DOCUMENT_EXTENSIONS = /\.(pdf|jpe?g|png|docx|xlsx)$/i;

@UseGuards(JwtAuthGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  findAll(@Query() query: QueryClientsDto) {
    return this.clientsService.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
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

  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.ADMIN_FINANZAS)
  @Get(':id/financial')
  getFinancial(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.getFinancial(id);
  }

  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.ADMIN_FINANZAS)
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
        if (!ALLOWED_DOCUMENT_EXTENSIONS.test(file.originalname)) {
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
