import {
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
import { AddMemberDto } from './dto/add-member.dto';
import { AddMilestoneDto } from './dto/add-milestone.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';
import { UpdateFinancialsDto } from './dto/update-financials.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UploadProjectDocumentDto } from './dto/upload-document.dto';
import { ProjectsService } from './projects.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('finanzas', 'proyectos', 'read')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Get('stats')
  getStats() {
    return this.service.getStats();
  }

  @Get()
  findAll(@Query() query: QueryProjectsDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Post()
  @RequirePermission('finanzas', 'proyectos', 'write')
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: User) {
    return this.service.create(dto, user.id, user.name);
  }

  @Patch(':id')
  @RequirePermission('finanzas', 'proyectos', 'write')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProjectDto, @CurrentUser() user: User) {
    return this.service.update(id, dto, user.id, user.name);
  }

  @Delete(':id')
  @RequirePermission('finanzas', 'proyectos', 'delete')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.remove(id, user.id, user.name);
  }

  @Post(':id/members')
  @RequirePermission('finanzas', 'proyectos', 'write')
  addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: User,
  ) {
    return this.service.addMember(id, dto, user.id, user.name);
  }

  @Delete(':id/members/:empId')
  @RequirePermission('finanzas', 'proyectos', 'write')
  removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('empId', ParseUUIDPipe) empId: string,
    @CurrentUser() user: User,
  ) {
    return this.service.removeMember(id, empId, user.id, user.name);
  }

  @Patch(':id/financials')
  @RequirePermission('finanzas', 'proyectos.financiero', 'write')
  updateFinancials(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFinancialsDto,
    @CurrentUser() user: User,
  ) {
    return this.service.updateFinancials(id, dto, user.id, user.name);
  }

  @Post(':id/milestones')
  @RequirePermission('finanzas', 'proyectos', 'write')
  addMilestone(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMilestoneDto,
    @CurrentUser() user: User,
  ) {
    return this.service.addMilestone(id, dto, user.id, user.name);
  }

  @Post(':id/documents')
  @RequirePermission('finanzas', 'proyectos', 'write')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  uploadDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadProjectDocumentDto,
    @CurrentUser() user: User,
  ) {
    return this.service.uploadDocument(id, file, dto, user.id);
  }

  @Get(':id/documents')
  getDocuments(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getDocuments(id);
  }
}
