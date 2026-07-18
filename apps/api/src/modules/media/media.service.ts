import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AdAccount } from './entities/ad-account.entity';
import { ApiCredential } from './entities/api-credential.entity';
import { MediaBudget } from './entities/budget.entity';
import { DailySpend } from './entities/daily-spend.entity';
import { MediaAlert } from './entities/media-alert.entity';
import { MediaAuditLog } from './entities/media-audit-log.entity';
import { PacingSnapshot, PacingStatus } from './entities/pacing-snapshot.entity';
import { Platform } from './entities/platform.entity';
import { SyncLog } from './entities/sync-log.entity';
import {
  CreateAdAccountDto,
  CreateCredentialDto,
  QueryAccountsDto,
  QueryAlertsDto,
  QueryAuditLogDto,
  QueryBudgetsDto,
  QueryCredentialsDto,
  QuerySpendDto,
  QuerySyncLogsDto,
  UpdateAdAccountDto,
  UpdateBudgetDto,
  UpdateCredentialDto,
  UpsertBudgetDto,
} from './dto/media.dto';
import { MediaPacingService, PacingResult } from './media-pacing.service';

const ACCOUNT_RELATIONS = [
  'platform',
  'clientRecord',
  'clientRecord.primaryCompany',
  'accountManager',
  'credential',
];

interface MonthInfo {
  year: number;
  month: number; // 0-based
  daysInMonth: number;
  monthStart: string; // YYYY-MM-01
  daysElapsed: number;
  daysRemaining: number;
  referenceDate: string; // YYYY-MM-DD
}

export interface AccountPacingRow {
  accountId: string;
  nativeAccountId: string;
  nativeAccountName: string | null;
  platform: { id: string; slug: string; name: string; color: string | null; icon: string | null };
  client: { id: string; name: string } | null;
  accountManager: { id: string; name: string } | null;
  currency: string;
  budgetAmount: number | null;
  spendAccumulated: number;
  spendExpected: number | null;
  pctConsumed: number | null;
  pacingPct: number | null;
  spendDailyAvg: number;
  spendDailyIdeal: number | null;
  spendDailyRemaining: number | null;
  projectedClose: number | null;
  daysRemaining: number;
  daysToExhaustion: number | null;
  projectedExhaustionDate: string | null;
  lastSyncedAt: Date | null;
  lastSyncError: string | null;
  status: PacingStatus;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @InjectRepository(Platform) private readonly platformRepo: Repository<Platform>,
    @InjectRepository(AdAccount) private readonly accountRepo: Repository<AdAccount>,
    @InjectRepository(DailySpend) private readonly spendRepo: Repository<DailySpend>,
    @InjectRepository(MediaBudget) private readonly budgetRepo: Repository<MediaBudget>,
    @InjectRepository(PacingSnapshot) private readonly pacingRepo: Repository<PacingSnapshot>,
    @InjectRepository(MediaAlert) private readonly alertRepo: Repository<MediaAlert>,
    @InjectRepository(MediaAuditLog) private readonly auditRepo: Repository<MediaAuditLog>,
    @InjectRepository(ApiCredential) private readonly credentialRepo: Repository<ApiCredential>,
    @InjectRepository(SyncLog) private readonly syncLogRepo: Repository<SyncLog>,
    private readonly pacing: MediaPacingService,
    private readonly dataSource: DataSource,
  ) {}

  // ---------------------------------------------------------------------------
  // Utilidades de fechas
  // ---------------------------------------------------------------------------

  private monthInfo(reference: Date): MonthInfo {
    const year = reference.getFullYear();
    const month = reference.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dayOfMonth = reference.getDate();
    const mm = String(month + 1).padStart(2, '0');
    return {
      year,
      month,
      daysInMonth,
      monthStart: `${year}-${mm}-01`,
      daysElapsed: dayOfMonth,
      daysRemaining: daysInMonth - dayOfMonth,
      referenceDate: `${year}-${mm}-${String(dayOfMonth).padStart(2, '0')}`,
    };
  }

  private addDays(dateStr: string, days: number): string {
    const d = new Date(`${dateStr}T00:00:00`);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
  }

  // ---------------------------------------------------------------------------
  // Pacing por cuenta (reutilizable)
  // ---------------------------------------------------------------------------

  private async sumSpend(accountId: string, from: string, to: string): Promise<number> {
    const row = await this.spendRepo
      .createQueryBuilder('ds')
      .select('COALESCE(SUM(COALESCE(ds.spend_mxn, ds.spend_native)), 0)', 'total')
      .where('ds.ad_account_id = :accountId', { accountId })
      .andWhere('ds.spend_date >= :from', { from })
      .andWhere('ds.spend_date <= :to', { to })
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private async currentBudget(accountId: string, monthStart: string): Promise<MediaBudget | null> {
    return this.budgetRepo.findOne({
      where: { adAccountId: accountId, budgetMonth: monthStart, isCurrent: true },
    });
  }

  private async computeAccountPacing(
    account: AdAccount,
    info: MonthInfo,
  ): Promise<{ row: AccountPacingRow; result: PacingResult; budget: MediaBudget | null }> {
    const budget = await this.currentBudget(account.id, info.monthStart);
    const spendAccumulated = await this.sumSpend(account.id, info.monthStart, info.referenceDate);

    const budgetAmount = budget
      ? Number(budget.amountMxn ?? budget.amount)
      : null;

    const result = this.pacing.computePacing({
      budgetAmount,
      spendAccumulated,
      daysInMonth: info.daysInMonth,
      daysElapsed: info.daysElapsed,
      daysRemaining: info.daysRemaining,
    });

    const projectedExhaustionDate =
      result.daysToExhaustion !== null
        ? this.addDays(info.referenceDate, result.daysToExhaustion)
        : null;

    const company = account.clientRecord?.primaryCompany ?? null;

    const row: AccountPacingRow = {
      accountId: account.id,
      nativeAccountId: account.nativeAccountId,
      nativeAccountName: account.nativeAccountName,
      platform: {
        id: account.platform?.id ?? account.platformId,
        slug: account.platform?.slug ?? '',
        name: account.platform?.name ?? '',
        color: account.platform?.color ?? null,
        icon: account.platform?.icon ?? null,
      },
      client: account.clientRecord
        ? { id: account.clientRecord.id, name: company?.name ?? account.clientRecord.displayId }
        : null,
      accountManager: account.accountManager
        ? { id: account.accountManager.id, name: account.accountManager.fullName }
        : null,
      currency: account.currency,
      budgetAmount: result.budgetAmount,
      spendAccumulated: result.spendAccumulated,
      spendExpected: result.spendExpected,
      pctConsumed: result.pctConsumed,
      pacingPct: result.pacingPct,
      spendDailyAvg: result.spendDailyAvg,
      spendDailyIdeal: result.spendDailyIdeal,
      spendDailyRemaining: result.spendDailyRemaining,
      projectedClose: result.projectedClose,
      daysRemaining: result.daysRemaining,
      daysToExhaustion: result.daysToExhaustion,
      projectedExhaustionDate,
      lastSyncedAt: account.lastSyncedAt,
      lastSyncError: account.lastSyncError,
      status: result.status,
    };

    return { row, result, budget };
  }

  // ---------------------------------------------------------------------------
  // Catálogo de plataformas
  // ---------------------------------------------------------------------------

  async listPlatforms(): Promise<Platform[]> {
    return this.platformRepo.find({ order: { phase: 'ASC', name: 'ASC' } });
  }

  private async loadActiveAccounts(where: Record<string, unknown> = {}): Promise<AdAccount[]> {
    return this.accountRepo.find({
      where: { isActive: true, ...where },
      relations: ACCOUNT_RELATIONS,
      order: { createdAt: 'DESC' },
    });
  }

  // ---------------------------------------------------------------------------
  // Home ejecutivo / stats
  // ---------------------------------------------------------------------------

  async getExecutiveSummary(): Promise<{
    stats: Awaited<ReturnType<MediaService['getStats']>>;
    needsAttention: AccountPacingRow[];
    byClient: Array<{
      clientId: string | null;
      clientName: string;
      accounts: AccountPacingRow[];
      worstStatus: PacingStatus;
    }>;
    platformFreshness: Array<{ slug: string; name: string; lastSyncedAt: Date | null }>;
    accountsWithoutBudget: number;
  }> {
    const info = this.monthInfo(new Date());
    const accounts = await this.loadActiveAccounts();

    const rows: AccountPacingRow[] = [];
    for (const account of accounts) {
      const { row } = await this.computeAccountPacing(account, info);
      rows.push(row);
    }

    const statusRank: Record<PacingStatus, number> = { red: 0, yellow: 1, gray: 2, green: 3 };

    const needsAttention = rows
      .filter((r) => r.status === 'red' || r.status === 'yellow')
      .sort((a, b) => {
        if (statusRank[a.status] !== statusRank[b.status]) {
          return statusRank[a.status] - statusRank[b.status];
        }
        const ax = a.daysToExhaustion ?? Number.MAX_SAFE_INTEGER;
        const bx = b.daysToExhaustion ?? Number.MAX_SAFE_INTEGER;
        return ax - bx;
      });

    // Agrupar por cliente
    const clientMap = new Map<string, { clientName: string; accounts: AccountPacingRow[] }>();
    for (const row of rows) {
      const key = row.client?.id ?? 'sin-cliente';
      const name = row.client?.name ?? 'Sin cliente asignado';
      if (!clientMap.has(key)) clientMap.set(key, { clientName: name, accounts: [] });
      clientMap.get(key)!.accounts.push(row);
    }

    const byClient = Array.from(clientMap.entries()).map(([clientId, value]) => {
      const worstStatus = value.accounts.reduce<PacingStatus>((worst, r) => {
        return statusRank[r.status] < statusRank[worst] ? r.status : worst;
      }, 'green');
      return {
        clientId: clientId === 'sin-cliente' ? null : clientId,
        clientName: value.clientName,
        accounts: value.accounts,
        worstStatus,
      };
    });

    // Frescura por plataforma (última sincronización)
    const platforms = await this.listPlatforms();
    const platformFreshness = platforms.map((p) => {
      const platformAccounts = accounts.filter((a) => a.platformId === p.id);
      const lastSyncedAt = platformAccounts.reduce<Date | null>((latest, a) => {
        if (!a.lastSyncedAt) return latest;
        if (!latest || a.lastSyncedAt > latest) return a.lastSyncedAt;
        return latest;
      }, null);
      return { slug: p.slug, name: p.name, lastSyncedAt };
    });

    const accountsWithoutBudget = rows.filter((r) => r.budgetAmount === null).length;

    const stats = await this.getStats(rows);

    return { stats, needsAttention, byClient, platformFreshness, accountsWithoutBudget };
  }

  async getStats(precomputed?: AccountPacingRow[]): Promise<{
    totalBudget: number;
    totalSpend: number;
    pctConsumed: number;
    accountsAtRisk: number;
    totalAccounts: number;
    accountsWithoutBudget: number;
    month: string;
  }> {
    const info = this.monthInfo(new Date());
    let rows = precomputed;
    if (!rows) {
      const accounts = await this.loadActiveAccounts();
      rows = [];
      for (const account of accounts) {
        const { row } = await this.computeAccountPacing(account, info);
        rows.push(row);
      }
    }

    const totalBudget = rows.reduce((s, r) => s + (r.budgetAmount ?? 0), 0);
    const totalSpend = rows.reduce((s, r) => s + r.spendAccumulated, 0);
    const pctConsumed = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0;
    const accountsAtRisk = rows.filter((r) => r.status === 'red' || r.status === 'yellow').length;
    const accountsWithoutBudget = rows.filter((r) => r.budgetAmount === null).length;

    return {
      totalBudget: Math.round(totalBudget * 100) / 100,
      totalSpend: Math.round(totalSpend * 100) / 100,
      pctConsumed: Math.round(pctConsumed * 100) / 100,
      accountsAtRisk,
      totalAccounts: rows.length,
      accountsWithoutBudget,
      month: info.monthStart,
    };
  }

  // ---------------------------------------------------------------------------
  // Cuentas
  // ---------------------------------------------------------------------------

  async getAccountsByPlatform(
    platformSlug: string | undefined,
    filters: QueryAccountsDto,
  ): Promise<{ platform: Platform | null; accounts: AccountPacingRow[] }> {
    let platform: Platform | null = null;
    if (platformSlug) {
      platform = await this.platformRepo.findOne({ where: { slug: platformSlug } });
      if (!platform) throw new NotFoundException('Plataforma no encontrada');
    }

    const referenceDate = filters.month ? new Date(`${filters.month}-01T00:00:00`) : new Date();
    const info = this.monthInfo(referenceDate);

    const where: Record<string, unknown> = { isActive: true };
    if (platform) where.platformId = platform.id;
    if (filters.clientRecordId) where.clientRecordId = filters.clientRecordId;

    const accounts = await this.accountRepo.find({
      where,
      relations: ACCOUNT_RELATIONS,
      order: { createdAt: 'DESC' },
    });

    let rows: AccountPacingRow[] = [];
    for (const account of accounts) {
      const { row } = await this.computeAccountPacing(account, info);
      rows.push(row);
    }

    if (filters.status) rows = rows.filter((r) => r.status === filters.status);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.nativeAccountName ?? '').toLowerCase().includes(q) ||
          r.nativeAccountId.toLowerCase().includes(q) ||
          (r.client?.name ?? '').toLowerCase().includes(q),
      );
    }

    return { platform, accounts: rows };
  }

  async listAccounts(filters: QueryAccountsDto): Promise<AccountPacingRow[]> {
    const { accounts } = await this.getAccountsByPlatform(filters.platform, filters);
    return accounts;
  }

  async getAccountDetail(accountId: string): Promise<{
    account: AccountPacingRow;
    raw: {
      id: string;
      platformId: string;
      credentialId: string | null;
      clientRecordId: string | null;
      timezone: string;
      syncEnabled: boolean;
      lastSyncError: string | null;
      createdAt: Date;
    };
    dailySpend: Array<{ date: string; spendMxn: number; spendNative: number; currency: string; source: string }>;
    budgetHistory: ReturnType<MediaService['serializeBudget']>[];
    alerts: ReturnType<MediaService['serializeAlert']>[];
  }> {
    const account = await this.accountRepo.findOne({
      where: { id: accountId },
      relations: ACCOUNT_RELATIONS,
    });
    if (!account) throw new NotFoundException('Cuenta no encontrada');

    const info = this.monthInfo(new Date());
    const { row } = await this.computeAccountPacing(account, info);

    // Gasto diario últimos 30 días
    const from = this.addDays(info.referenceDate, -29);
    const spendRows = await this.spendRepo.find({
      where: { adAccountId: accountId },
      order: { spendDate: 'ASC' },
    });
    const dailySpend = spendRows
      .filter((s) => s.spendDate >= from && s.spendDate <= info.referenceDate)
      .map((s) => ({
        date: s.spendDate,
        spendMxn: Number(s.spendMxn ?? s.spendNative),
        spendNative: Number(s.spendNative),
        currency: s.currency,
        source: s.dataSource,
      }));

    const budgets = await this.budgetRepo.find({
      where: { adAccountId: accountId },
      order: { budgetMonth: 'DESC', version: 'DESC' },
    });

    const alerts = await this.alertRepo.find({
      where: { adAccountId: accountId, status: 'active' as const },
      order: { createdAt: 'DESC' },
    });

    return {
      account: row,
      raw: {
        id: account.id,
        platformId: account.platformId,
        credentialId: account.credentialId,
        clientRecordId: account.clientRecordId,
        timezone: account.timezone,
        syncEnabled: account.syncEnabled,
        lastSyncError: account.lastSyncError,
        createdAt: account.createdAt,
      },
      dailySpend,
      budgetHistory: budgets.map((b) => this.serializeBudget(b)),
      alerts: alerts.map((a) => this.serializeAlert(a)),
    };
  }

  async createAccount(dto: CreateAdAccountDto): Promise<AdAccount> {
    const platform = await this.platformRepo.findOne({ where: { id: dto.platformId } });
    if (!platform) throw new BadRequestException('Plataforma inválida');

    const existing = await this.accountRepo.findOne({
      where: { platformId: dto.platformId, nativeAccountId: dto.nativeAccountId },
    });
    if (existing) {
      throw new BadRequestException('Ya existe una cuenta con ese ID nativo en esta plataforma');
    }

    const account = this.accountRepo.create({
      platformId: dto.platformId,
      credentialId: dto.credentialId ?? null,
      clientRecordId: dto.clientRecordId ?? null,
      nativeAccountId: dto.nativeAccountId,
      nativeAccountName: dto.nativeAccountName ?? null,
      currency: dto.currency ?? 'MXN',
      timezone: dto.timezone ?? 'America/Mexico_City',
      accountManagerId: dto.accountManagerId ?? null,
      isActive: dto.isActive ?? true,
      syncEnabled: dto.syncEnabled ?? true,
    });
    return this.accountRepo.save(account);
  }

  async updateAccount(id: string, dto: UpdateAdAccountDto): Promise<AdAccount> {
    const account = await this.accountRepo.findOne({ where: { id } });
    if (!account) throw new NotFoundException('Cuenta no encontrada');
    Object.assign(account, {
      credentialId: dto.credentialId ?? account.credentialId,
      clientRecordId: dto.clientRecordId ?? account.clientRecordId,
      nativeAccountName: dto.nativeAccountName ?? account.nativeAccountName,
      currency: dto.currency ?? account.currency,
      timezone: dto.timezone ?? account.timezone,
      accountManagerId: dto.accountManagerId ?? account.accountManagerId,
      isActive: dto.isActive ?? account.isActive,
      syncEnabled: dto.syncEnabled ?? account.syncEnabled,
    });
    return this.accountRepo.save(account);
  }

  async getAccountSpend(
    accountId: string,
    query: QuerySpendDto,
  ): Promise<Array<{ date: string; spendMxn: number; spendNative: number; currency: string; source: string }>> {
    const account = await this.accountRepo.findOne({ where: { id: accountId } });
    if (!account) throw new NotFoundException('Cuenta no encontrada');

    const days = query.days ?? 30;
    const info = this.monthInfo(new Date());
    const from = this.addDays(info.referenceDate, -(days - 1));

    const spendRows = await this.spendRepo.find({
      where: { adAccountId: accountId },
      order: { spendDate: 'ASC' },
    });
    return spendRows
      .filter((s) => s.spendDate >= from)
      .map((s) => ({
        date: s.spendDate,
        spendMxn: Number(s.spendMxn ?? s.spendNative),
        spendNative: Number(s.spendNative),
        currency: s.currency,
        source: s.dataSource,
      }));
  }

  async getAccountPacing(accountId: string, dateStr?: string): Promise<AccountPacingRow> {
    return this.calculatePacing(accountId, dateStr);
  }

  // ---------------------------------------------------------------------------
  // Presupuestos
  // ---------------------------------------------------------------------------

  private normalizeMonth(monthStr: string): string {
    // Acepta YYYY-MM o YYYY-MM-DD → normaliza al primer día del mes
    return `${monthStr.slice(0, 7)}-01`;
  }

  async upsertBudget(dto: UpsertBudgetDto, userId: string): Promise<MediaBudget> {
    const account = await this.accountRepo.findOne({ where: { id: dto.adAccountId } });
    if (!account) throw new NotFoundException('Cuenta no encontrada');

    const budgetMonth = this.normalizeMonth(dto.budgetMonth);

    return this.dataSource.transaction(async (mgr) => {
      const repo = mgr.getRepository(MediaBudget);

      // Buscar versión previa "current"
      const previous = await repo.findOne({
        where: { adAccountId: dto.adAccountId, budgetMonth, isCurrent: true },
      });

      // Máxima versión existente para este mes/cuenta
      const maxRow = await repo
        .createQueryBuilder('b')
        .select('COALESCE(MAX(b.version), 0)', 'max')
        .where('b.ad_account_id = :accountId', { accountId: dto.adAccountId })
        .andWhere('b.budget_month = :budgetMonth', { budgetMonth })
        .getRawOne<{ max: string }>();
      const nextVersion = Number(maxRow?.max ?? 0) + 1;

      if (previous) {
        previous.isCurrent = false;
        await repo.save(previous);
      }

      const amount = dto.amount;
      const currency = dto.currency ?? 'MXN';
      const budget = repo.create({
        adAccountId: dto.adAccountId,
        budgetMonth,
        amount: String(amount),
        currency,
        amountMxn: dto.amountMxn != null ? String(dto.amountMxn) : currency === 'MXN' ? String(amount) : null,
        version: nextVersion,
        isCurrent: true,
        approvedBy: dto.approvedBy ?? null,
        notes: dto.notes ?? null,
        source: (dto.source ?? 'manual') as MediaBudget['source'],
        createdBy: userId,
      });
      const saved = await repo.save(budget);

      await mgr.getRepository(MediaAuditLog).save(
        mgr.getRepository(MediaAuditLog).create({
          adAccountId: dto.adAccountId,
          actionType: previous ? 'budget_adjusted' : 'budget_created',
          performedBy: userId,
          reason: dto.notes ?? null,
          beforeState: previous ? { amount: previous.amount, version: previous.version } : null,
          afterState: { amount: saved.amount, version: saved.version },
          success: true,
        }),
      );

      // Resolver alertas de "sin presupuesto" para este mes
      await mgr
        .getRepository(MediaAlert)
        .createQueryBuilder()
        .update()
        .set({ status: 'resolved', resolvedAt: () => 'NOW()' })
        .where('ad_account_id = :accountId', { accountId: dto.adAccountId })
        .andWhere('alert_type = :type', { type: 'no_budget' })
        .andWhere('status = :status', { status: 'active' })
        .execute();

      return saved;
    });
  }

  async updateBudget(id: string, dto: UpdateBudgetDto, userId: string): Promise<MediaBudget> {
    const budget = await this.budgetRepo.findOne({ where: { id } });
    if (!budget) throw new NotFoundException('Presupuesto no encontrado');

    // Un ajuste crea una nueva versión (mantiene historial)
    const payload: UpsertBudgetDto = {
      adAccountId: budget.adAccountId,
      budgetMonth: budget.budgetMonth,
      amount: dto.amount ?? Number(budget.amount),
      currency: dto.currency ?? budget.currency,
      source: budget.source,
    };
    if (dto.approvedBy !== undefined) payload.approvedBy = dto.approvedBy;
    if (dto.notes !== undefined) payload.notes = dto.notes;
    return this.upsertBudget(payload, userId);
  }

  async getBudgetHistory(accountId: string): Promise<ReturnType<MediaService['serializeBudget']>[]> {
    const budgets = await this.budgetRepo.find({
      where: { adAccountId: accountId },
      order: { budgetMonth: 'DESC', version: 'DESC' },
    });
    return budgets.map((b) => this.serializeBudget(b));
  }

  async listBudgets(filters: QueryBudgetsDto): Promise<ReturnType<MediaService['serializeBudget']>[]> {
    const where: Record<string, unknown> = {};
    if (filters.adAccountId) where.adAccountId = filters.adAccountId;
    if (filters.month) where.budgetMonth = this.normalizeMonth(filters.month);

    const budgets = await this.budgetRepo.find({
      where,
      relations: ['adAccount', 'adAccount.platform', 'adAccount.clientRecord', 'adAccount.clientRecord.primaryCompany'],
      order: { budgetMonth: 'DESC', version: 'DESC' },
    });
    return budgets.map((b) => this.serializeBudget(b, true));
  }

  private serializeBudget(b: MediaBudget, includeAccount = false) {
    return {
      id: b.id,
      adAccountId: b.adAccountId,
      budgetMonth: b.budgetMonth,
      amount: Number(b.amount),
      currency: b.currency,
      amountMxn: b.amountMxn != null ? Number(b.amountMxn) : null,
      version: b.version,
      isCurrent: b.isCurrent,
      notes: b.notes,
      source: b.source,
      createdAt: b.createdAt,
      account: includeAccount && b.adAccount
        ? {
            id: b.adAccount.id,
            nativeAccountName: b.adAccount.nativeAccountName,
            nativeAccountId: b.adAccount.nativeAccountId,
            platform: b.adAccount.platform?.name ?? null,
            client: b.adAccount.clientRecord?.primaryCompany?.name ?? null,
          }
        : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Pacing: cálculo y snapshots
  // ---------------------------------------------------------------------------

  async calculatePacing(accountId: string, dateStr?: string): Promise<AccountPacingRow> {
    const account = await this.accountRepo.findOne({
      where: { id: accountId },
      relations: ACCOUNT_RELATIONS,
    });
    if (!account) throw new NotFoundException('Cuenta no encontrada');

    const reference = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
    const info = this.monthInfo(reference);
    const { row } = await this.computeAccountPacing(account, info);
    return row;
  }

  async processAllPacingSnapshots(): Promise<{ processed: number; snapshotDate: string }> {
    const info = this.monthInfo(new Date());
    const accounts = await this.loadActiveAccounts();
    let processed = 0;

    for (const account of accounts) {
      const { row, result, budget } = await this.computeAccountPacing(account, info);

      const existing = await this.pacingRepo.findOne({
        where: { adAccountId: account.id, snapshotDate: info.referenceDate },
      });

      const payload: Partial<PacingSnapshot> = {
        adAccountId: account.id,
        budgetId: budget?.id ?? null,
        snapshotDate: info.referenceDate,
        budgetAmount: result.budgetAmount != null ? String(result.budgetAmount) : null,
        currency: account.currency,
        spendAccumulated: String(result.spendAccumulated),
        spendExpected: result.spendExpected != null ? String(result.spendExpected) : null,
        spendDailyAvg: result.spendDailyAvg != null ? String(result.spendDailyAvg) : null,
        spendDailyIdeal: result.spendDailyIdeal != null ? String(result.spendDailyIdeal) : null,
        spendDailyRemaining:
          result.spendDailyRemaining != null ? String(result.spendDailyRemaining) : null,
        pctConsumed: result.pctConsumed != null ? String(result.pctConsumed) : null,
        pacingPct: result.pacingPct != null ? String(result.pacingPct) : null,
        projectedClose: result.projectedClose != null ? String(result.projectedClose) : null,
        projectedExhaustionDate: row.projectedExhaustionDate,
        daysRemaining: result.daysRemaining,
        status: result.status,
      };

      if (existing) {
        await this.pacingRepo.update(existing.id, payload);
      } else {
        await this.pacingRepo.save(this.pacingRepo.create(payload));
      }

      await this.evaluateAlerts(account.id, row);
      processed += 1;
    }

    this.logger.log(`Pacing procesado para ${processed} cuentas (${info.referenceDate})`);
    return { processed, snapshotDate: info.referenceDate };
  }

  /**
   * Genera alertas según el estado de pacing, evitando duplicados activos.
   */
  private async evaluateAlerts(accountId: string, row: AccountPacingRow): Promise<void> {
    const toRaise: Array<{ type: string; severity: string; message: string }> = [];

    if (row.budgetAmount === null) {
      toRaise.push({
        type: 'no_budget',
        severity: 'medium',
        message: 'La cuenta no tiene presupuesto asignado para el mes en curso.',
      });
    } else {
      if (row.status === 'red') {
        toRaise.push({
          type: 'pacing_red',
          severity: 'high',
          message: `Pacing en rojo (${row.pacingPct ?? 0}%). Consumo ${row.pctConsumed ?? 0}%.`,
        });
      } else if (row.status === 'yellow') {
        toRaise.push({
          type: 'pacing_yellow',
          severity: 'medium',
          message: `Pacing en amarillo (${row.pacingPct ?? 0}%).`,
        });
      }
      if (row.daysToExhaustion !== null && row.daysToExhaustion <= 7) {
        toRaise.push({
          type: 'exhaustion_7d',
          severity: 'high',
          message: `Presupuesto se agota en ~${row.daysToExhaustion} días.`,
        });
      }
      if ((row.pctConsumed ?? 0) >= 100) {
        toRaise.push({
          type: 'budget_exhausted',
          severity: 'critical',
          message: 'El presupuesto del mes ya fue consumido en su totalidad.',
        });
      }
    }

    for (const alert of toRaise) {
      const existing = await this.alertRepo.findOne({
        where: { adAccountId: accountId, alertType: alert.type as MediaAlert['alertType'], status: 'active' },
      });
      if (existing) continue;
      await this.alertRepo.save(
        this.alertRepo.create({
          adAccountId: accountId,
          alertType: alert.type as MediaAlert['alertType'],
          severity: alert.severity as MediaAlert['severity'],
          message: alert.message,
          status: 'active',
          details: { pacingPct: row.pacingPct, pctConsumed: row.pctConsumed, status: row.status },
        }),
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Alertas
  // ---------------------------------------------------------------------------

  async getAlerts(filters: QueryAlertsDto): Promise<ReturnType<MediaService['serializeAlert']>[]> {
    const qb = this.alertRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.adAccount', 'account')
      .leftJoinAndSelect('account.platform', 'platform')
      .leftJoinAndSelect('account.clientRecord', 'client')
      .leftJoinAndSelect('client.primaryCompany', 'company')
      .orderBy('a.created_at', 'DESC');

    if (filters.status) qb.andWhere('a.status = :status', { status: filters.status });
    if (filters.severity) qb.andWhere('a.severity = :severity', { severity: filters.severity });
    if (filters.adAccountId) qb.andWhere('a.ad_account_id = :accountId', { accountId: filters.adAccountId });
    if (filters.alertType) qb.andWhere('a.alert_type = :type', { type: filters.alertType });

    const alerts = await qb.getMany();
    return alerts.map((a) => this.serializeAlert(a, true));
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<ReturnType<MediaService['serializeAlert']>> {
    const alert = await this.alertRepo.findOne({ where: { id: alertId } });
    if (!alert) throw new NotFoundException('Alerta no encontrada');
    alert.status = 'acknowledged';
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();
    const saved = await this.alertRepo.save(alert);

    await this.auditRepo.save(
      this.auditRepo.create({
        adAccountId: alert.adAccountId,
        actionType: 'alert_acknowledged',
        performedBy: userId,
        reason: `Alerta ${alert.alertType} reconocida`,
        success: true,
      }),
    );
    return this.serializeAlert(saved);
  }

  async getActiveAlertsCount(): Promise<{ count: number }> {
    const count = await this.alertRepo.count({ where: { status: 'active' } });
    return { count };
  }

  private serializeAlert(a: MediaAlert, includeAccount = false) {
    return {
      id: a.id,
      adAccountId: a.adAccountId,
      alertType: a.alertType,
      severity: a.severity,
      message: a.message,
      details: a.details,
      status: a.status,
      acknowledgedBy: a.acknowledgedBy,
      acknowledgedAt: a.acknowledgedAt,
      resolvedAt: a.resolvedAt,
      createdAt: a.createdAt,
      account: includeAccount && a.adAccount
        ? {
            id: a.adAccount.id,
            nativeAccountName: a.adAccount.nativeAccountName,
            platform: a.adAccount.platform?.name ?? null,
            platformSlug: a.adAccount.platform?.slug ?? null,
            client: a.adAccount.clientRecord?.primaryCompany?.name ?? null,
          }
        : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Bitácora
  // ---------------------------------------------------------------------------

  async getAuditLog(filters: QueryAuditLogDto): Promise<
    Array<{
      id: string;
      adAccountId: string | null;
      actionType: string;
      reason: string | null;
      success: boolean | null;
      errorMessage: string | null;
      nativeCampaignName: string | null;
      performedBy: string | null;
      createdAt: Date;
    }>
  > {
    const qb = this.auditRepo.createQueryBuilder('l').orderBy('l.created_at', 'DESC');
    if (filters.adAccountId) qb.andWhere('l.ad_account_id = :accountId', { accountId: filters.adAccountId });
    if (filters.actionType) qb.andWhere('l.action_type = :type', { type: filters.actionType });
    qb.limit(filters.limit ?? 100);

    const logs = await qb.getMany();
    return logs.map((l) => ({
      id: l.id,
      adAccountId: l.adAccountId,
      actionType: l.actionType,
      reason: l.reason,
      success: l.success,
      errorMessage: l.errorMessage,
      nativeCampaignName: l.nativeCampaignName,
      performedBy: l.performedBy,
      createdAt: l.createdAt,
    }));
  }

  // ---------------------------------------------------------------------------
  // Credenciales de API
  // ---------------------------------------------------------------------------

  async listCredentials(
    filters: QueryCredentialsDto,
  ): Promise<ReturnType<MediaService['serializeCredential']>[]> {
    const where: Record<string, unknown> = {};
    if (filters.platformId) where.platformId = filters.platformId;
    if (!filters.includeInactive) where.isActive = true;

    const credentials = await this.credentialRepo.find({
      where,
      relations: ['platform'],
      order: { createdAt: 'DESC' },
    });
    return credentials.map((c) => this.serializeCredential(c));
  }

  async createCredential(
    dto: CreateCredentialDto,
    userId?: string,
  ): Promise<ReturnType<MediaService['serializeCredential']>> {
    const platform = await this.platformRepo.findOne({ where: { id: dto.platformId } });
    if (!platform) throw new BadRequestException('Plataforma inválida');

    const credential = this.credentialRepo.create({
      platformId: dto.platformId,
      name: dto.name,
      secretArn: dto.secretArn,
      credentialType: dto.credentialType as ApiCredential['credentialType'],
      mccAccountId: dto.mccAccountId ?? null,
      businessAccountId: dto.businessAccountId ?? null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      notes: dto.notes ?? null,
      isActive: true,
      createdBy: userId ?? null,
    });
    const saved = await this.credentialRepo.save(credential);
    const withPlatform = await this.credentialRepo.findOne({
      where: { id: saved.id },
      relations: ['platform'],
    });
    return this.serializeCredential(withPlatform ?? saved);
  }

  async updateCredential(
    id: string,
    dto: UpdateCredentialDto,
  ): Promise<ReturnType<MediaService['serializeCredential']>> {
    const credential = await this.credentialRepo.findOne({ where: { id } });
    if (!credential) throw new NotFoundException('Credencial no encontrada');

    if (dto.name !== undefined) credential.name = dto.name;
    if (dto.secretArn !== undefined) credential.secretArn = dto.secretArn;
    if (dto.credentialType !== undefined) {
      credential.credentialType = dto.credentialType as ApiCredential['credentialType'];
    }
    if (dto.mccAccountId !== undefined) credential.mccAccountId = dto.mccAccountId;
    if (dto.businessAccountId !== undefined) credential.businessAccountId = dto.businessAccountId;
    if (dto.expiresAt !== undefined) credential.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (dto.notes !== undefined) credential.notes = dto.notes;
    if (dto.isActive !== undefined) credential.isActive = dto.isActive;

    const saved = await this.credentialRepo.save(credential);
    const withPlatform = await this.credentialRepo.findOne({
      where: { id: saved.id },
      relations: ['platform'],
    });
    return this.serializeCredential(withPlatform ?? saved);
  }

  async deactivateCredential(id: string): Promise<{ id: string; isActive: boolean }> {
    const credential = await this.credentialRepo.findOne({ where: { id } });
    if (!credential) throw new NotFoundException('Credencial no encontrada');
    credential.isActive = false;
    await this.credentialRepo.save(credential);
    return { id: credential.id, isActive: false };
  }

  private serializeCredential(c: ApiCredential) {
    const now = Date.now();
    const expiresAt = c.expiresAt ? new Date(c.expiresAt) : null;
    const isExpired = expiresAt ? expiresAt.getTime() < now : false;
    const daysToExpire = expiresAt
      ? Math.ceil((expiresAt.getTime() - now) / (1000 * 60 * 60 * 24))
      : null;

    let status: 'active' | 'expired' | 'inactive';
    if (!c.isActive) status = 'inactive';
    else if (isExpired) status = 'expired';
    else status = 'active';

    return {
      id: c.id,
      platformId: c.platformId,
      platform: c.platform
        ? { id: c.platform.id, name: c.platform.name, slug: c.platform.slug, color: c.platform.color }
        : null,
      name: c.name,
      secretArn: c.secretArn,
      credentialType: c.credentialType,
      mccAccountId: c.mccAccountId,
      businessAccountId: c.businessAccountId,
      expiresAt: c.expiresAt,
      daysToExpire,
      isExpired,
      lastVerifiedAt: c.lastVerifiedAt,
      notes: c.notes,
      isActive: c.isActive,
      status,
      createdAt: c.createdAt,
    };
  }

  // ---------------------------------------------------------------------------
  // Logs de sincronización
  // ---------------------------------------------------------------------------

  async getSyncLogs(filters: QuerySyncLogsDto): Promise<
    Array<{
      id: string;
      platform: string | null;
      platformSlug: string | null;
      accountName: string | null;
      syncType: string;
      startedAt: Date;
      finishedAt: Date | null;
      durationMs: number | null;
      status: string;
      recordsFetched: number;
      recordsSaved: number;
      errorMessage: string | null;
      httpStatus: number | null;
    }>
  > {
    const qb = this.syncLogRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.platform', 'platform')
      .leftJoinAndSelect('s.adAccount', 'account')
      .orderBy('s.started_at', 'DESC');

    if (filters.platformId) qb.andWhere('s.platform_id = :platformId', { platformId: filters.platformId });
    if (filters.accountId) qb.andWhere('s.ad_account_id = :accountId', { accountId: filters.accountId });
    if (filters.status) qb.andWhere('s.status = :status', { status: filters.status });
    qb.limit(filters.limit ?? 100);

    const logs = await qb.getMany();
    return logs.map((l) => ({
      id: l.id,
      platform: l.platform?.name ?? null,
      platformSlug: l.platform?.slug ?? null,
      accountName: l.adAccount?.nativeAccountName ?? l.adAccount?.nativeAccountId ?? null,
      syncType: l.syncType,
      startedAt: l.startedAt,
      finishedAt: l.finishedAt,
      durationMs:
        l.finishedAt && l.startedAt
          ? new Date(l.finishedAt).getTime() - new Date(l.startedAt).getTime()
          : null,
      status: l.status,
      recordsFetched: l.recordsFetched,
      recordsSaved: l.recordsSaved,
      errorMessage: l.errorMessage,
      httpStatus: l.httpStatus,
    }));
  }
}
