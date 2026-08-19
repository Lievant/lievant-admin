import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { userHasPermission } from '../auth/permissions.util';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import { CatalogExpenseConcept } from '../expenses/entities/catalog-expense-concept.entity';
import { CatalogExpenseType } from '../expenses/entities/catalog-expense-type.entity';
import { NotificationFlowsService } from '../notifications/notification-flows.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CardExpenseLineDto,
  CreateCardReportDto,
  CreateCreditCardDto,
  PresignedUploadDto,
  ProcessCardReportDto,
  QueryCardReportsDto,
  QueryCreditCardsDto,
  RegisterInvoiceDto,
  UpdateCardReportDto,
  UpdateCreditCardDto,
} from './dto/credit-cards.dto';
import {
  assertKeyInPrefix,
  assertUploadAllowed,
  MAX_UPLOAD_BYTES,
} from '../../common/s3-upload.util';
import { CardExpenseLine } from './entities/card-expense-line.entity';
import { CardExpenseReport } from './entities/card-expense-report.entity';
import { CreditCard } from './entities/credit-card.entity';
import {
  ALLOWED_INVOICE_MIME_TYPES,
  CreditCardsStorageService,
} from './credit-cards-storage.service';

const DEFAULT_LIMIT = 20;
const MODULE = 'gastos-tarjeta';

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function formatLongDate(date: string): string {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return `${d} de ${MONTHS[(m ?? 1) - 1] ?? ''} de ${y}`;
}

function money(value: string | number): string {
  return Number(value).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

export interface PaginatedCardReports {
  items: CardExpenseReport[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class CreditCardsService {
  private readonly logger = new Logger(CreditCardsService.name);

  constructor(
    @InjectRepository(CreditCard) private readonly cardsRepo: Repository<CreditCard>,
    @InjectRepository(CardExpenseReport)
    private readonly reportsRepo: Repository<CardExpenseReport>,
    @InjectRepository(CardExpenseLine) private readonly linesRepo: Repository<CardExpenseLine>,
    @InjectRepository(EmployeeRecord) private readonly employeesRepo: Repository<EmployeeRecord>,
    private readonly dataSource: DataSource,
    private readonly storage: CreditCardsStorageService,
    private readonly notificationsService: NotificationsService,
    private readonly flowsService: NotificationFlowsService,
  ) {}

  // ==========================================================================
  // Maestro de tarjetas
  // ==========================================================================

  async createCard(dto: CreateCreditCardDto): Promise<CreditCard> {
    const holder = await this.employeesRepo.findOne({ where: { id: dto.holderEmployeeId } });
    if (!holder) throw new BadRequestException('El titular seleccionado no existe.');

    const card = await this.cardsRepo.save(
      this.cardsRepo.create({
        lastFour: dto.lastFour,
        alias: dto.alias ?? null,
        holderEmployeeId: holder.id,
        // Se copia el usuario del titular para poder notificarle sin resolver el
        // expediente cada vez.
        holderUserId: holder.authUserId,
        notes: dto.notes ?? null,
        isActive: dto.isActive ?? true,
      }),
    );

    return this.getCardOrFail(card.id);
  }

  async updateCard(id: string, dto: UpdateCreditCardDto): Promise<CreditCard> {
    const card = await this.getCardOrFail(id);

    if (dto.holderEmployeeId && dto.holderEmployeeId !== card.holderEmployeeId) {
      const holder = await this.employeesRepo.findOne({ where: { id: dto.holderEmployeeId } });
      if (!holder) throw new BadRequestException('El titular seleccionado no existe.');
      card.holderEmployeeId = holder.id;
      card.holderUserId = holder.authUserId;
    }

    if (dto.lastFour !== undefined) card.lastFour = dto.lastFour;
    if (dto.alias !== undefined) card.alias = dto.alias;
    if (dto.notes !== undefined) card.notes = dto.notes;
    if (dto.isActive !== undefined) card.isActive = dto.isActive;

    await this.cardsRepo.save(card);
    return this.getCardOrFail(id);
  }

  async toggleActive(id: string): Promise<CreditCard> {
    const card = await this.getCardOrFail(id);
    card.isActive = !card.isActive;
    await this.cardsRepo.save(card);
    return this.getCardOrFail(id);
  }

  async deleteCard(id: string): Promise<{ deleted: true }> {
    const card = await this.getCardOrFail(id);

    // Soft delete, pero se bloquea si tiene reportes: la tarjeta es el contexto
    // de gastos ya reportados y perderla dejaría el histórico sin referencia.
    const enUso = await this.reportsRepo.count({ where: { creditCardId: card.id } });
    if (enUso > 0) {
      throw new BadRequestException(
        `Esta tarjeta tiene ${enUso} reporte(s) asociados. Desactívala en lugar de eliminarla.`,
      );
    }

    await this.cardsRepo.softDelete({ id });
    return { deleted: true };
  }

  async getCards(filters: QueryCreditCardsDto): Promise<CreditCard[]> {
    const qb = this.cardsRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.holderEmployee', 'emp')
      .where('c.deleted_at IS NULL');

    if (filters.includeInactive !== 'true') {
      qb.andWhere('c.is_active = true');
    }
    if (filters.search) {
      qb.andWhere('(c.last_four ILIKE :q OR c.alias ILIKE :q OR emp.full_name ILIKE :q)', {
        q: `%${filters.search}%`,
      });
    }

    return qb.orderBy('c.isActive', 'DESC').addOrderBy('c.lastFour', 'ASC').getMany();
  }

  getActiveCards(): Promise<CreditCard[]> {
    return this.cardsRepo.find({
      where: { isActive: true },
      relations: { holderEmployee: true },
      order: { lastFour: 'ASC' },
    });
  }

  private async getCardOrFail(id: string): Promise<CreditCard> {
    const card = await this.cardsRepo.findOne({
      where: { id },
      relations: { holderEmployee: true },
    });
    if (!card) throw new NotFoundException('Tarjeta no encontrada.');
    return card;
  }

  // ==========================================================================
  // Reportes — escritura
  // ==========================================================================

  async createReport(user: User, dto: CreateCardReportDto): Promise<CardExpenseReport> {
    this.assertPeriod(dto.periodStart, dto.periodEnd);
    const card = await this.assertUsableCard(dto.creditCardId);
    const employee = await this.employeesRepo.findOne({ where: { authUserId: user.id } });

    const report = await this.dataSource.transaction(async (mgr) => {
      const created = await mgr.getRepository(CardExpenseReport).save(
        mgr.getRepository(CardExpenseReport).create({
          reportNumber: await this.nextReportNumber(mgr),
          creditCardId: card.id,
          creatorId: user.id,
          creatorEmployeeId: employee?.id ?? null,
          department: dto.department ?? employee?.area ?? null,
          periodStart: dto.periodStart,
          periodEnd: dto.periodEnd,
          observations: dto.observations ?? null,
          status: 'draft',
        }),
      );

      await this.replaceLines(mgr, created.id, dto.lines ?? []);
      await this.recalculateTotals(mgr, created.id);
      return created;
    });

    return this.getReportOrFail(report.id);
  }

  async updateReport(
    id: string,
    user: User,
    dto: UpdateCardReportDto,
  ): Promise<CardExpenseReport> {
    const report = await this.getReportOrFail(id);
    this.assertCreator(report, user);

    if (report.status !== 'draft') {
      throw new BadRequestException('Solo se puede editar un reporte en borrador.');
    }
    this.assertPeriod(dto.periodStart, dto.periodEnd);
    const card = await this.assertUsableCard(dto.creditCardId);

    await this.dataSource.transaction(async (mgr) => {
      await mgr.getRepository(CardExpenseReport).update(
        { id },
        {
          creditCardId: card.id,
          department: dto.department ?? null,
          periodStart: dto.periodStart,
          periodEnd: dto.periodEnd,
          observations: dto.observations ?? null,
        },
      );
      await this.replaceLines(mgr, id, dto.lines ?? []);
      await this.recalculateTotals(mgr, id);
    });

    return this.getReportOrFail(id);
  }

  async submitReport(id: string, user: User): Promise<CardExpenseReport> {
    const report = await this.getReportOrFail(id);
    this.assertCreator(report, user);

    if (report.status !== 'draft') {
      throw new BadRequestException(`El reporte ya fue enviado (estado: ${report.status}).`);
    }
    if (report.lines.length === 0) {
      throw new BadRequestException('Agrega al menos una línea de gasto antes de enviar.');
    }

    report.status = 'submitted';
    report.submittedAt = new Date();
    await this.reportsRepo.save(report);

    await this.notifySubmitted(report, user);
    return this.getReportOrFail(id);
  }

  async processReport(
    id: string,
    user: User,
    dto: ProcessCardReportDto,
  ): Promise<CardExpenseReport> {
    const report = await this.getReportOrFail(id);

    if (report.status !== 'submitted') {
      throw new BadRequestException(
        report.status === 'draft'
          ? 'El reporte todavía no se ha enviado a Finanzas.'
          : 'El reporte ya fue procesado.',
      );
    }

    report.status = 'processed';
    report.processedBy = user.id;
    report.processedAt = new Date();
    report.paymentDate = dto.paymentDate;
    report.paymentNote = dto.note?.trim() || null;
    await this.reportsRepo.save(report);

    await this.notifyProcessed(report, user, dto.paymentDate);
    return this.getReportOrFail(id);
  }

  async deleteReport(id: string, user: User): Promise<{ deleted: true }> {
    const report = await this.getReportOrFail(id);
    this.assertCreator(report, user);

    if (report.status !== 'draft') {
      throw new BadRequestException('Solo se puede eliminar un reporte en borrador.');
    }

    await this.reportsRepo.softDelete({ id });
    return { deleted: true };
  }

  async uploadInvoice(
    reportId: string,
    lineId: string,
    user: User,
    file: Express.Multer.File,
  ): Promise<CardExpenseLine> {
    const report = await this.getReportOrFail(reportId);
    this.assertCreator(report, user);

    if (report.status !== 'draft') {
      throw new BadRequestException('Solo se pueden adjuntar facturas mientras es borrador.');
    }

    const line = report.lines.find((l) => l.id === lineId);
    if (!line) throw new NotFoundException('Línea de gasto no encontrada.');

    const key = await this.storage.uploadInvoice(file, reportId, lineId);
    await this.linesRepo.update(
      { id: lineId },
      { hasInvoice: true, invoiceS3Key: key, invoiceOriginalName: file.originalname },
    );

    const updated = await this.linesRepo.findOne({ where: { id: lineId } });
    if (!updated) throw new NotFoundException('Línea de gasto no encontrada.');
    return updated;
  }

  /** Paso 1 del upload directo: valida tipo/tamaño declarados y firma la URL. */
  async createPresignedInvoiceUpload(
    reportId: string,
    lineId: string,
    user: User,
    dto: PresignedUploadDto,
  ): Promise<{ uploadUrl: string; s3Key: string }> {
    const report = await this.getReportOrFail(reportId);
    this.assertCreator(report, user);

    if (report.status !== 'draft') {
      throw new BadRequestException('Solo se pueden adjuntar facturas mientras es borrador.');
    }

    const line = report.lines.find((l) => l.id === lineId);
    if (!line) throw new NotFoundException('Línea de gasto no encontrada.');

    assertUploadAllowed(dto.fileType, dto.fileSize, ALLOWED_INVOICE_MIME_TYPES);

    return this.storage.getPresignedUploadUrl(dto.fileName, dto.fileType, reportId, lineId);
  }

  /**
   * Paso 3: el objeto ya está en S3. Revalida tipo, pertenencia de la key y el
   * tamaño REAL del objeto, porque el declarado viene del navegador.
   */
  async registerInvoice(
    reportId: string,
    lineId: string,
    user: User,
    dto: RegisterInvoiceDto,
  ): Promise<CardExpenseLine> {
    const report = await this.getReportOrFail(reportId);
    this.assertCreator(report, user);

    if (report.status !== 'draft') {
      throw new BadRequestException('Solo se pueden adjuntar facturas mientras es borrador.');
    }

    const line = report.lines.find((l) => l.id === lineId);
    if (!line) throw new NotFoundException('Línea de gasto no encontrada.');

    assertUploadAllowed(dto.fileType, dto.fileSize, ALLOWED_INVOICE_MIME_TYPES);
    assertKeyInPrefix(dto.s3Key, CreditCardsStorageService.invoicePrefix(reportId, lineId));

    const actualSize = await this.storage.getObjectSize(dto.s3Key);
    if (actualSize === null) {
      throw new BadRequestException('El archivo no se encontró en el almacenamiento');
    }
    if (actualSize > MAX_UPLOAD_BYTES) {
      await this.storage.deleteObject(dto.s3Key);
      throw new BadRequestException(
        `El archivo no puede superar ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB`,
      );
    }

    await this.linesRepo.update(
      { id: lineId },
      { hasInvoice: true, invoiceS3Key: dto.s3Key, invoiceOriginalName: dto.fileName },
    );

    const updated = await this.linesRepo.findOne({ where: { id: lineId } });
    if (!updated) throw new NotFoundException('Línea de gasto no encontrada.');
    return updated;
  }

  // ==========================================================================
  // Reportes — consultas
  // ==========================================================================

  getMyReports(user: User, filters: QueryCardReportsDto): Promise<PaginatedCardReports> {
    return this.queryReports(filters, (qb) =>
      qb.andWhere('r.creator_id = :userId', { userId: user.id }),
    );
  }

  getAllReports(filters: QueryCardReportsDto): Promise<PaginatedCardReports> {
    return this.queryReports(filters, (qb) => {
      if (filters.search) {
        qb.andWhere(
          '(r.report_number ILIKE :q OR emp.full_name ILIKE :q OR card.alias ILIKE :q OR card.last_four ILIKE :q)',
          { q: `%${filters.search}%` },
        );
      }
      return qb;
    });
  }

  async getReportDetail(id: string, user: User): Promise<CardExpenseReport> {
    const report = await this.getReportOrFail(id);
    this.assertCanRead(report, user);
    await this.attachInvoiceUrls(report);
    return report;
  }

  private queryReports(
    filters: QueryCardReportsDto,
    scope: (qb: ReturnType<Repository<CardExpenseReport>['createQueryBuilder']>) => unknown,
  ): Promise<PaginatedCardReports> {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : DEFAULT_LIMIT;

    const qb = this.reportsRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.creditCard', 'card')
      .leftJoinAndSelect('card.holderEmployee', 'holder')
      .leftJoinAndSelect('r.creatorEmployee', 'emp')
      .leftJoinAndSelect('r.creator', 'u')
      .where('r.deleted_at IS NULL');

    if (filters.status) qb.andWhere('r.status = :status', { status: filters.status });
    if (filters.creditCardId) {
      qb.andWhere('r.credit_card_id = :cardId', { cardId: filters.creditCardId });
    }
    if (filters.dateFrom) qb.andWhere('r.period_end >= :from', { from: filters.dateFrom });
    if (filters.dateTo) qb.andWhere('r.period_start <= :to', { to: filters.dateTo });

    scope(qb);

    // Nombre de propiedad, no de columna: con skip/take TypeORM resuelve el
    // orden contra la metadata de la entidad.
    return qb
      .orderBy('r.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount()
      .then(([items, total]) => ({
        items,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      }));
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private async getReportOrFail(id: string): Promise<CardExpenseReport> {
    const report = await this.reportsRepo.findOne({
      where: { id },
      relations: {
        lines: true,
        creditCard: { holderEmployee: true },
        creator: true,
        creatorEmployee: true,
      },
      order: { lines: { sortOrder: 'ASC' } },
    });
    if (!report) throw new NotFoundException('Reporte no encontrado.');
    return report;
  }

  private assertCreator(report: CardExpenseReport, user: User): void {
    if (report.creatorId !== user.id) {
      throw new ForbiddenException('Este reporte no te pertenece.');
    }
  }

  /** Lo ven el creador, el titular de la tarjeta y Finanzas. */
  private assertCanRead(report: CardExpenseReport, user: User): void {
    if (report.creatorId === user.id) return;
    if (report.creditCard?.holderUserId === user.id) return;
    if (userHasPermission(user, 'finanzas', 'gastos-tarjeta', 'read')) return;
    throw new ForbiddenException('No tienes acceso a este reporte.');
  }

  private assertPeriod(start: string, end: string): void {
    if (end < start) {
      throw new BadRequestException('La fecha de término no puede ser anterior a la de inicio.');
    }
  }

  private async assertUsableCard(cardId: string): Promise<CreditCard> {
    const card = await this.cardsRepo.findOne({ where: { id: cardId } });
    if (!card) throw new BadRequestException('La tarjeta seleccionada no existe.');
    if (!card.isActive) {
      throw new BadRequestException('La tarjeta seleccionada está desactivada.');
    }
    return card;
  }

  /** FIN-TC-YYYY-NNN, con su propia secuencia separada de la de reembolsos. */
  private async nextReportNumber(mgr: {
    query: (sql: string) => Promise<unknown>;
  }): Promise<string> {
    const rows = (await mgr.query(
      `SELECT nextval('expenses.card_report_number_seq') AS seq`,
    )) as { seq: string }[];
    const seq = rows[0]?.seq ?? '0';
    return `FIN-TC-${new Date().getUTCFullYear()}-${String(seq).padStart(3, '0')}`;
  }

  /**
   * Sincroniza las líneas con lo que manda el cliente: las que llegan con `id`
   * se actualizan en su lugar, las nuevas se insertan y las ausentes se borran.
   *
   * No se puede borrar todo y reinsertar: la factura vive en la propia línea
   * (has_invoice / invoice_s3_key) y se sube antes de guardar, así que un
   * DELETE + INSERT dejaba el comprobante huérfano en S3 y la línea sin factura.
   */
  private async replaceLines(
    mgr: { getRepository: DataSource['getRepository'] },
    reportId: string,
    lines: CardExpenseLineDto[],
  ): Promise<void> {
    const linesRepo = mgr.getRepository(CardExpenseLine);

    const existing = await linesRepo.find({ where: { reportId } });
    const existingById = new Map(existing.map((l) => [l.id, l]));

    const keptIds = new Set(
      lines.map((l) => l.id).filter((id): id is string => !!id && existingById.has(id)),
    );
    const removedIds = existing.filter((l) => !keptIds.has(l.id)).map((l) => l.id);
    if (removedIds.length > 0) {
      await linesRepo.delete({ id: In(removedIds) });
    }

    if (lines.length === 0) return;

    const conceptIds = lines.map((l) => l.conceptId).filter((v): v is string => !!v);
    const typeIds = lines.map((l) => l.expenseTypeId).filter((v): v is string => !!v);

    const [concepts, types] = await Promise.all([
      conceptIds.length
        ? mgr.getRepository(CatalogExpenseConcept).find({ where: { id: In(conceptIds) } })
        : Promise.resolve([]),
      typeIds.length
        ? mgr.getRepository(CatalogExpenseType).find({ where: { id: In(typeIds) } })
        : Promise.resolve([]),
    ]);

    const conceptName = new Map(concepts.map((c) => [c.id, c.name]));
    const typeName = new Map(types.map((t) => [t.id, t.name]));

    await linesRepo.save(
      lines.map((line, index) => {
        // Un id desconocido (de otro reporte, o ya borrado) entra como línea nueva.
        const current = line.id ? existingById.get(line.id) : undefined;

        return linesRepo.create({
          ...(current
            ? {
                id: current.id,
                // La factura no viaja en el payload: se conserva la ya adjunta.
                hasInvoice: current.hasInvoice,
                invoiceS3Key: current.invoiceS3Key,
                invoiceOriginalName: current.invoiceOriginalName,
              }
            : {}),
          reportId,
          lineDate: line.lineDate,
          collaborator: line.collaborator ?? null,
          motive: line.motive ?? null,
          vendor: line.vendor,
          conceptId: line.conceptId ?? null,
          conceptName: line.conceptId ? (conceptName.get(line.conceptId) ?? null) : null,
          expenseTypeId: line.expenseTypeId ?? null,
          expenseTypeName: line.expenseTypeId ? (typeName.get(line.expenseTypeId) ?? null) : null,
          subtotal: (line.subtotal ?? 0).toFixed(2),
          tip: (line.tip ?? 0).toFixed(2),
          extras: (line.extras ?? 0).toFixed(2),
          sortOrder: line.sortOrder ?? index,
        });
      }),
    );
  }

  private async recalculateTotals(
    mgr: { query: (sql: string, params: unknown[]) => Promise<unknown> },
    reportId: string,
  ): Promise<void> {
    await mgr.query(
      `UPDATE expenses.card_expense_reports r SET
         total_subtotal = COALESCE(t.subtotal, 0),
         total_tip      = COALESCE(t.tip, 0),
         total_extras   = COALESCE(t.extras, 0),
         total_amount   = COALESCE(t.total, 0),
         updated_at     = NOW()
       FROM (
         SELECT SUM(subtotal) AS subtotal, SUM(tip) AS tip,
                SUM(extras) AS extras, SUM(total) AS total
         FROM expenses.card_expense_lines WHERE report_id = $1
       ) t
       WHERE r.id = $1`,
      [reportId],
    );
  }

  private async attachInvoiceUrls(report: CardExpenseReport): Promise<void> {
    for (const line of report.lines ?? []) {
      if (!line.hasInvoice) continue;

      // has_invoice sin key es un estado inconsistente: la línea se muestra
      // "sin factura", pero queda registrado para poder rastrearlo.
      if (!line.invoiceS3Key) {
        this.logger.error(
          `La línea ${line.id} del reporte ${report.id} tiene has_invoice=true sin invoice_s3_key.`,
        );
        continue;
      }

      try {
        line.invoiceUrl = await this.storage.getPresignedUrl(line.invoiceS3Key, 3600);
      } catch (err) {
        line.invoiceUrl = null;
        this.logger.warn(
          `No se pudo firmar la factura de la línea ${line.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }

  // ==========================================================================
  // Notificaciones
  // ==========================================================================

  private describe(report: CardExpenseReport): string {
    const card = report.creditCard;
    return `•••• ${card?.lastFour ?? '????'}${card?.alias ? ` (${card.alias})` : ''}`;
  }

  private async notifySubmitted(report: CardExpenseReport, user: User): Promise<void> {
    const creador = report.creatorEmployee?.fullName ?? user.name ?? user.email;
    const rango = `${formatLongDate(report.periodStart)} al ${formatLongDate(report.periodEnd)}`;

    try {
      await this.notificationsService.create({
        recipientId: report.creatorId,
        senderName: 'Sistema',
        title: 'Reporte de tarjeta enviado a Finanzas',
        message:
          `Tu reporte ${report.reportNumber} de la tarjeta ${this.describe(report)} ` +
          `por ${money(report.totalAmount)} fue enviado a Finanzas.`,
        type: 'informativa',
        module: MODULE,
        entityId: report.id,
        entityType: 'card_expense_report',
        actionUrl: `/herramientas/mis-gastos-tarjeta/${report.id}`,
      });

      // Al titular solo si no es quien capturó: si no, recibiría el mismo aviso
      // dos veces.
      const holderUserId = report.creditCard?.holderUserId;
      if (holderUserId && holderUserId !== report.creatorId) {
        await this.notificationsService.create({
          recipientId: holderUserId,
          senderId: report.creatorId,
          senderName: creador,
          title: `Reporte de tu tarjeta ${this.describe(report)}`,
          message:
            `${creador} envió a Finanzas un reporte de gastos de tu tarjeta por ` +
            `${money(report.totalAmount)}, del ${rango}.`,
          type: 'informativa',
          module: MODULE,
          entityId: report.id,
          entityType: 'card_expense_report',
          actionUrl: `/herramientas/mis-gastos-tarjeta/${report.id}`,
        });
      }

      await this.flowsService.notify(MODULE, 'reporte_enviado', {
        requesterId: report.creatorId,
        requesterEmployeeId: report.creatorEmployeeId,
        actorId: report.creatorId,
        entityId: report.id,
        entityType: 'card_expense_report',
        senderName: creador,
        title: `Reporte de tarjeta por revisar — ${this.describe(report)}`,
        message:
          `${creador} envió el reporte ${report.reportNumber} por ${money(report.totalAmount)} ` +
          `del ${rango}.`,
        actionUrl: `/finanzas/tarjetas/reportes/${report.id}`,
      });
    } catch (err) {
      this.logNotifyError(report, err);
    }
  }

  private async notifyProcessed(
    report: CardExpenseReport,
    user: User,
    paymentDate: string,
  ): Promise<void> {
    const mensaje =
      `El reporte ${report.reportNumber} de la tarjeta ${this.describe(report)} por ` +
      `${money(report.totalAmount)} fue procesado por Finanzas con fecha de pago ` +
      `${formatLongDate(paymentDate)}.${report.paymentNote ? ` Nota: ${report.paymentNote}` : ''}`;

    try {
      const destinatarios = new Set<string>([report.creatorId]);
      const holderUserId = report.creditCard?.holderUserId;
      if (holderUserId) destinatarios.add(holderUserId);

      for (const recipientId of destinatarios) {
        await this.notificationsService.create({
          recipientId,
          senderName: 'Sistema',
          title: 'Reporte de tarjeta procesado',
          message: mensaje,
          type: 'informativa',
          module: MODULE,
          entityId: report.id,
          entityType: 'card_expense_report',
          actionUrl: `/herramientas/mis-gastos-tarjeta/${report.id}`,
        });
      }

      await this.flowsService.notify(MODULE, 'reporte_procesado', {
        requesterId: report.creatorId,
        requesterEmployeeId: report.creatorEmployeeId,
        actorId: user.id,
        entityId: report.id,
        entityType: 'card_expense_report',
        senderName: 'Sistema',
        title: 'Reporte de tarjeta procesado',
        message: mensaje,
        actionUrl: `/finanzas/tarjetas/reportes/${report.id}`,
      });
    } catch (err) {
      this.logNotifyError(report, err);
    }
  }

  private logNotifyError(report: CardExpenseReport, err: unknown): void {
    this.logger.error(
      `No se pudo notificar sobre el reporte ${report.reportNumber}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}
