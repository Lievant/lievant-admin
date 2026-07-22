import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdAccount } from './entities/ad-account.entity';
import { SyncLog } from './entities/sync-log.entity';
import { MediaService } from './media.service';

/**
 * Servicio de sincronización con las plataformas publicitarias.
 *
 * Por ahora los conectores son placeholders: registran un log en
 * media_control.sync_logs pero no llaman a las APIs reales. Cuando se
 * implementen los conectores (Meta Marketing API, Google Ads API, etc.)
 * la firma de estos métodos se mantiene y sólo cambia el cuerpo.
 */
@Injectable()
export class MediaSyncService {
  private readonly logger = new Logger(MediaSyncService.name);

  constructor(
    @InjectRepository(AdAccount) private readonly accountRepo: Repository<AdAccount>,
    @InjectRepository(SyncLog) private readonly syncLogRepo: Repository<SyncLog>,
    private readonly mediaService: MediaService,
  ) {}

  private async startLog(
    account: AdAccount,
    syncType: SyncLog['syncType'],
  ): Promise<SyncLog> {
    return this.syncLogRepo.save(
      this.syncLogRepo.create({
        platformId: account.platformId,
        adAccountId: account.id,
        syncType,
        status: 'running',
      }),
    );
  }

  private async finishLog(
    log: SyncLog,
    status: SyncLog['status'],
    patch: Partial<SyncLog> = {},
  ): Promise<void> {
    await this.syncLogRepo.update(log.id, {
      status,
      finishedAt: new Date(),
      ...patch,
    });
  }

  // --- Conectores (placeholders) ---

  async syncMetaSpend(accountId: string): Promise<void> {
    const account = await this.accountRepo.findOne({ where: { id: accountId } });
    if (!account) return;
    const log = await this.startLog(account, 'daily_spend');
    this.logger.log(`[PLACEHOLDER] syncMetaSpend cuenta=${accountId} (Meta Marketing API)`);
    // TODO: implementar llamada real a la Meta Marketing API (insights endpoint)
    await this.finishLog(log, 'success', { recordsFetched: 0, recordsSaved: 0 });
  }

  async syncGoogleSpend(accountId: string): Promise<void> {
    const account = await this.accountRepo.findOne({ where: { id: accountId } });
    if (!account) return;
    const log = await this.startLog(account, 'daily_spend');
    this.logger.log(`[PLACEHOLDER] syncGoogleSpend cuenta=${accountId} (Google Ads API)`);
    // TODO: implementar llamada real a la Google Ads API (GAQL report)
    await this.finishLog(log, 'success', { recordsFetched: 0, recordsSaved: 0 });
  }

  /**
   * Despacha la sincronización de una cuenta según su plataforma.
   */
  private async syncAccount(account: AdAccount): Promise<void> {
    const slug = account.platform?.slug;
    try {
      switch (slug) {
        case 'meta':
          await this.syncMetaSpend(account.id);
          break;
        case 'google':
          await this.syncGoogleSpend(account.id);
          break;
        default:
          this.logger.debug(`Sin conector para plataforma "${slug ?? 'desconocida'}" (cuenta ${account.id})`);
      }
      await this.accountRepo.update(account.id, { lastSyncedAt: new Date(), lastSyncError: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error sincronizando cuenta ${account.id}: ${message}`);
      await this.accountRepo.update(account.id, { lastSyncError: message });
    }
  }

  /**
   * Itera todas las cuentas activas con sincronización habilitada.
   */
  async syncAllAccounts(): Promise<{ synced: number }> {
    const accounts = await this.accountRepo.find({
      where: { isActive: true, syncEnabled: true },
      relations: ['platform'],
    });
    for (const account of accounts) {
      await this.syncAccount(account);
    }
    this.logger.log(`Sincronización completada: ${accounts.length} cuentas`);

    // Tras sincronizar, recalcular pacing y alertas
    await this.mediaService.processAllPacingSnapshots();

    return { synced: accounts.length };
  }

  /**
   * Trigger manual (usado por el endpoint POST /media/sync/trigger).
   */
  async triggerSync(): Promise<{ synced: number }> {
    return this.syncAllAccounts();
  }

  // --- Cron: cada hora ---

  @Cron('0 * * * *')
  async hourlySyncCron(): Promise<void> {
    this.logger.log('Iniciando sincronización horaria de medios...');
    try {
      await this.syncAllAccounts();
    } catch (err) {
      this.logger.error(
        'Error en la sincronización horaria de medios',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
