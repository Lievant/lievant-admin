import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permission.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { SystemRole } from '../auth/constants/roles.constant';
import { User } from '../auth/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ChatDto } from './dto/chat.dto';
import {
  PresignedUploadDto,
  QueryAdminDocumentsDto,
  RegisterAdminDocumentDto,
  UploadAdminDocumentDto,
} from './dto/admin-documents.dto';
import { IsobotIngestionService } from './isobot-ingestion.service';
import { IsobotService } from './isobot.service';

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

// El pipeline de ingesta solo sabe extraer texto de estos tres formatos; se
// valida por extensión y no por mimetype porque el navegador reporta
// application/octet-stream para .docx con frecuencia.
const EXTENSIONES_PERMITIDAS = ['.pdf', '.docx', '.xlsx'];

function assertDocumentoValido(file: Express.Multer.File | undefined): asserts file is Express.Multer.File {
  if (!file) throw new BadRequestException('El archivo es obligatorio');
  const extension = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
  if (!EXTENSIONES_PERMITIDAS.includes(extension)) {
    throw new BadRequestException('Solo se admiten archivos PDF, DOCX o XLSX');
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('isobot')
export class IsobotController {
  constructor(
    private readonly service: IsobotService,
    private readonly ingestionService: IsobotIngestionService,
  ) {}

  @Post('chat')
  @RequirePermission('herramientas', 'isobot', 'read')
  chat(@Body() dto: ChatDto, @CurrentUser() user: User) {
    return this.service.chat(dto, user);
  }

  @Post('conversations')
  @RequirePermission('herramientas', 'isobot', 'read')
  startConversation(@CurrentUser() user: User) {
    return this.service.startConversation(user);
  }

  @Get('conversations/:id')
  @RequirePermission('herramientas', 'isobot', 'read')
  getConversation(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.getConversation(id, user);
  }

  @Get('documents')
  @RequirePermission('herramientas', 'isobot', 'read')
  listDocuments() {
    return this.ingestionService.listDocuments();
  }

  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @Delete('documents/:id')
  deleteDocument(@Param('id', ParseUUIDPipe) id: string) {
    return this.ingestionService.deleteDocument(id);
  }

  @Get('documents/:id/download')
  @RequirePermission('herramientas', 'isobot', 'read')
  getDownloadUrl(@Param('id', ParseUUIDPipe) id: string) {
    return this.ingestionService.getDownloadUrl(id);
  }

  // ---------------------------------------------------------------------------
  // Panel de administración del SGSI
  // ---------------------------------------------------------------------------

  @Get('admin/macroprocesses')
  @RequirePermission('sgsi', 'isobot', 'write')
  getMacroprocesses() {
    return this.ingestionService.getMacroprocesses();
  }

  @Get('admin/documents')
  @RequirePermission('sgsi', 'isobot', 'write')
  getAdminDocuments(@Query() query: QueryAdminDocumentsDto) {
    return this.ingestionService.getAdminDocuments(query);
  }

  @Post('admin/documents')
  @RequirePermission('sgsi', 'isobot', 'write')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_BYTES } }))
  uploadAdminDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadAdminDocumentDto,
  ) {
    assertDocumentoValido(file);
    return this.ingestionService.uploadDocument(file, dto);
  }

  /** Paso 1 del upload directo a S3: devuelve { uploadUrl, s3Key }. */
  @Post('admin/documents/presigned-upload')
  @RequirePermission('sgsi', 'isobot', 'write')
  createPresignedUpload(@Body() dto: PresignedUploadDto) {
    return this.ingestionService.createPresignedUpload(dto);
  }

  /** Paso 3: el API descarga de S3 el objeto que subió el navegador y lo indexa. */
  @Post('admin/documents/register')
  @RequirePermission('sgsi', 'isobot', 'write')
  registerAdminDocument(@Body() dto: RegisterAdminDocumentDto) {
    return this.ingestionService.registerDocument(dto);
  }

  @Put('admin/documents/:id')
  @RequirePermission('sgsi', 'isobot', 'write')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_BYTES } }))
  replaceAdminDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    assertDocumentoValido(file);
    return this.ingestionService.replaceDocument(id, file);
  }

  /** Reemplazo con upload directo: el objeto ya está en S3, se reindexa. */
  @Put('admin/documents/:id/register')
  @RequirePermission('sgsi', 'isobot', 'write')
  registerAdminDocumentReplacement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterAdminDocumentDto,
  ) {
    return this.ingestionService.registerReplacement(id, dto);
  }

  @Delete('admin/documents/:id')
  @RequirePermission('sgsi', 'isobot', 'write')
  softDeleteAdminDocument(@Param('id', ParseUUIDPipe) id: string) {
    return this.ingestionService.softDeleteDocument(id);
  }
}
