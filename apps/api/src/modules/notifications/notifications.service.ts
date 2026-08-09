import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import { ExpensesService } from '../expenses/expenses.service';
import { VacationsService } from '../vacations/vacations.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { RespondNotificationDto } from './dto/respond-notification.dto';
import { Notification } from './entities/notification.entity';
import { NotificationFlowsService } from './notification-flows.service';
import { NotificationsGateway } from './notifications.gateway';

export interface PaginatedNotifications {
  items: Notification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  unreadCount: number;
}

const DEFAULT_LIMIT = 20;

/**
 * Label del destinatario → flujo que se dispara cuando esa área da "Atendido".
 * Se compara en minúsculas para que 'TI', 'ti' o 'Ti' resuelvan igual.
 */
const TERMINATION_EVENT_BY_LABEL: Record<string, string> = {
  ti: 'baja_atendida_ti',
  core: 'baja_atendida_core',
  operaciones: 'baja_atendida_operaciones',
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification) private readonly repo: Repository<Notification>,
    @InjectRepository(EmployeeRecord) private readonly employeesRepo: Repository<EmployeeRecord>,
    private readonly gateway: NotificationsGateway,
    // Mismo módulo, pero NotificationFlowsService ya depende de este servicio:
    // sin forwardRef el grafo no se puede ordenar.
    @Inject(forwardRef(() => NotificationFlowsService))
    private readonly flowsService: NotificationFlowsService,
    // Ciclo real: vacaciones crea notificaciones y responder una notificación
    // aprueba/rechaza la solicitud. forwardRef lo resuelve en ambos sentidos.
    @Inject(forwardRef(() => VacationsService))
    private readonly vacationsService: VacationsService,
    // Mismo ciclo que vacaciones: gastos crea notificaciones y responder una
    // autoriza el reporte.
    @Inject(forwardRef(() => ExpensesService))
    private readonly expensesService: ExpensesService,
  ) {}

  // ==========================================================================
  // Escritura
  // ==========================================================================

  /** Punto de entrada para el resto de módulos. */
  async create(dto: CreateNotificationDto): Promise<Notification> {
    const notification = await this.repo.save(
      this.repo.create({
        recipientId: dto.recipientId,
        senderId: dto.senderId ?? null,
        senderName: dto.senderName ?? null,
        title: dto.title,
        message: dto.message,
        type: dto.type,
        status: 'no_leida',
        module: dto.module ?? null,
        entityId: dto.entityId ?? null,
        entityType: dto.entityType ?? null,
        actionUrl: dto.actionUrl ?? null,
      }),
    );

    // Tiempo real: badge y lista del destinatario se actualizan sin recargar.
    this.gateway.sendToUser(notification.recipientId, notification);
    this.gateway.sendUnreadCount(
      notification.recipientId,
      await this.getUnreadCount(notification.recipientId),
    );

    // TODO: enviar email cuando SES esté configurado para este flujo.
    // Requiere inyectar el repositorio de User y EmailService (ya exportado por
    // este módulo) para resolver el correo del destinatario:
    // const recipient = await this.usersRepo.findOne({ where: { id: notification.recipientId } });
    // if (recipient?.email) {
    //   await this.emailService.sendNotificationEmail(recipient.email, notification);
    //   notification.emailSent = true;
    //   notification.emailSentAt = new Date();
    //   await this.repo.save(notification);
    // }
    // El correo solo avisa "Tienes una nueva notificación en Lievant Admin",
    // sin detalles ni botones de acción — únicamente para que entren a la plataforma.

    return notification;
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const notification = await this.getOwned(notificationId, userId);

    // Una ya respondida (aceptada/rechazada) conserva su estado: marcarla como
    // 'leida' al reabrirla borraría el resultado de la acción.
    if (notification.status !== 'no_leida') return;

    notification.status = 'leida';
    notification.readAt = new Date();
    await this.repo.save(notification);

    this.gateway.sendUnreadCount(userId, await this.getUnreadCount(userId));
  }

  /**
   * Oculta las notificaciones de un registro que deja de existir (p. ej. una
   * solicitud de vacaciones eliminada): quedarían apuntando a algo que ya no se
   * puede abrir, y las de acción seguirían ofreciendo Aceptar/Rechazar.
   *
   * Refresca el badge de cada destinatario afectado; si no, el contador queda
   * inflado hasta que recarguen.
   */
  async softDeleteByEntity(entityType: string, entityId: string): Promise<number> {
    const afectadas = await this.repo.find({
      where: { entityType, entityId },
      select: { id: true, recipientId: true, status: true },
    });
    if (afectadas.length === 0) return 0;

    await this.repo.softDelete({ entityType, entityId });

    const conNoLeidas = new Set(
      afectadas.filter((n) => n.status === 'no_leida').map((n) => n.recipientId),
    );
    for (const recipientId of conNoLeidas) {
      this.gateway.sendUnreadCount(recipientId, await this.getUnreadCount(recipientId));
    }

    return afectadas.length;
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.repo.update(
      { recipientId: userId, status: 'no_leida' },
      { status: 'leida', readAt: new Date() },
    );

    this.gateway.sendUnreadCount(userId, await this.getUnreadCount(userId));
  }

  /**
   * Acepta o rechaza una notificación de acción y dispara el efecto en el
   * módulo de origen. El efecto va primero: si la solicitud ya no admite
   * cambios, la notificación no debe quedar marcada como respondida.
   */
  async respond(
    notificationId: string,
    user: User,
    dto: RespondNotificationDto,
  ): Promise<Notification> {
    const notification = await this.getOwned(notificationId, user.id);

    if (notification.type === 'informativa') {
      throw new BadRequestException('Esta notificación es informativa y no admite respuesta.');
    }

    if (notification.status === 'aceptada' || notification.status === 'rechazada') {
      throw new BadRequestException('Esta notificación ya fue respondida.');
    }

    const note = dto.note?.trim() || null;

    if (notification.entityType === 'vacation_request' && notification.entityId) {
      await this.applyVacationResponse(notification, user, dto.action, note);
    }

    if (notification.entityType === 'expense_report' && notification.entityId) {
      await this.applyExpenseResponse(notification.entityId, user, dto.action, note);
    }

    if (notification.entityType === 'employee_termination') {
      if (notification.type === 'atencion' && dto.action === 'rechazada') {
        throw new BadRequestException('Esta notificación solo admite marcarse como atendida.');
      }
      await this.notifyHrOfTerminationStep(notification, user, note);
    }

    notification.status = dto.action;
    notification.responseNote = note;
    notification.respondedAt = new Date();
    notification.respondedBy = user.id;
    if (!notification.readAt) notification.readAt = new Date();
    await this.repo.save(notification);

    this.gateway.sendUnreadCount(user.id, await this.getUnreadCount(user.id));

    return notification;
  }

  /**
   * Avisa a RRHH que un área terminó su parte del proceso de baja.
   *
   * El área sale del `label` con el que la persona está dada de alta como
   * destinataria del flujo rrhh.baja_registrada ('TI', 'CORE', 'Operaciones'),
   * no de su expediente: el responsable de CORE está en Transformación Digital
   * y el de Operaciones en Recursos Humanos, así que el nombre del área no
   * identifica el rol. Sin label se cae a 'core' y el aviso sale igual, con el
   * nombre de quien respondió.
   *
   * Quien recibe el aviso son los destinatarios configurados de
   * rrhh.baja_atendida_*, no una persona fija en código.
   */
  private async notifyHrOfTerminationStep(
    notification: Notification,
    user: User,
    note: string | null,
  ): Promise<void> {
    try {
      const employee = await this.employeesRepo.findOne({ where: { authUserId: user.id } });
      const label = await this.flowsService.getRecipientLabelForUser(
        'rrhh',
        'baja_registrada',
        user.id,
      );

      const evento = TERMINATION_EVENT_BY_LABEL[(label ?? '').toLowerCase()] ?? 'baja_atendida_core';
      const areaLegible = label ?? employee?.fullName ?? user.name ?? user.email;
      // El título de la notificación de baja trae el nombre del empleado.
      const empleado = notification.title.replace(/^Baja de empleado:\s*/i, '');

      await this.flowsService.notify('rrhh', evento, {
        requesterId: user.id,
        requesterEmployeeId: employee?.id ?? null,
        actorId: user.id,
        entityId: notification.entityId,
        entityType: 'employee_termination',
        senderName: 'Sistema',
        title: `${areaLegible} ha completado el proceso de baja`,
        message:
          `${areaLegible} confirmó que completó las tareas correspondientes a la baja de ` +
          `${empleado}.${note ? ` Nota: ${note}` : ''}`,
        actionUrl: '/herramientas/mis-notificaciones',
        notificationType: 'informativa',
      });
    } catch (err) {
      this.logger.error(
        `No se pudo avisar a RRHH del avance de la baja: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * Autoriza o rechaza el reporte de gastos vinculado.
   *
   * authorizeReport valida que quien responde sea el autorizador designado y
   * que el reporte siga en 'submitted'; si algo de eso falla lanza, respond()
   * corta antes de marcar la notificación y no quedan estado y notificación
   * desincronizados.
   *
   * No avisa al solicitante: authorizeReport ya lo hace, igual que cuando se
   * resuelve desde la pantalla del reporte.
   */
  private async applyExpenseResponse(
    reportId: string,
    user: User,
    action: 'aceptada' | 'rechazada',
    note: string | null,
  ): Promise<void> {
    await this.expensesService.authorizeReport(reportId, user, {
      action: action === 'aceptada' ? 'authorized' : 'rejected',
      ...(note ? { note } : {}),
    });
  }

  /**
   * Aprueba o rechaza la solicitud de vacaciones vinculada.
   *
   * Usa approveRequest/rejectRequest (flujo de jefe) y no las variantes admin:
   * esas se saltan la verificación de jefe directo, así que responder una
   * notificación reenviada permitiría aprobar vacaciones ajenas.
   *
   * No avisa al colaborador: de eso se encargan approveRequest/rejectRequest,
   * que también corren cuando se aprueba desde la pantalla de vacaciones.
   * Duplicarlo aquí le mandaría dos notificaciones por la misma decisión.
   */
  private async applyVacationResponse(
    notification: Notification,
    user: User,
    action: 'aceptada' | 'rechazada',
    note: string | null,
  ): Promise<void> {
    const requestId = notification.entityId as string;

    if (action === 'aceptada') {
      await this.vacationsService.approveRequest(requestId, user);
    } else {
      await this.vacationsService.rejectRequest(
        requestId,
        user,
        note ?? 'Rechazada desde notificaciones sin motivo especificado.',
      );
    }
  }

  // ==========================================================================
  // Consultas
  // ==========================================================================

  async getMyNotifications(
    userId: string,
    filters: QueryNotificationsDto,
  ): Promise<PaginatedNotifications> {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : DEFAULT_LIMIT;

    const qb = this.repo
      .createQueryBuilder('n')
      .where('n.recipient_id = :userId', { userId })
      .andWhere('n.deleted_at IS NULL');

    if (filters.module) {
      qb.andWhere('n.module = :module', { module: filters.module });
    }

    if (filters.status === 'pendientes') {
      // Acciones que aún esperan respuesta del usuario, 'atencion' incluida:
      // también espera que alguien confirme que ya la ejecutó.
      qb.andWhere('n.type IN (:...actionTypes)', {
        actionTypes: ['accion', 'accion_con_nota', 'atencion'],
      }).andWhere('n.status = :pending', { pending: 'no_leida' });
    } else if (filters.status === 'informativa') {
      qb.andWhere('n.type = :type', { type: 'informativa' });
    } else if (filters.status) {
      qb.andWhere('n.status = :status', { status: filters.status });
    }

    const [items, total] = await qb
      .orderBy('n.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      unreadCount: await this.getUnreadCount(userId),
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.repo.count({ where: { recipientId: userId, status: 'no_leida' } });
  }

  /** Últimas 5 para el widget del dashboard. */
  async getRecent(userId: string): Promise<Notification[]> {
    return this.repo.find({
      where: { recipientId: userId },
      order: { createdAt: 'DESC' },
      take: 5,
    });
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /** Carga la notificación garantizando que pertenece a quien la manipula. */
  private async getOwned(notificationId: string, userId: string): Promise<Notification> {
    const notification = await this.repo.findOne({ where: { id: notificationId } });
    if (!notification) throw new NotFoundException('Notificación no encontrada.');
    if (notification.recipientId !== userId) {
      throw new ForbiddenException('Esta notificación no te pertenece.');
    }
    return notification;
  }
}
