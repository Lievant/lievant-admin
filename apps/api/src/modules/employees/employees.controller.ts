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
  SetMetadata,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { PERMISSION_KEY, RequirePermission } from '../auth/decorators/permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ALLOWED_DOCUMENT_MIME_TYPES } from './employee-storage.service';
import { UploadEmployeeDocumentDto } from './dto/upload-employee-document.dto';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdatePersonalDataDto } from './dto/personal-data.dto';
import { UpdateCompensationDto } from './dto/compensation.dto';
import { CreateVacationDto, UpdateVacationDto } from './dto/vacation.dto';
import { CreateEmergencyContactDto, UpdateEmergencyContactDto } from './dto/emergency-contact.dto';
import { UpdateTerminationDto } from './dto/termination.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';
import { GetBirthdayReportDto } from './dto/get-birthday-report.dto';
import { EmployeesService } from './employees.service';
import { DocumentsService, DocumentType } from './documents.service';

const VALID_DOCUMENT_TYPES: DocumentType[] = [
  'contrato_determinado',
  'contrato_indeterminado',
  'convenio_practicas',
  'confidencialidad',
  'no_competencia',
];

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('rrhh', 'empleados', 'read')
@Controller('employees')
export class EmployeesController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly documentsService: DocumentsService,
  ) {}

  // Accessible to any authenticated user — null overrides the class-level RequirePermission
  @SetMetadata(PERMISSION_KEY, null)
  @Get('dashboard')
  getDashboard(@CurrentUser() user: User) {
    return this.employeesService.getDashboard(user.id);
  }

  @Get()
  findAll(@Query() query: QueryEmployeesDto) {
    return this.employeesService.findAll(query);
  }

  @Post()
  @RequirePermission('rrhh', 'empleados', 'write')
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Get('reports/birthdays')
  @RequirePermission('rrhh', 'empleados.personal', 'read')
  getBirthdayReport(@Query() dto: GetBirthdayReportDto) {
    const month = dto.month ?? new Date().getMonth() + 1;
    const orderBy = dto.orderBy ?? 'date';
    return this.employeesService.getBirthdayReport(month, orderBy);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('rrhh', 'empleados', 'write')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('rrhh', 'empleados', 'write')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.remove(id);
  }

  @Get(':id/personal')
  getPersonalData(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.getPersonalData(id);
  }

  @Patch(':id/personal')
  @RequirePermission('rrhh', 'empleados.personal', 'write')
  updatePersonalData(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePersonalDataDto) {
    return this.employeesService.updatePersonalData(id, dto);
  }

  @Get(':id/compensation')
  @RequirePermission('rrhh', 'empleados.nomina', 'read')
  getCompensation(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.getCompensation(id);
  }

  @Patch(':id/compensation')
  @RequirePermission('rrhh', 'empleados.nomina', 'write')
  updateCompensation(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCompensationDto) {
    return this.employeesService.updateCompensation(id, dto);
  }

  @Get(':id/vacations')
  listVacations(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.listVacations(id);
  }

  @Post(':id/vacations')
  @RequirePermission('rrhh', 'empleados', 'write')
  createVacation(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateVacationDto) {
    return this.employeesService.createVacation(id, dto);
  }

  @Patch('vacations/:vacId')
  @RequirePermission('rrhh', 'empleados', 'write')
  updateVacation(@Param('vacId', ParseUUIDPipe) vacId: string, @Body() dto: UpdateVacationDto) {
    return this.employeesService.updateVacation(vacId, dto);
  }

  @Get(':id/contacts')
  listEmergencyContacts(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.listEmergencyContacts(id);
  }

  @Post(':id/contacts')
  @RequirePermission('rrhh', 'empleados', 'write')
  addEmergencyContact(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateEmergencyContactDto) {
    return this.employeesService.addEmergencyContact(id, dto);
  }

  @Patch('contacts/:contactId')
  @RequirePermission('rrhh', 'empleados', 'write')
  updateEmergencyContact(
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() dto: UpdateEmergencyContactDto,
  ) {
    return this.employeesService.updateEmergencyContact(contactId, dto);
  }

  @Delete('contacts/:contactId')
  @RequirePermission('rrhh', 'empleados', 'write')
  removeEmergencyContact(@Param('contactId', ParseUUIDPipe) contactId: string) {
    return this.employeesService.removeEmergencyContact(contactId);
  }

  @Get(':id/termination')
  getTermination(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.getTermination(id);
  }

  @Patch(':id/termination')
  @RequirePermission('rrhh', 'empleados.personal', 'write')
  updateTermination(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTerminationDto) {
    return this.employeesService.updateTermination(id, dto);
  }

  @Get(':id/documents')
  @RequirePermission('rrhh', 'empleados.documentos', 'read')
  getDocuments(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.getDocuments(id);
  }

  @Post(':id/documents')
  @RequirePermission('rrhh', 'empleados.documentos', 'write')
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
    @Body() dto: UploadEmployeeDocumentDto,
    @CurrentUser() user: User,
  ) {
    if (!file) throw new BadRequestException('El archivo es obligatorio');
    return this.employeesService.uploadDocument(id, file, dto, user.id);
  }

  @Delete('documents/:docId')
  @RequirePermission('rrhh', 'empleados.documentos', 'write')
  removeDocument(@Param('docId', ParseUUIDPipe) docId: string) {
    return this.employeesService.removeDocument(docId);
  }

  @Get(':id/documents/:docType')
  @RequirePermission('rrhh', 'empleados.documentos', 'write')
  async generateDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docType') docType: string,
    @Query() extraData: Record<string, string>,
    @Res() res: Response,
  ): Promise<void> {
    if (!VALID_DOCUMENT_TYPES.includes(docType as DocumentType)) {
      throw new BadRequestException('Tipo de documento inválido');
    }

    const buffer = await this.documentsService.generateDocument(id, docType as DocumentType, extraData);

    const filename = `${docType}_${Date.now()}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
