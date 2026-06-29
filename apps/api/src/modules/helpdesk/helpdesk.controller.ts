import { Body, Controller, DefaultValuePipe, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permission.decorator';
import { User } from '../auth/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { EscalateTicketDto } from './dto/escalate-ticket.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { HelpdeskService } from './helpdesk.service';

function isTdUser(user: User): boolean {
  return (
    user.roles?.some((r) => r.name === 'SUPER_ADMIN') ||
    user.userPermissions?.some((up) => up.granted && up.permission?.module === 'tickets.gestion') ||
    user.roles?.some((r) =>
      r.permissions?.some((p) => p.module === 'tickets.gestion'),
    ) ||
    false
  );
}

@UseGuards(JwtAuthGuard)
@Controller('helpdesk')
export class HelpdeskController {
  constructor(private readonly service: HelpdeskService) {}

  // ------- Catalogs -------------------------------------------------------

  @Get('categories')
  getCategories() {
    return this.service.findCategories();
  }

  @Get('categories/:slug/subcategories')
  getSubcategories(@Param('slug') slug: string) {
    return this.service.findSubcategories(slug);
  }

  @Get('assignees')
  getAssignees() {
    return this.service.findAssignees();
  }

  // ------- Tickets --------------------------------------------------------

  @Get('tickets/stats')
  @UseGuards(PermissionsGuard)
  @RequirePermission('transformacion', 'tickets.reportes', 'read')
  getStats(
    @Query('from', new DefaultValuePipe('')) from: string,
    @Query('to', new DefaultValuePipe('')) to: string,
  ) {
    return this.service.getStats(from || undefined, to || undefined);
  }

  @Get('tickets/my')
  getMyTickets(@Query() query: QueryTicketsDto, @CurrentUser() user: User) {
    return this.service.findMyTickets(user.id, query);
  }

  @Get('tickets')
  findAll(@Query() query: QueryTicketsDto, @CurrentUser() user: User) {
    return this.service.findAll(query, isTdUser(user), user.id);
  }

  @Get('tickets/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Post('tickets')
  create(@Body() dto: CreateTicketDto, @CurrentUser() user: User) {
    return this.service.create(dto, user);
  }

  @Patch('tickets/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('transformacion', 'tickets.gestion', 'write')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: User,
  ) {
    return this.service.updateTicket(id, dto, user);
  }

  @Patch('tickets/:id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.service.updateStatus(id, dto, user);
  }

  @Patch('tickets/:id/escalate')
  @UseGuards(PermissionsGuard)
  @RequirePermission('transformacion', 'tickets.gestion', 'write')
  escalate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EscalateTicketDto,
    @CurrentUser() user: User,
  ) {
    return this.service.escalate(id, dto, user);
  }
}
