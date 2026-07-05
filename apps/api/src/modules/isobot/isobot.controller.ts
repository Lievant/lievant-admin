import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permission.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { SystemRole } from '../auth/constants/roles.constant';
import { User } from '../auth/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ChatDto } from './dto/chat.dto';
import { IsobotIngestionService } from './isobot-ingestion.service';
import { IsobotService } from './isobot.service';

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

  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @Get('documents')
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
}
