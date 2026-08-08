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
import { NotificationsService } from '../notifications/notifications.service';
import {
  AuthorizeExpenseReportDto,
  CreateExpenseReportDto,
  ExpenseLineDto,
  ProcessExpenseReportDto,
  QueryExpenseReportsDto,
  UpdateExpenseReportDto,
} from './dto/expense-report.dto';
import { CatalogExpenseConcept } from './entities/catalog-expense-concept.entity';
import { CatalogExpenseType } from './entities/catalog-expense-type.entity';
import { ExpenseLine } from './entities/expense-line.entity';
import { ExpenseReport } from './entities/expense-report.entity';
import { ExpensesStorageService } from './expenses-storage.service';

const DEFAULT_LIMIT = 20;

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** 'YYYY-MM-DD' → '5 de marzo de 2026', sin pasar por la zona del servidor. */
function formatLongDate(date: string): string {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return `${d} de ${MONTHS[(m ?? 1) - 1] ?? ''} de ${y}`;
}

function money(value: string | number): string {
  return Number(value).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

export interface PaginatedReports {
  items: ExpenseReport[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    @InjectRepository(ExpenseReport) private readonly reportsRepo: Repository<ExpenseReport>,
    @InjectRepository(ExpenseLine) private readonly linesRepo: Repository<ExpenseLine>,
    @InjectRepository(EmployeeRecord) private readonly employeesRepo: Repository<EmployeeRecord>,
    @InjectRepository(CatalogExpenseConcept)
    private readonly conceptsRepo: Repository<CatalogExpenseConcept>,
    @InjectRepository(CatalogExpenseType)
    private readonly typesRepo: Repository<CatalogExpenseType>,
    private readonly dataSource: DataSource,
    private readonly storage: ExpensesStorageService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ==========================================================================
  // Catálogos
  // ==========================================================================

  async getCatalogs(): Promise<{
    concepts: CatalogExpenseConcept[];
    types: CatalogExpenseType[];
    departments: string[];
  }> {
    const [concepts, types, departments] = await Promise.all([
      this.conceptsRepo.find({ where: { isActive: true }, order: { sortOrder: 'ASC' } }),
      this.typesRepo.find({ where: { isActive: true }, order: { sortOrder: 'ASC' } }),
      this.listDepartments(),
    ]);
    return { concepts, types, departments };
  }

  /**
   * catalogs.areas está vacío en la práctica; las áreas reales viven en el
   * expediente de cada empleado, así que el desplegable se arma con las que
   * existen de verdad.
   */
  private async listDepartments(): Promise<string[]> {
    const rows = (await this.employeesRepo.query(
      `SELECT DISTINCT area FROM employees.employee_records
       WHERE area IS NOT NULL AND area <> '' AND deleted_at IS NULL
       ORDER BY area`,
    )) as { area: string }[];
    return rows.map((r) => r.area);
  }

  // ==========================================================================
  // Escritura
  // ==========================================================================

  async createReport(user: User, dto: CreateExpenseReportDto): Promise<ExpenseReport> {
    this.assertPeriod(dto.periodStart, dto.periodEnd);

    const employee = await this.employeesRepo.findOne({ where: { authUserId: user.id } });
    const authorizer = await this.resolveAuthorizer(dto.authorizerEmployeeId);

    const report = await this.dataSource.transaction(async (mgr) => {
      const created = await mgr.getRepository(ExpenseReport).save(
        mgr.getRepository(ExpenseReport).create({
          reportNumber: await this.nextReportNumber(mgr),
          requesterId: user.id,
          requesterEmployeeId: employee?.id ?? null,
          authorizerId: authorizer?.authUserId ?? null,
          authorizerEmployeeId: authorizer?.id ?? null,
          department: dto.department ?? employee?.area ?? null,
          motive: dto.motive,
          periodStart: dto.periodStart,
          periodEnd: dto.periodEnd,
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
    dto: UpdateExpenseReportDto,
  ): Promise<ExpenseReport> {
    const report = await this.getReportOrFail(id);
    this.assertOwner(report, user);

    if (report.status !== 'draft') {
      throw new BadRequestException('Solo se puede editar un reporte en borrador.');
    }
    this.assertPeriod(dto.periodStart, dto.periodEnd);

    const authorizer = await this.resolveAuthorizer(dto.authorizerEmployeeId);

    await this.dataSource.transaction(async (mgr) => {
      await mgr.getRepository(ExpenseReport).update(
        { id },
        {
          authorizerId: authorizer?.authUserId ?? null,
          authorizerEmployeeId: authorizer?.id ?? null,
          department: dto.department ?? null,
          motive: dto.motive,
          periodStart: dto.periodStart,
          periodEnd: dto.periodEnd,
        },
      );

      await this.replaceLines(mgr, id, dto.lines ?? []);
      await this.recalculateTotals(mgr, id);
    });

    return this.getReportOrFail(id);
  }

  async submitReport(id: string, user: User): Promise<ExpenseReport> {
    const report = await this.getReportOrFail(id);
    this.assertOwner(report, user);

    if (report.status !== 'draft') {
      throw new BadRequestException(`El reporte ya fue enviado (estado: ${report.status}).`);
    }
    if (report.lines.length === 0) {
      throw new BadRequestException('Agrega al menos una línea de gasto antes de enviar.');
    }
    if (!report.authorizerId) {
      throw new BadRequestException(
        'Selecciona un autorizador con usuario en la plataforma antes de enviar.',
      );
    }

    report.status = 'submitted';
    report.submittedAt = new Date();
    await this.reportsRepo.save(report);

    await this.notifySubmitted(report, user);
    return this.getReportOrFail(id);
  }

  async authorizeReport(
    id: string,
    user: User,
    dto: AuthorizeExpenseReportDto,
  ): Promise<ExpenseReport> {
    const report = await this.getReportOrFail(id);

    if (report.authorizerId !== user.id) {
      throw new ForbiddenException('Solo el autorizador designado puede resolver este reporte.');
    }
    if (report.status !== 'submitted') {
      throw new BadRequestException(
        report.status === 'draft'
          ? 'El reporte todavía no se ha enviado.'
          : `El reporte ya fue resuelto (estado: ${report.status}).`,
      );
    }

    report.status = dto.action;
    report.authorizedAt = new Date();
    report.authorizationNote = dto.note?.trim() || null;
    await this.reportsRepo.save(report);

    await this.notifyResolved(report, dto.action);
    return this.getReportOrFail(id);
  }

  async processReport(
    id: string,
    user: User,
    dto: ProcessExpenseReportDto,
  ): Promise<ExpenseReport> {
    const report = await this.getReportOrFail(id);

    if (report.status !== 'authorized') {
      throw new BadRequestException(
        `Solo se procesan reportes autorizados (estado actual: ${report.status}).`,
      );
    }

    report.status = 'processed';
    report.processedBy = user.id;
    report.processedAt = new Date();
    report.paymentDate = dto.paymentDate;
    report.paymentNote = dto.note?.trim() || null;
    await this.reportsRepo.save(report);

    await this.notifyProcessed(report, dto.paymentDate);
    return this.getReportOrFail(id);
  }

  async deleteReport(id: string, user: User): Promise<{ deleted: true }> {
    const report = await this.getReportOrFail(id);
    this.assertOwner(report, user);

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
  ): Promise<ExpenseLine> {
    const report = await this.getReportOrFail(reportId);
    this.assertOwner(report, user);

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

  async getInvoiceUrl(reportId: string, lineId: string, user: User): Promise<{ url: string }> {
    const report = await this.getReportOrFail(reportId);
    this.assertCanRead(report, user);

    const line = report.lines.find((l) => l.id === lineId);
    if (!line?.invoiceS3Key) throw new NotFoundException('Esta línea no tiene factura adjunta.');

    return { url: await this.storage.getPresignedUrl(line.invoiceS3Key) };
  }

  // ==========================================================================
  // Consultas
  // ==========================================================================

  async getMyReports(user: User, filters: QueryExpenseReportsDto): Promise<PaginatedReports> {
    return this.queryReports(filters, (qb) =>
      qb.andWhere('r.requester_id = :userId', { userId: user.id }),
    );
  }

  /** Bandeja del autorizador: lo que espera su firma. */
  async getReportsToAuthorize(user: User): Promise<ExpenseReport[]> {
    const result = await this.queryReports({ status: 'submitted', limit: 100 }, (qb) =>
      qb.andWhere('r.authorizer_id = :userId', { userId: user.id }),
    );
    return result.items;
  }

  async getAllReports(filters: QueryExpenseReportsDto): Promise<PaginatedReports> {
    return this.queryReports(filters, (qb) => {
      if (filters.requester) {
        qb.andWhere('(emp.full_name ILIKE :q OR u.email ILIKE :q OR r.report_number ILIKE :q)', {
          q: `%${filters.requester}%`,
        });
      }
      return qb;
    });
  }

  async getReportDetail(id: string, user: User): Promise<ExpenseReport> {
    const report = await this.getReportOrFail(id);
    this.assertCanRead(report, user);
    return report;
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private queryReports(
    filters: QueryExpenseReportsDto,
    scope: (qb: ReturnType<Repository<ExpenseReport>['createQueryBuilder']>) => unknown,
  ): Promise<PaginatedReports> {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : DEFAULT_LIMIT;

    const qb = this.reportsRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.requesterEmployee', 'emp')
      .leftJoinAndSelect('r.authorizerEmployee', 'authEmp')
      .leftJoinAndSelect('r.requester', 'u')
      .where('r.deleted_at IS NULL');

    if (filters.status) qb.andWhere('r.status = :status', { status: filters.status });
    if (filters.dateFrom) qb.andWhere('r.period_end >= :from', { from: filters.dateFrom });
    if (filters.dateTo) qb.andWhere('r.period_start <= :to', { to: filters.dateTo });

    scope(qb);

    return qb
      // Nombre de PROPIEDAD, no de columna: con skip/take TypeORM resuelve el
      // orden contra la metadata de la entidad y 'r.created_at' revienta con
      // "Cannot read properties of undefined (reading 'databaseName')".
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

  private async getReportOrFail(id: string): Promise<ExpenseReport> {
    const report = await this.reportsRepo.findOne({
      where: { id },
      relations: {
        lines: true,
        requester: true,
        requesterEmployee: true,
        authorizer: true,
        authorizerEmployee: true,
      },
      order: { lines: { sortOrder: 'ASC' } },
    });
    if (!report) throw new NotFoundException('Reporte no encontrado.');
    return report;
  }

  private assertOwner(report: ExpenseReport, user: User): void {
    if (report.requesterId !== user.id) {
      throw new ForbiddenException('Este reporte no te pertenece.');
    }
  }

  /** Lo ve el solicitante, su autorizador y Finanzas. */
  private assertCanRead(report: ExpenseReport, user: User): void {
    if (report.requesterId === user.id) return;
    if (report.authorizerId === user.id) return;
    if (userHasPermission(user, 'finanzas', 'reembolsos', 'read')) return;
    throw new ForbiddenException('No tienes acceso a este reporte.');
  }

  private assertPeriod(start: string, end: string): void {
    if (end < start) {
      throw new BadRequestException('La fecha de término no puede ser anterior a la de inicio.');
    }
  }

  private async resolveAuthorizer(employeeId?: string): Promise<EmployeeRecord | null> {
    if (!employeeId) return null;
    const employee = await this.employeesRepo.findOne({ where: { id: employeeId } });
    if (!employee) throw new BadRequestException('El autorizador seleccionado no existe.');
    return employee;
  }

  /** FIN-RE-YYYY-NNN. La secuencia es global, no por año: no se reinicia sola. */
  private async nextReportNumber(mgr: { query: (sql: string) => Promise<unknown> }): Promise<string> {
    const rows = (await mgr.query(
      `SELECT nextval('expenses.report_number_seq') AS seq`,
    )) as { seq: string }[];
    const seq = rows[0]?.seq ?? '0';
    return `FIN-RE-${new Date().getUTCFullYear()}-${String(seq).padStart(3, '0')}`;
  }

  /**
   * Reemplaza todas las líneas del reporte. Los conceptos se resuelven contra
   * el catálogo para guardar el nombre junto al id.
   */
  private async replaceLines(
    mgr: { getRepository: DataSource['getRepository'] },
    reportId: string,
    lines: ExpenseLineDto[],
  ): Promise<void> {
    const linesRepo = mgr.getRepository(ExpenseLine);
    await linesRepo.delete({ reportId });
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
      lines.map((line, index) =>
        linesRepo.create({
          reportId,
          lineDate: line.lineDate,
          vendor: line.vendor,
          conceptId: line.conceptId ?? null,
          conceptName: line.conceptId ? (conceptName.get(line.conceptId) ?? null) : null,
          expenseTypeId: line.expenseTypeId ?? null,
          expenseTypeName: line.expenseTypeId ? (typeName.get(line.expenseTypeId) ?? null) : null,
          subtotal: (line.subtotal ?? 0).toFixed(2),
          tip: (line.tip ?? 0).toFixed(2),
          extras: (line.extras ?? 0).toFixed(2),
          notes: line.notes ?? null,
          sortOrder: line.sortOrder ?? index,
        }),
      ),
    );
  }

  /** Los totales se suman en la base para que cuadren con la columna generada. */
  private async recalculateTotals(
    mgr: { query: (sql: string, params: unknown[]) => Promise<unknown> },
    reportId: string,
  ): Promise<void> {
    await mgr.query(
      `UPDATE expenses.expense_reports r SET
         total_subtotal = COALESCE(t.subtotal, 0),
         total_tip      = COALESCE(t.tip, 0),
         total_extras   = COALESCE(t.extras, 0),
         total_amount   = COALESCE(t.total, 0),
         updated_at     = NOW()
       FROM (
         SELECT SUM(subtotal) AS subtotal, SUM(tip) AS tip,
                SUM(extras) AS extras, SUM(total) AS total
         FROM expenses.expense_lines WHERE report_id = $1
       ) t
       WHERE r.id = $1`,
      [reportId],
    );
  }

  // ==========================================================================
  // Notificaciones
  //
  // Van por NotificationsService y no por el motor de flujos: el autorizador de
  // un reembolso lo elige el solicitante reporte por reporte, así que no hay una
  // regla configurable que resolver.
  // ==========================================================================

  private async notifySubmitted(report: ExpenseReport, user: User): Promise<void> {
    const nombre = report.requesterEmployee?.fullName ?? user.name ?? user.email;
    const rango = `${formatLongDate(report.periodStart)} al ${formatLongDate(report.periodEnd)}`;

    try {
      if (report.authorizerId) {
        await this.notificationsService.create({
          recipientId: report.authorizerId,
          senderId: user.id,
          senderName: nombre,
          title: `Reembolso por autorizar — ${nombre}`,
          message:
            `${nombre} envió el reporte ${report.reportNumber} por ${money(report.totalAmount)} ` +
            `del ${rango}. Motivo: ${report.motive}`,
          type: 'accion_con_nota',
          module: 'reembolsos',
          entityId: report.id,
          entityType: 'expense_report',
          actionUrl: `/herramientas/mis-reembolsos/${report.id}`,
        });
      }

      await this.notificationsService.create({
        recipientId: report.requesterId,
        senderName: 'Sistema',
        title: 'Reporte de reembolso enviado',
        message:
          `Tu reporte ${report.reportNumber} por ${money(report.totalAmount)} fue enviado ` +
          `y está pendiente de autorización.`,
        type: 'informativa',
        module: 'reembolsos',
        entityId: report.id,
        entityType: 'expense_report',
        actionUrl: `/herramientas/mis-reembolsos/${report.id}`,
      });
    } catch (err) {
      this.logNotifyError(report, err);
    }
  }

  private async notifyResolved(
    report: ExpenseReport,
    action: 'authorized' | 'rejected',
  ): Promise<void> {
    try {
      await this.notificationsService.create({
        recipientId: report.requesterId,
        senderName: 'Sistema',
        title:
          action === 'authorized'
            ? '¡Tu reembolso fue autorizado!'
            : 'Tu reporte de reembolso fue rechazado',
        message:
          action === 'authorized'
            ? `El reporte ${report.reportNumber} por ${money(report.totalAmount)} fue autorizado ` +
              `y pasó a Finanzas para su pago.${report.authorizationNote ? ` Nota: ${report.authorizationNote}` : ''}`
            : `El reporte ${report.reportNumber} fue rechazado.${report.authorizationNote ? ` Nota: ${report.authorizationNote}` : ''}`,
        type: 'informativa',
        module: 'reembolsos',
        entityId: report.id,
        entityType: 'expense_report',
        actionUrl: `/herramientas/mis-reembolsos/${report.id}`,
      });
    } catch (err) {
      this.logNotifyError(report, err);
    }
  }

  private async notifyProcessed(report: ExpenseReport, paymentDate: string): Promise<void> {
    try {
      await this.notificationsService.create({
        recipientId: report.requesterId,
        senderName: 'Sistema',
        title: 'Tu reembolso será pagado',
        message:
          `El reporte ${report.reportNumber} por ${money(report.totalAmount)} fue procesado ` +
          `por Finanzas. Tu reembolso será pagado el ${formatLongDate(paymentDate)}.` +
          `${report.paymentNote ? ` Nota: ${report.paymentNote}` : ''}`,
        type: 'informativa',
        module: 'reembolsos',
        entityId: report.id,
        entityType: 'expense_report',
        actionUrl: `/herramientas/mis-reembolsos/${report.id}`,
      });
    } catch (err) {
      this.logNotifyError(report, err);
    }
  }

  /** Un fallo notificando no revierte el cambio de estado, que ya está guardado. */
  private logNotifyError(report: ExpenseReport, err: unknown): void {
    this.logger.error(
      `No se pudo notificar sobre el reporte ${report.reportNumber}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}
