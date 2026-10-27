import {
  BadRequestException,
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
import {
  PresignedUploadDto,
  RegisterEmployeeDocumentDto,
  UploadEmployeeDocumentDto,
} from './dto/upload-employee-document.dto';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdatePersonalDataDto } from './dto/personal-data.dto';
import { UpdateCompensationDto } from './dto/compensation.dto';
import { CreateEmergencyContactDto, UpdateEmergencyContactDto } from './dto/emergency-contact.dto';
import { UpdateTerminationDto } from './dto/termination.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';
import { GetBirthdayReportDto } from './dto/get-birthday-report.dto';
import { GetExpiringContractsDto } from './dto/get-expiring-contracts.dto';
import { GetHeadcountDto } from './dto/get-headcount.dto';
import { EmployeesService } from './employees.service';
import { EmployeePhotosService } from './employee-photos.service';
import { HeadcountService } from './headcount.service';
import { OrgChartService } from './org-chart.service';
import { MyProfileService } from './my-profile.service';
import { EmployeeUserLinkService } from './employee-user-link.service';
import { LinkUserDto } from './dto/link-user.dto';
import { TrainingsService } from './trainings.service';
import { EmployeeDevelopmentService } from '../employee-development/employee-development.service';
import { PeriodQueryDto } from '../employee-development/dto/employee-development.dto';
import { TrainingsReportService } from './trainings-report.service';
import { TrainingReportQueryDto } from './dto/trainings-report.dto';
import {
  CertificateUploadDto,
  CreateTrainingDto,
  TrainingQueryDto,
  UpdateTrainingDto,
} from './dto/training.dto';
import { OrgChartQueryDto } from './dto/org-chart-query.dto';
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
    private readonly photosService: EmployeePhotosService,
    private readonly headcountService: HeadcountService,
    private readonly orgChartService: OrgChartService,
    private readonly myProfileService: MyProfileService,
    private readonly userLinkService: EmployeeUserLinkService,
    private readonly trainingsService: TrainingsService,
    private readonly trainingsReportService: TrainingsReportService,
    private readonly developmentService: EmployeeDevelopmentService,
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

  // Organigrama (RRHH 2.0, clasificación C2): cualquier usuario autenticado. Va antes de
  // `:id` para que no se confunda con un id. La respuesta es una lista blanca de campos.
  @Get('org-chart')
  @SetMetadata(PERMISSION_KEY, null)
  getOrgChart(@Query() query: OrgChartQueryDto) {
    return this.orgChartService.getOrgChart(query.location);
  }

  // Mi Información (RRHH 2.0, C2): cualquier usuario autenticado, SOLO su propio
  // expediente. El empleado sale del JWT; ninguna de estas rutas recibe el id de un
  // empleado. Van antes de `:id`. Sin remuneración, notas internas ni datos de baja.
  @Get('my-profile')
  @SetMetadata(PERMISSION_KEY, null)
  getMyProfile(@CurrentUser() user: User) {
    return this.myProfileService.getProfile(user.id);
  }

  @Get('my-profile/documents')
  @SetMetadata(PERMISSION_KEY, null)
  getMyDocuments(@CurrentUser() user: User) {
    return this.myProfileService.listDocuments(user.id);
  }

  @Get('my-profile/documents/:docId/download-url')
  @SetMetadata(PERMISSION_KEY, null)
  getMyDocumentUrl(@Param('docId', ParseUUIDPipe) docId: string, @CurrentUser() user: User) {
    return this.myProfileService.getDocumentUrl(user.id, docId);
  }

  @Get('my-profile/equipment')
  @SetMetadata(PERMISSION_KEY, null)
  getMyEquipment(@CurrentUser() user: User) {
    return this.myProfileService.getEquipment(user.id);
  }

  /** Desarrollo Organizacional propio (solo lectura): el empleado sale de la sesión; sin vínculo, el mismo 404 de Mi Información. */
  @Get('my-profile/development')
  @SetMetadata(PERMISSION_KEY, null)
  async getMyDevelopment(@CurrentUser() user: User, @Query() query: PeriodQueryDto) {
    const employee = await this.myProfileService.resolveEmployee(user.id);
    return this.developmentService.getDevelopment(employee.id, query.period);
  }

  @Get('my-profile/trainings')
  @SetMetadata(PERMISSION_KEY, null)
  getMyTrainings(@CurrentUser() user: User, @Query() query: TrainingQueryDto) {
    return this.myProfileService.getTrainings(user.id, query);
  }

  @Get('my-profile/trainings/:trainingId/certificate-url')
  @SetMetadata(PERMISSION_KEY, null)
  getMyTrainingCertificateUrl(@Param('trainingId', ParseUUIDPipe) trainingId: string, @CurrentUser() user: User) {
    return this.myProfileService.getTrainingCertificateUrl(user.id, trainingId);
  }

  // Público (cualquier usuario autenticado) — usado por el calendario del home.
  @Get('birthdays')
  @SetMetadata(PERMISSION_KEY, null)
  getBirthdaysByMonth(@Query('month') month: string) {
    const monthNum = parseInt(month, 10);
    if (!monthNum || monthNum < 1 || monthNum > 12) {
      throw new BadRequestException('month debe ser 1-12');
    }
    return this.employeesService.getBirthdaysByMonth(monthNum);
  }

  @Get('reports/birthdays')
  @RequirePermission('rrhh', 'empleados.personal', 'read')
  getBirthdayReport(@Query() dto: GetBirthdayReportDto) {
    const month = dto.month ?? new Date().getMonth() + 1;
    const orderBy = dto.orderBy ?? 'date';
    return this.employeesService.getBirthdayReport(month, orderBy);
  }

  @Get('reports/expiring-contracts')
  getExpiringContracts(@Query() dto: GetExpiringContractsDto) {
    return this.employeesService.getExpiringContracts(dto.days ?? 30);
  }

  /**
   * Reporte de Headcount (confidencial). Mismo endpoint para la tabla y para el
   * Excel: `format=xlsx` devuelve el archivo con los mismos filtros y columnas.
   * Debe ir antes de GET :id para que "headcount" no se tome como UUID.
   */
  @Get('headcount')
  @RequirePermission('rrhh', 'headcount', 'read')
  async getHeadcount(
    @Query() dto: GetHeadcountDto,
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (dto.format !== 'xlsx') {
      return this.headcountService.getHeadcount(dto, user);
    }
    const { buffer, fileName } = await this.headcountService.getHeadcountExcel(dto, user);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
    return undefined;
  }

  // Reporte RIAC (RRHH 2.0 · M4). Solo lectura; reutiliza rrhh.capacitaciones.read.
  // Va antes de `:id`.
  @Get('trainings/report/options')
  @RequirePermission('rrhh', 'capacitaciones', 'read')
  getTrainingReportOptions() {
    return this.trainingsReportService.getOptions();
  }

  @Get('trainings/report/export')
  @RequirePermission('rrhh', 'capacitaciones', 'read')
  async exportTrainingReport(
    @Query() dto: TrainingReportQueryDto,
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, fileName } = await this.trainingsReportService.exportExcel(dto, {
      id: user.id,
      email: user.email,
      name: user.name,
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
    return undefined;
  }

  @Get('trainings/report')
  @RequirePermission('rrhh', 'capacitaciones', 'read')
  getTrainingReport(@Query() dto: TrainingReportQueryDto) {
    return this.trainingsReportService.getReport(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.findOne(id);
  }

  /** Usuarios vinculables al expediente: mismo correo corporativo, activos y sin otro expediente. */
  @Get(':id/link-user-candidates')
  @RequirePermission('rrhh', 'empleados', 'write')
  getLinkUserCandidates(@Param('id', ParseUUIDPipe) id: string) {
    return this.userLinkService.getCandidates(id);
  }

  @Post(':id/link-user')
  @RequirePermission('rrhh', 'empleados', 'write')
  linkUser(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LinkUserDto, @CurrentUser() user: User) {
    return this.userLinkService.link(id, dto.authUserId, { id: user.id, email: user.email, name: user.name });
  }

  // Capacitaciones (RRHH 2.0 · M3). Permiso propio: `rrhh.capacitaciones`. Cada ruta
  // exige que la capacitación pertenezca al empleado de la URL.
  @Get(':id/trainings')
  @RequirePermission('rrhh', 'capacitaciones', 'read')
  listTrainings(@Param('id', ParseUUIDPipe) id: string, @Query() query: TrainingQueryDto) {
    return this.trainingsService.list(id, query);
  }

  @Post(':id/trainings')
  @RequirePermission('rrhh', 'capacitaciones', 'write')
  createTraining(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateTrainingDto, @CurrentUser() user: User) {
    return this.trainingsService.create(id, dto, { id: user.id, email: user.email, name: user.name });
  }

  /** Paso 1 del certificado: devuelve { uploadUrl, s3Key }; el navegador sube directo a S3. */
  @Post(':id/trainings/certificate-upload')
  @RequirePermission('rrhh', 'capacitaciones', 'write')
  createTrainingCertificateUpload(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CertificateUploadDto) {
    return this.trainingsService.createCertificateUpload(id, dto);
  }

  @Patch(':id/trainings/:trainingId')
  @RequirePermission('rrhh', 'capacitaciones', 'write')
  updateTraining(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('trainingId', ParseUUIDPipe) trainingId: string,
    @Body() dto: UpdateTrainingDto,
    @CurrentUser() user: User,
  ) {
    return this.trainingsService.update(id, trainingId, dto, { id: user.id, email: user.email, name: user.name });
  }

  @Delete(':id/trainings/:trainingId')
  @RequirePermission('rrhh', 'capacitaciones', 'write')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeTraining(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('trainingId', ParseUUIDPipe) trainingId: string,
    @CurrentUser() user: User,
  ) {
    return this.trainingsService.remove(id, trainingId, { id: user.id, email: user.email, name: user.name });
  }

  @Get(':id/trainings/:trainingId/certificate-url')
  @RequirePermission('rrhh', 'capacitaciones', 'read')
  getTrainingCertificateUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('trainingId', ParseUUIDPipe) trainingId: string,
  ) {
    return this.trainingsService.getCertificateUrl(id, trainingId);
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

  @Get(':id/photos')
  getPhotos(@Param('id', ParseUUIDPipe) id: string) {
    return this.photosService.getPhotos(id);
  }

  @Post(':id/photos')
  @RequirePermission('rrhh', 'empleados', 'write')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
          callback(new BadRequestException('Solo se permiten imágenes JPEG, PNG o WEBP'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    if (!file) throw new BadRequestException('El archivo es obligatorio');
    return this.photosService.uploadPhoto(id, file, user.id);
  }

  /**
   * Proxy de descarga: el archivo se baja de S3 en el servidor y se entrega al
   * navegador desde nuestro dominio, evitando el CORS del bucket.
   */
  @Get(':id/photos/:photoId/download')
  async downloadPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { stream, contentType, fileName } = await this.photosService.downloadPhoto(id, photoId);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    stream.pipe(res);
  }

  @Patch(':id/photos/:photoId/profile')
  @RequirePermission('rrhh', 'empleados', 'write')
  setProfilePhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ) {
    return this.photosService.setProfilePhoto(id, photoId);
  }

  @Delete(':id/photos/:photoId')
  @RequirePermission('rrhh', 'empleados', 'write')
  @HttpCode(HttpStatus.NO_CONTENT)
  deletePhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ) {
    return this.photosService.deletePhoto(id, photoId);
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

  /** Paso 1 del upload directo a S3: devuelve { uploadUrl, s3Key }. */
  @Post(':id/documents/presigned-upload')
  @RequirePermission('rrhh', 'empleados.documentos', 'write')
  createPresignedUpload(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PresignedUploadDto,
  ) {
    return this.employeesService.createPresignedUpload(id, dto);
  }

  /** Paso 3: registra en BD el objeto que el navegador ya subió a S3. */
  @Post(':id/documents/register')
  @RequirePermission('rrhh', 'empleados.documentos', 'write')
  registerDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterEmployeeDocumentDto,
    @CurrentUser() user: User,
  ) {
    return this.employeesService.registerDocument(id, dto, user.id);
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
