import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permission.decorator';
import { User } from '../auth/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import {
  CreateAdAccountDto,
  QueryAccountsDto,
  QueryAlertsDto,
  QueryAuditLogDto,
  QueryBudgetsDto,
  QuerySpendDto,
  UpdateAdAccountDto,
  UpdateBudgetDto,
  UpsertBudgetDto,
} from './dto/media.dto';
import { MediaService } from './media.service';
import { MediaSyncService } from './media-sync.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('media')
export class MediaController {
  constructor(
    private readonly service: MediaService,
    private readonly syncService: MediaSyncService,
  ) {}

  // --- Home ejecutivo ---

  @Get('summary')
  @RequirePermission('medios', 'dashboard', 'read')
  getSummary() {
    return this.service.getExecutiveSummary();
  }

  @Get('stats')
  @RequirePermission('medios', 'dashboard', 'read')
  getStats() {
    return this.service.getStats();
  }

  @Get('platforms')
  @RequirePermission('medios', 'dashboard', 'read')
  getPlatforms() {
    return this.service.listPlatforms();
  }

  // --- Cuentas ---

  @Get('accounts')
  @RequirePermission('medios', 'cuentas', 'read')
  listAccounts(@Query() query: QueryAccountsDto) {
    return this.service.listAccounts(query);
  }

  @Post('accounts')
  @RequirePermission('medios', 'cuentas', 'write')
  createAccount(@Body() dto: CreateAdAccountDto) {
    return this.service.createAccount(dto);
  }

  @Get('accounts/:id')
  @RequirePermission('medios', 'cuentas', 'read')
  getAccount(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getAccountDetail(id);
  }

  @Patch('accounts/:id')
  @RequirePermission('medios', 'cuentas', 'write')
  updateAccount(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAdAccountDto) {
    return this.service.updateAccount(id, dto);
  }

  @Get('accounts/:id/spend')
  @RequirePermission('medios', 'cuentas', 'read')
  getAccountSpend(@Param('id', ParseUUIDPipe) id: string, @Query() query: QuerySpendDto) {
    return this.service.getAccountSpend(id, query);
  }

  @Get('accounts/:id/pacing')
  @RequirePermission('medios', 'cuentas', 'read')
  getAccountPacing(@Param('id', ParseUUIDPipe) id: string, @Query('date') date?: string) {
    return this.service.getAccountPacing(id, date);
  }

  // --- Presupuestos ---

  @Post('budgets')
  @RequirePermission('medios', 'presupuestos', 'write')
  createBudget(@Body() dto: UpsertBudgetDto, @CurrentUser() user: User) {
    return this.service.upsertBudget(dto, user.id);
  }

  @Get('budgets')
  @RequirePermission('medios', 'presupuestos', 'read')
  listBudgets(@Query() query: QueryBudgetsDto) {
    return this.service.listBudgets(query);
  }

  @Patch('budgets/:id')
  @RequirePermission('medios', 'presupuestos', 'write')
  updateBudget(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBudgetDto,
    @CurrentUser() user: User,
  ) {
    return this.service.updateBudget(id, dto, user.id);
  }

  // --- Alertas ---

  @Get('alerts')
  @RequirePermission('medios', 'alertas', 'read')
  getAlerts(@Query() query: QueryAlertsDto) {
    return this.service.getAlerts(query);
  }

  @Get('alerts/count')
  @RequirePermission('medios', 'alertas', 'read')
  getAlertsCount() {
    return this.service.getActiveAlertsCount();
  }

  @Patch('alerts/:id/acknowledge')
  @RequirePermission('medios', 'alertas', 'read')
  acknowledgeAlert(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.acknowledgeAlert(id, user.id);
  }

  // --- Bitácora ---

  @Get('audit-log')
  @RequirePermission('medios', 'auditoria', 'read')
  getAuditLog(@Query() query: QueryAuditLogDto) {
    return this.service.getAuditLog(query);
  }

  // --- Sincronización (trigger manual) ---

  @Post('sync/trigger')
  @RequirePermission('medios', 'configuracion', 'write')
  triggerSync() {
    return this.syncService.triggerSync();
  }
}
