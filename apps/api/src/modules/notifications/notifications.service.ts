import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { VacationsService } from '../vacations/vacations.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { RespondNotificationDto } from './dto/respond-notification.dto';
import { Notification } from './entities/notification.entity';
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

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private readonly repo: Repository<Notification>,
    private readonly gateway: NotificationsGateway,
    // Ciclo real: vacaciones crea notificaciones y responder una notificación
    // aprueba/rechaza la solicitud. forwardRef lo resuelve en ambos sentidos.
    @Inject(forwardRef(() => VacationsService))
    private readonly vacationsService: VacationsService,
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
      // Acciones que aún esperan respuesta del usuario.
      qb.andWhere('n.type IN (:...actionTypes)', {
        actionTypes: ['accion', 'accion_con_nota'],
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
