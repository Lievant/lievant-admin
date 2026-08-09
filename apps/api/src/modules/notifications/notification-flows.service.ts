import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import { CreateFlowRecipientDto } from './dto/create-flow-recipient.dto';
import { UpdateFlowRecipientDto } from './dto/update-flow-recipient.dto';
import { FlowRecipient, type FlowRecipientType } from './entities/flow-recipient.entity';
import type { NotificationType } from './entities/notification.entity';
import { NotificationFlow } from './entities/notification-flow.entity';
import { NotificationsService } from './notifications.service';

/**
 * Contexto que el módulo emisor entrega al disparar un flujo.
 *
 * `requesterId` es el dueño del evento (el colaborador de la solicitud), no
 * quien pulsó el botón: así 'solicitante' y 'jefe_inmediato' resuelven igual en
 * los tres eventos de vacaciones. Quien dispara va en `actorId` y solo sirve
 * para no devolverle la notificación de su propia acción.
 */
export interface NotifyContext {
  /** Null si el expediente del solicitante aún no tiene usuario vinculado. */
  requesterId: string | null;
  requesterEmployeeId?: string | null;
  actorId?: string | null;
  entityId?: string | null;
  entityType?: string | null;
  title: string;
  message: string;
  actionUrl?: string | null;
  senderName?: string | null;
  /**
   * Fuerza el tipo de las notificaciones del disparo, ignorando el configurado
   * en cada destinatario. Lo usan los eventos donde el tipo es parte del
   * contrato del proceso —una baja siempre se acusa con 'atencion'— y no una
   * preferencia de quien lo recibe.
   */
  notificationType?: NotificationType;
}

interface UserIdRow {
  id: string;
}

/** Lo mínimo que necesita normalizeTarget, tanto al crear como al editar. */
interface RecipientTarget {
  recipientType: FlowRecipientType;
  employeeId?: string | null;
  permissionKey?: string | null;
}

@Injectable()
export class NotificationFlowsService {
  private readonly logger = new Logger(NotificationFlowsService.name);

  constructor(
    @InjectRepository(NotificationFlow) private readonly flowsRepo: Repository<NotificationFlow>,
    @InjectRepository(FlowRecipient) private readonly recipientsRepo: Repository<FlowRecipient>,
    @InjectRepository(EmployeeRecord) private readonly employeesRepo: Repository<EmployeeRecord>,
    // forwardRef aunque viva en el mismo módulo: NotificationsService participa
    // en los ciclos con vacaciones y gastos, así que cuando Nest construye este
    // provider todavía no lo tiene listo y llegaría undefined.
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
  ) {}

  // ==========================================================================
  // Administración
  // ==========================================================================

  async getFlows(): Promise<NotificationFlow[]> {
    const flows = await this.flowsRepo.find({
      relations: { recipients: { employee: true } },
      order: { module: 'ASC', event: 'ASC' },
    });
    for (const flow of flows) this.sortRecipients(flow);
    return flows;
  }

  async getFlowById(id: string): Promise<NotificationFlow> {
    const flow = await this.flowsRepo.findOne({
      where: { id },
      relations: { recipients: { employee: true } },
    });
    if (!flow) throw new NotFoundException('Flujo no encontrado.');
    this.sortRecipients(flow);
    return flow;
  }

  async getFlow(module: string, event: string): Promise<NotificationFlow | null> {
    const flow = await this.flowsRepo.findOne({
      where: { module, event },
      relations: { recipients: { employee: true } },
    });
    if (flow) this.sortRecipients(flow);
    return flow;
  }

  /**
   * Etiqueta con la que un usuario participa en un flujo ('TI', 'CORE'…).
   *
   * Solo resuelve destinatarios de tipo 'empleado': son los únicos que apuntan a
   * una persona concreta, que es lo que se necesita para saber en nombre de qué
   * área respondió. Devuelve null si el usuario no es destinatario del flujo o
   * si el destinatario no tiene etiqueta.
   */
  async getRecipientLabelForUser(
    module: string,
    event: string,
    userId: string,
  ): Promise<string | null> {
    const flow = await this.getFlow(module, event);
    if (!flow) return null;

    for (const recipient of flow.recipients ?? []) {
      if (recipient.recipientType !== 'empleado' || !recipient.employeeId) continue;
      const employee =
        recipient.employee ??
        (await this.employeesRepo.findOne({ where: { id: recipient.employeeId } }));
      if (employee?.authUserId === userId) return recipient.label;
    }

    return null;
  }

  async addRecipient(flowId: string, dto: CreateFlowRecipientDto): Promise<FlowRecipient> {
    const flow = await this.flowsRepo.findOne({ where: { id: flowId } });
    if (!flow) throw new NotFoundException('Flujo no encontrado.');

    const { employeeId, permissionKey } = await this.normalizeTarget(dto);

    const saved = await this.recipientsRepo.save(
      this.recipientsRepo.create({
        flowId,
        recipientType: dto.recipientType,
        employeeId,
        permissionKey,
        notificationType: dto.notificationType ?? 'informativa',
        label: dto.label ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      }),
    );

    return this.getRecipient(saved.id);
  }

  async updateRecipient(
    flowId: string,
    recipientId: string,
    dto: UpdateFlowRecipientDto,
  ): Promise<FlowRecipient> {
    const recipient = await this.getRecipient(recipientId);
    if (recipient.flowId !== flowId) {
      throw new BadRequestException('El destinatario no pertenece a este flujo.');
    }

    // El tipo puede cambiar sin reenviar el resto: se valida contra el
    // resultante, no contra el dto suelto.
    const recipientType = dto.recipientType ?? recipient.recipientType;
    const { employeeId, permissionKey } = await this.normalizeTarget({
      recipientType,
      employeeId: dto.employeeId ?? recipient.employeeId,
      permissionKey: dto.permissionKey ?? recipient.permissionKey,
    });

    recipient.recipientType = recipientType;
    recipient.employeeId = employeeId;
    recipient.permissionKey = permissionKey;
    if (dto.notificationType !== undefined) recipient.notificationType = dto.notificationType;
    if (dto.label !== undefined) recipient.label = dto.label;
    if (dto.sortOrder !== undefined) recipient.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) recipient.isActive = dto.isActive;

    await this.recipientsRepo.save(recipient);
    return this.getRecipient(recipient.id);
  }

  /** Reemplaza de golpe la lista de destinatarios de un flujo. */
  async updateRecipients(
    flowId: string,
    recipients: CreateFlowRecipientDto[],
  ): Promise<NotificationFlow> {
    const flow = await this.flowsRepo.findOne({ where: { id: flowId } });
    if (!flow) throw new NotFoundException('Flujo no encontrado.');

    // Se normaliza todo antes de borrar: si un elemento viene mal, el flujo
    // conserva su configuración anterior en vez de quedarse vacío.
    const rows = [] as FlowRecipient[];
    for (const [index, dto] of recipients.entries()) {
      const { employeeId, permissionKey } = await this.normalizeTarget(dto);
      rows.push(
        this.recipientsRepo.create({
          flowId,
          recipientType: dto.recipientType,
          employeeId,
          permissionKey,
          notificationType: dto.notificationType ?? 'informativa',
          sortOrder: dto.sortOrder ?? index,
          isActive: dto.isActive ?? true,
        }),
      );
    }

    await this.recipientsRepo.delete({ flowId });
    if (rows.length > 0) await this.recipientsRepo.save(rows);

    return this.getFlowById(flowId);
  }

  async removeRecipient(recipientId: string): Promise<void> {
    const result = await this.recipientsRepo.delete({ id: recipientId });
    if (!result.affected) throw new NotFoundException('Destinatario no encontrado.');
  }

  // ==========================================================================
  // Ejecución
  // ==========================================================================

  /**
   * Dispara el flujo `(module, event)`.
   *
   * Nunca lanza: un fallo notificando no debe tumbar la operación de negocio
   * que ya se guardó (aprobar unas vacaciones, crear un ticket). Devuelve
   * cuántas notificaciones se crearon para que el emisor lo pueda loggear.
   */
  async notify(module: string, event: string, context: NotifyContext): Promise<number> {
    try {
      const flow = await this.getFlow(module, event);
      if (!flow || !flow.isActive) return 0;

      const actorId = context.actorId ?? context.requesterId;

      // Un mismo usuario puede caer en dos reglas (es el jefe y además tiene el
      // permiso); gana la de menor sort_order y se le manda una sola.
      const resolved = new Map<string, FlowRecipient>();

      for (const recipient of flow.recipients) {
        if (!recipient.isActive) continue;

        const userIds = await this.resolveRecipient(recipient, context);
        for (const userId of userIds) {
          if (!userId) continue;
          // El actor no se autonotifica, salvo que la regla sea explícitamente
          // 'solicitante' (ahí el aviso es justamente para él).
          if (userId === actorId && recipient.recipientType !== 'solicitante') continue;
          if (!resolved.has(userId)) resolved.set(userId, recipient);
        }
      }

      let created = 0;
      for (const [userId, recipient] of resolved) {
        // Los opcionales se omiten en vez de mandarse como undefined:
        // el tsconfig usa exactOptionalPropertyTypes.
        await this.notificationsService.create({
          recipientId: userId,
          ...(context.requesterId ? { senderId: context.requesterId } : {}),
          ...(context.senderName ? { senderName: context.senderName } : {}),
          title: context.title,
          message: context.message,
          type: context.notificationType ?? recipient.notificationType,
          module,
          ...(context.entityId ? { entityId: context.entityId } : {}),
          ...(context.entityType ? { entityType: context.entityType } : {}),
          ...(context.actionUrl ? { actionUrl: context.actionUrl } : {}),
        });
        created++;
      }

      return created;
    } catch (err) {
      this.logger.error(
        `Fallo ejecutando el flujo ${module}.${event}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return 0;
    }
  }

  /** Devuelve los auth user ids a los que apunta esta regla. */
  private async resolveRecipient(
    recipient: FlowRecipient,
    context: NotifyContext,
  ): Promise<(string | null)[]> {
    switch (recipient.recipientType) {
      case 'solicitante':
        return [context.requesterId];

      case 'jefe_inmediato': {
        if (!context.requesterEmployeeId) return [];
        const employee = await this.employeesRepo.findOne({
          where: { id: context.requesterEmployeeId },
        });
        if (!employee?.directReportToId) return [];
        const manager = await this.employeesRepo.findOne({
          where: { id: employee.directReportToId },
        });
        return [manager?.authUserId ?? null];
      }

      case 'empleado': {
        if (!recipient.employeeId) return [];
        const employee = await this.employeesRepo.findOne({ where: { id: recipient.employeeId } });
        return [employee?.authUserId ?? null];
      }

      case 'permiso': {
        if (!recipient.permissionKey) return [];
        return this.getUsersByPermission(recipient.permissionKey);
      }

      default:
        return [];
    }
  }

  /**
   * Usuarios activos con un permiso, con la misma precedencia que
   * PermissionsGuard: SUPER_ADMIN pasa siempre, un override individual gana
   * sobre el rol y, si no hay override, decide el rol.
   */
  private async getUsersByPermission(permissionKey: string): Promise<string[]> {
    const parsed = this.parsePermissionKey(permissionKey);
    if (!parsed) return [];
    const { section, module, action } = parsed;

    const rows = (await this.employeesRepo.query(
      `
      SELECT u.id
      FROM auth.users u
      WHERE u.deleted_at IS NULL
        AND u.is_active = true
        AND (
          EXISTS (
            SELECT 1 FROM auth.user_roles ur
            JOIN auth.roles r ON r.id = ur.role_id
            WHERE ur.user_id = u.id AND r.name = 'SUPER_ADMIN'
          )
          OR COALESCE(
            (
              SELECT up.granted FROM auth.user_permissions up
              JOIN auth.permissions p ON p.id = up.permission_id
              WHERE up.user_id = u.id
                AND p.section = $1 AND p.module = $2 AND p.action = $3
              LIMIT 1
            ),
            EXISTS (
              SELECT 1 FROM auth.user_roles ur
              JOIN auth.role_permissions rp ON rp.role_id = ur.role_id
              JOIN auth.permissions p ON p.id = rp.permission_id
              WHERE ur.user_id = u.id
                AND p.section = $1 AND p.module = $2 AND p.action = $3
            )
          )
        )
      `,
      [section, module, action],
    )) as UserIdRow[];

    return rows.map((row) => row.id);
  }

  /**
   * 'rrhh.vacaciones.manage' → section/module/action.
   *
   * El módulo puede llevar puntos ('rrhh.empleados.vacaciones.read'), así que se
   * toma el primer segmento como sección, el último como acción y todo lo de en
   * medio como módulo.
   */
  private parsePermissionKey(
    key: string,
  ): { section: string; module: string; action: string } | null {
    const parts = key.split('.').filter(Boolean);
    if (parts.length < 3) return null;

    const section = parts[0];
    const action = parts[parts.length - 1];
    if (!section || !action) return null;

    return { section, module: parts.slice(1, -1).join('.'), action };
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private async getRecipient(id: string): Promise<FlowRecipient> {
    const recipient = await this.recipientsRepo.findOne({
      where: { id },
      relations: { employee: true },
    });
    if (!recipient) throw new NotFoundException('Destinatario no encontrado.');
    return recipient;
  }

  /**
   * Deja solo el campo que corresponde al tipo y verifica que venga.
   * Los tipos que se resuelven por contexto no guardan ninguno de los dos.
   */
  private async normalizeTarget(
    target: RecipientTarget,
  ): Promise<{ employeeId: string | null; permissionKey: string | null }> {
    if (target.recipientType === 'empleado') {
      const employeeId = target.employeeId;
      if (!employeeId) {
        throw new BadRequestException('Un destinatario de tipo empleado requiere employeeId.');
      }
      const employee = await this.employeesRepo.findOne({ where: { id: employeeId } });
      if (!employee) throw new BadRequestException('El empleado indicado no existe.');
      return { employeeId, permissionKey: null };
    }

    if (target.recipientType === 'permiso') {
      const permissionKey = target.permissionKey;
      if (!permissionKey) {
        throw new BadRequestException('Un destinatario de tipo permiso requiere permissionKey.');
      }
      if (!this.parsePermissionKey(permissionKey)) {
        throw new BadRequestException(
          'permissionKey debe tener el formato seccion.modulo.accion (ej. rrhh.vacaciones.manage).',
        );
      }
      return { employeeId: null, permissionKey };
    }

    return { employeeId: null, permissionKey: null };
  }

  private sortRecipients(flow: NotificationFlow): void {
    flow.recipients?.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }
}
