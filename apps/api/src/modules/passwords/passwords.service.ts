import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { EmployeeStatus } from '../employees/constants/employee-status.constant';
import { AuditService } from '../audit/audit.service';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import { NotificationFlowsService } from '../notifications/notification-flows.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateAccountPasswordDto,
  CreatePasswordApplicationDto,
  QueryPasswordsDto,
  UpdateAccountPasswordDto,
  UpdatePasswordApplicationDto,
} from './dto/password.dto';
import { PasswordApplication } from './entities/password-application.entity';

/** Máximo de contraseñas que un usuario puede ver o copiar por hora. */
const REVEAL_LIMIT_PER_HOUR = 10;

/** Días de anticipación con que se avisa al líder. */
const EXPIRY_NOTICE_DAYS = 3;

// "Hoy" es el de México, no el del contenedor (UTC): una cuenta que vence hoy
// no debe marcarse vencida a las 18:00 hora local.
const TODAY_MX = `(NOW() AT TIME ZONE 'America/Mexico_City')::date`;

// El estado se deriva además de leerse: si el cron aún no corrió, una cuenta
// con vencimiento pasado ya debe mostrarse vencida.
const EFFECTIVE_STATUS = `
  CASE
    WHEN ap.deleted_at IS NOT NULL OR ap.status = 'revocada' THEN 'revocada'
    WHEN ap.status = 'vencida'
      OR (ap.expiry_date IS NOT NULL AND ap.expiry_date < ${TODAY_MX}) THEN 'vencida'
    ELSE 'activa'
  END`;

interface PasswordRow {
  id: string;
  record_number: number;
  username: string;
  assigned_date: string;
  expiry_date: string | null;
  status: 'activa' | 'revocada' | 'vencida';
  notes: string | null;
  manager_id: string;
  manager_name: string | null;
  application_id: string;
  application_name: string;
  application_category: string | null;
  employee_id: string;
  employee_name: string;
  employee_area: string | null;
  employee_position: string;
}

/** Lo mínimo para decidir permisos sobre un registro. */
interface AccessRow {
  id: string;
  manager_id: string;
  employee_id: string;
  employee_manager_id: string | null;
  deleted_at: Date | null;
  expiry_date: string | null;
}

interface ExpiringRow {
  id: string;
  expiry_date: string;
  employee_id: string;
  employee_name: string;
  employee_user_id: string | null;
  manager_user_id: string | null;
  application_name: string;
}

@Injectable()
export class PasswordsService {
  private readonly logger = new Logger(PasswordsService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @InjectRepository(PasswordApplication)
    private readonly applicationsRepo: Repository<PasswordApplication>,
    @InjectRepository(EmployeeRecord) private readonly employeesRepo: Repository<EmployeeRecord>,
    private readonly config: ConfigService,
    private readonly auditService: AuditService,
    private readonly notifications: NotificationsService,
    private readonly flows: NotificationFlowsService,
  ) {}

  // ==========================================================================
  // Catálogo de aplicaciones
  // ==========================================================================

  listApplications() {
    return this.applicationsRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async createApplication(dto: CreatePasswordApplicationDto) {
    const name = dto.name.trim();
    await this.assertApplicationNameFree(name);
    return this.applicationsRepo.save(
      this.applicationsRepo.create({
        name,
        category: dto.category?.trim() || null,
        // Las altas desde el modal van antes de "Otra" (99) pero después de
        // las sembradas.
        sortOrder: dto.sortOrder ?? 50,
      }),
    );
  }

  async updateApplication(id: string, dto: UpdatePasswordApplicationDto) {
    const app = await this.applicationsRepo.findOne({ where: { id } });
    if (!app) throw new NotFoundException('Aplicación no encontrada');

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      await this.assertApplicationNameFree(name, id);
      app.name = name;
    }
    if (dto.category !== undefined) app.category = dto.category.trim() || null;
    if (dto.sortOrder !== undefined) app.sortOrder = dto.sortOrder;
    return this.applicationsRepo.save(app);
  }

  async deactivateApplication(id: string): Promise<void> {
    const result = await this.applicationsRepo.update({ id }, { isActive: false });
    if (!result.affected) throw new NotFoundException('Aplicación no encontrada');
  }

  /** "Canva" y "canva" son la misma aplicación: el catálogo es homologado. */
  private async assertApplicationNameFree(name: string, exceptId?: string): Promise<void> {
    const qb = this.applicationsRepo
      .createQueryBuilder('a')
      .where('LOWER(a.name) = LOWER(:name)', { name });
    if (exceptId) qb.andWhere('a.id != :exceptId', { exceptId });
    const existing = await qb.getOne();
    if (existing) {
      throw new ConflictException(
        existing.isActive
          ? `La aplicación "${existing.name}" ya existe en el catálogo`
          : `La aplicación "${existing.name}" existe pero está desactivada; reactívala en Catálogos`,
      );
    }
  }

  // ==========================================================================
  // Equipo
  // ==========================================================================

  /** Mismo criterio que /vacations/team/is-manager: colaboradores activos que le reportan. */
  async isManager(userId: string): Promise<{ isManager: boolean }> {
    const me = await this.employeesRepo.findOne({ where: { authUserId: userId } });
    if (!me) return { isManager: false };
    const count = await this.teamQuery(me.id).getCount();
    return { isManager: count > 0 };
  }

  async getTeamEmployees(userId: string) {
    const me = await this.employeesRepo.findOne({ where: { authUserId: userId } });
    if (!me) return [];
    const team = await this.teamQuery(me.id).orderBy('emp.full_name', 'ASC').getMany();
    return team.map((e) => ({
      id: e.id,
      fullName: e.fullName,
      position: e.position,
      area: e.area,
      corporateEmail: e.corporateEmail,
    }));
  }

  private teamQuery(managerEmployeeId: string) {
    return this.employeesRepo
      .createQueryBuilder('emp')
      .where('emp.direct_report_to_id = :managerId', { managerId: managerEmployeeId })
      // Un expediente que se apunta a sí mismo como jefe no es un equipo.
      .andWhere('emp.id != :managerId', { managerId: managerEmployeeId })
      .andWhere('emp.status = :status', { status: EmployeeStatus.ACTIVE })
      .andWhere('emp.deleted_at IS NULL');
  }

  // ==========================================================================
  // Contraseñas
  // ==========================================================================

  /**
   * Cuentas de los colaboradores que reportan directamente a quien llama.
   * Nunca selecciona password_encrypted.
   */
  async list(user: User, query: QueryPasswordsDto) {
    const me = await this.employeesRepo.findOne({ where: { authUserId: user.id } });
    if (!me) return [];

    const params: unknown[] = [me.id];
    const where = ['e.direct_report_to_id = $1', 'e.id != $1'];

    if (query.employeeId) {
      params.push(query.employeeId);
      where.push(`ap.employee_id = $${params.length}`);
    }
    if (query.applicationId) {
      params.push(query.applicationId);
      where.push(`ap.application_id = $${params.length}`);
    }
    if (query.status === 'por_vencer') {
      where.push(
        `(${EFFECTIVE_STATUS}) = 'activa'`,
        `ap.expiry_date IS NOT NULL`,
        `ap.expiry_date <= ${TODAY_MX} + 30`,
      );
    } else if (query.status) {
      params.push(query.status);
      where.push(`(${EFFECTIVE_STATUS}) = $${params.length}`);
    }

    const rows = await this.fetchRows(where.join(' AND '), params);
    return rows.map((r) => this.toDto(r));
  }

  async create(user: User, dto: CreateAccountPasswordDto) {
    const me = await this.requireEmployee(user.id);
    await this.assertDirectReport(me.id, dto.employeeId);
    await this.assertActiveApplication(dto.applicationId);
    const key = this.encryptionKey();

    const [inserted] = (await this.db.query(
      `
      INSERT INTO passwords.account_passwords
        (application_id, employee_id, manager_id, username, password_encrypted,
         assigned_date, expiry_date, notes, created_by, updated_by)
      VALUES
        ($1, $2, $3, $4, pgp_sym_encrypt($5, $6, 'cipher-algo=aes256'),
         COALESCE($7::date, ${TODAY_MX}), $8::date, $9, $10, $10)
      RETURNING id
      `,
      [
        dto.applicationId,
        dto.employeeId,
        me.id,
        dto.username.trim(),
        dto.password,
        key,
        dto.assignedDate ?? null,
        dto.expiryDate ?? null,
        dto.notes?.trim() || null,
        user.id,
      ],
    )) as { id: string }[];

    return this.getOne(inserted!.id);
  }

  async update(user: User, id: string, dto: UpdateAccountPasswordDto) {
    const row = await this.getAccessRow(id);
    if (row.deleted_at) throw new BadRequestException('La cuenta está revocada y no se puede editar');
    const me = await this.assertCanManage(user, row);

    const params: unknown[] = [];
    const sets: string[] = [];
    const push = (sql: string, value: unknown) => {
      params.push(value);
      sets.push(sql.replace('?', `$${params.length}`));
    };

    if (dto.employeeId !== undefined && dto.employeeId !== row.employee_id) {
      // SUPER_ADMIN sin expediente no tiene "equipo" contra el cual validar;
      // basta con que el colaborador exista.
      if (me) await this.assertDirectReport(me.id, dto.employeeId);
      else await this.assertEmployeeExists(dto.employeeId);
      push('employee_id = ?', dto.employeeId);
    }
    if (dto.applicationId !== undefined) {
      await this.assertActiveApplication(dto.applicationId);
      push('application_id = ?', dto.applicationId);
    }
    if (dto.username !== undefined) push('username = ?', dto.username.trim());
    if (dto.password) {
      const key = this.encryptionKey();
      params.push(dto.password, key);
      sets.push(
        `password_encrypted = pgp_sym_encrypt($${params.length - 1}, $${params.length}, 'cipher-algo=aes256')`,
      );
    }
    if (dto.assignedDate !== undefined) push('assigned_date = ?::date', dto.assignedDate);
    if (dto.expiryDate !== undefined && dto.expiryDate !== row.expiry_date) {
      // Nueva fecha, nuevo aviso: y si la fecha es futura la cuenta revive.
      push('expiry_date = ?::date', dto.expiryDate);
      const p = `$${params.length}::date`;
      sets.push(
        'expiry_notified_at = NULL',
        `status = CASE WHEN ${p} IS NULL OR ${p} >= ${TODAY_MX} THEN 'activa' ELSE 'vencida' END`,
      );
    }
    if (dto.notes !== undefined) push('notes = ?', dto.notes?.trim() || null);

    if (sets.length > 0) {
      push('updated_by = ?', user.id);
      params.push(id);
      await this.db.query(
        `UPDATE passwords.account_passwords SET ${sets.join(', ')}, updated_at = NOW()
         WHERE id = $${params.length}`,
        params,
      );
    }

    return this.getOne(id);
  }

  async revoke(user: User, id: string): Promise<void> {
    const row = await this.getAccessRow(id);
    if (row.deleted_at) return;
    await this.assertCanManage(user, row);
    await this.db.query(
      `UPDATE passwords.account_passwords
       SET status = 'revocada', deleted_at = NOW(), updated_by = $2, updated_at = NOW()
       WHERE id = $1`,
      [id, user.id],
    );
  }

  /**
   * Descifra una contraseña. Cada llamada queda en passwords.reveal_log, y ese
   * mismo registro es el contador del límite por hora.
   */
  async reveal(
    user: User,
    id: string,
    action: 'ver' | 'copiar',
    ipAddress: string | null,
  ): Promise<{ password: string }> {
    const row = await this.getAccessRow(id);
    if (row.deleted_at) throw new BadRequestException('La cuenta está revocada');
    await this.assertCanView(user, row);
    const key = this.encryptionKey();

    const [{ count }] = (await this.db.query(
      `SELECT COUNT(*)::int AS count FROM passwords.reveal_log
       WHERE user_id = $1 AND revealed_at > NOW() - INTERVAL '1 hour'`,
      [user.id],
    )) as [{ count: number }];
    if (count >= REVEAL_LIMIT_PER_HOUR) {
      throw new HttpException(
        `Alcanzaste el límite de ${REVEAL_LIMIT_PER_HOUR} consultas de contraseña por hora. Intenta más tarde.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.db.query(
      `INSERT INTO passwords.reveal_log (account_password_id, user_id, action, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [id, user.id, action, ipAddress?.slice(0, 64) ?? null],
    );

    try {
      const [result] = (await this.db.query(
        `SELECT pgp_sym_decrypt(password_encrypted, $2) AS password
         FROM passwords.account_passwords WHERE id = $1`,
        [id, key],
      )) as [{ password: string }];

      // El módulo ya tenía su propia bitácora en passwords.reveal_log, que es
      // la que impone el límite por hora. Este registro es distinto: alimenta
      // el tab de Seguridad del log central, donde se revisa junto con los
      // accesos denegados y los intentos de login.
      await this.auditService.logSecurity({
        eventType: 'password_reveal',
        userId: user.id,
        userEmail: user.email,
        ipAddress,
        severity: 'warning',
        module: 'passwords',
        resourceId: id,
        details: { action, employeeId: row.employee_id },
      });

      return { password: result.password };
    } catch (err) {
      // Llave equivocada o dato corrupto. No se reenvía el error de Postgres:
      // podría incluir fragmentos del parámetro.
      this.logger.error(`No se pudo descifrar la contraseña ${id}: ${(err as Error).message}`);
      throw new ServiceUnavailableException('No se pudo descifrar la contraseña');
    }
  }

  async getAuditLog(user: User) {
    if (!this.isSuperAdmin(user)) {
      throw new ForbiddenException('Solo SUPER_ADMIN puede consultar la bitácora de contraseñas');
    }
    const rows = (await this.db.query(`
      SELECT l.id, l.action, l.ip_address, l.revealed_at,
             u.name AS user_name, u.email AS user_email,
             ap.record_number, ap.username,
             a.name AS application_name, e.full_name AS employee_name
      FROM passwords.reveal_log l
      JOIN auth.users u ON u.id = l.user_id
      JOIN passwords.account_passwords ap ON ap.id = l.account_password_id
      JOIN passwords.applications a ON a.id = ap.application_id
      JOIN employees.employee_records e ON e.id = ap.employee_id
      ORDER BY l.revealed_at DESC
      LIMIT 500
    `)) as {
      id: string;
      action: string;
      ip_address: string | null;
      revealed_at: Date;
      user_name: string;
      user_email: string;
      record_number: number;
      username: string;
      application_name: string;
      employee_name: string;
    }[];

    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      ipAddress: r.ip_address,
      revealedAt: r.revealed_at,
      user: { name: r.user_name, email: r.user_email },
      recordNumber: r.record_number,
      username: r.username,
      applicationName: r.application_name,
      employeeName: r.employee_name,
    }));
  }

  // ==========================================================================
  // Cron de vencimientos
  // ==========================================================================

  /**
   * 8:00 hora de México. Primero marca vencidas; luego reclama con un UPDATE …
   * RETURNING las cuentas por vencer aún sin aviso. El reclamo atómico importa:
   * con dos tasks de ECS el cron corre dos veces y sin él cada líder recibiría
   * el aviso duplicado.
   */
  @Cron('0 8 * * *', { timeZone: 'America/Mexico_City' })
  async checkExpirations(): Promise<void> {
    try {
      await this.db.query(`
        UPDATE passwords.account_passwords
        SET status = 'vencida', updated_at = NOW()
        WHERE status = 'activa' AND deleted_at IS NULL
          AND expiry_date IS NOT NULL AND expiry_date < ${TODAY_MX}
      `);

      // Rango y no igualdad con hoy+3: una cuenta creada con dos días de
      // vigencia, o un día sin cron, también deben avisarse.
      // WITH … SELECT: TypeORM devuelve las filas directo, no el par [filas, n].
      const claimed = (await this.db.query(
        `
        WITH claimed AS (
          UPDATE passwords.account_passwords
          SET expiry_notified_at = NOW()
          WHERE status = 'activa' AND deleted_at IS NULL AND expiry_notified_at IS NULL
            AND expiry_date BETWEEN ${TODAY_MX} AND ${TODAY_MX} + $1::int
          RETURNING id, expiry_date, employee_id, manager_id, application_id
        )
        SELECT c.id, c.expiry_date::text AS expiry_date, c.employee_id,
               e.full_name AS employee_name, e.auth_user_id AS employee_user_id,
               m.auth_user_id AS manager_user_id, a.name AS application_name
        FROM claimed c
        JOIN employees.employee_records e ON e.id = c.employee_id
        JOIN employees.employee_records m ON m.id = c.manager_id
        JOIN passwords.applications a ON a.id = c.application_id
        `,
        [EXPIRY_NOTICE_DAYS],
      )) as ExpiringRow[];

      for (const row of claimed) await this.notifyExpiring(row);
      if (claimed.length > 0) {
        this.logger.log(`Avisos de contraseñas por vencer enviados: ${claimed.length}`);
      }
    } catch (err) {
      this.logger.error(`Fallo revisando vencimientos de contraseñas: ${(err as Error).message}`);
    }
  }

  private async notifyExpiring(row: ExpiringRow): Promise<void> {
    const title = `Contraseña por vencer — ${row.application_name}`;
    const message =
      `La cuenta de ${row.employee_name} en ${row.application_name} vence el ${formatDateMx(row.expiry_date)}. ` +
      'Por favor verifica si debe renovarse o revocarse.';
    const actionUrl = '/herramientas/passwords';

    if (row.manager_user_id) {
      await this.notifications.create({
        recipientId: row.manager_user_id,
        title,
        message,
        type: 'atencion',
        module: 'passwords',
        entityId: row.id,
        entityType: 'account_password',
        actionUrl,
      });
    }

    // Copias configurables. El líder va como actor para que el flujo no le
    // mande un segundo aviso si además cae en alguna regla.
    await this.flows.notify('passwords', 'cuenta_por_vencer', {
      requesterId: row.employee_user_id,
      requesterEmployeeId: row.employee_id,
      actorId: row.manager_user_id,
      entityId: row.id,
      entityType: 'account_password',
      title,
      message,
      actionUrl,
      notificationType: 'atencion',
    });
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private async fetchRows(where: string, params: unknown[]): Promise<PasswordRow[]> {
    return (await this.db.query(
      `
      SELECT ap.id, ap.record_number, ap.username,
             ap.assigned_date::text AS assigned_date, ap.expiry_date::text AS expiry_date,
             ${EFFECTIVE_STATUS} AS status,
             ap.notes, ap.manager_id, m.full_name AS manager_name,
             a.id AS application_id, a.name AS application_name, a.category AS application_category,
             e.id AS employee_id, e.full_name AS employee_name, e.area AS employee_area,
             e.position AS employee_position
      FROM passwords.account_passwords ap
      JOIN passwords.applications a ON a.id = ap.application_id
      JOIN employees.employee_records e ON e.id = ap.employee_id
      LEFT JOIN employees.employee_records m ON m.id = ap.manager_id
      WHERE ${where}
      ORDER BY ap.record_number DESC
      `,
      params,
    )) as PasswordRow[];
  }

  private async getOne(id: string) {
    const [row] = await this.fetchRows('ap.id = $1', [id]);
    if (!row) throw new NotFoundException('Registro no encontrado');
    return this.toDto(row);
  }

  private toDto(r: PasswordRow) {
    return {
      id: r.id,
      recordNumber: r.record_number,
      application: { id: r.application_id, name: r.application_name, category: r.application_category },
      employee: {
        id: r.employee_id,
        fullName: r.employee_name,
        area: r.employee_area,
        position: r.employee_position,
      },
      username: r.username,
      assignedDate: r.assigned_date,
      expiryDate: r.expiry_date,
      status: r.status,
      notes: r.notes,
      managerId: r.manager_id,
      managerName: r.manager_name,
    };
  }

  private async getAccessRow(id: string): Promise<AccessRow> {
    const [row] = (await this.db.query(
      `SELECT ap.id, ap.manager_id, ap.employee_id, ap.deleted_at,
              ap.expiry_date::text AS expiry_date,
              e.direct_report_to_id AS employee_manager_id
       FROM passwords.account_passwords ap
       JOIN employees.employee_records e ON e.id = ap.employee_id
       WHERE ap.id = $1`,
      [id],
    )) as AccessRow[];
    if (!row) throw new NotFoundException('Registro no encontrado');
    return row;
  }

  /** Ve la contraseña: el jefe actual del colaborador, el líder que la asignó o SUPER_ADMIN. */
  private async assertCanView(user: User, row: AccessRow): Promise<void> {
    if (this.isSuperAdmin(user)) return;
    const me = await this.employeesRepo.findOne({ where: { authUserId: user.id } });
    if (me && (row.employee_manager_id === me.id || row.manager_id === me.id)) return;
    throw new ForbiddenException('Esta cuenta no pertenece a tu equipo');
  }

  /**
   * Edita o revoca: mismo alcance que ver. Devuelve el expediente de quien
   * llama (null para un SUPER_ADMIN sin expediente).
   */
  private async assertCanManage(user: User, row: AccessRow): Promise<EmployeeRecord | null> {
    const me = await this.employeesRepo.findOne({ where: { authUserId: user.id } });
    if (this.isSuperAdmin(user)) return me;
    if (me && (row.manager_id === me.id || row.employee_manager_id === me.id)) return me;
    throw new ForbiddenException('Solo el líder asignado puede modificar esta cuenta');
  }

  private async requireEmployee(userId: string): Promise<EmployeeRecord> {
    const me = await this.employeesRepo.findOne({ where: { authUserId: userId } });
    if (!me) throw new ForbiddenException('Tu usuario no está vinculado a un expediente de empleado');
    return me;
  }

  private async assertDirectReport(managerEmployeeId: string, employeeId: string): Promise<void> {
    const count = await this.teamQuery(managerEmployeeId)
      .andWhere('emp.id = :employeeId', { employeeId })
      .getCount();
    if (count === 0) {
      throw new ForbiddenException('Solo puedes asignar cuentas a colaboradores que te reportan directamente');
    }
  }

  private async assertEmployeeExists(employeeId: string): Promise<void> {
    const exists = await this.employeesRepo.exists({ where: { id: employeeId } });
    if (!exists) throw new BadRequestException('Colaborador no encontrado');
  }

  private async assertActiveApplication(applicationId: string): Promise<void> {
    const exists = await this.applicationsRepo.exists({ where: { id: applicationId, isActive: true } });
    if (!exists) throw new BadRequestException('La aplicación no existe o está desactivada');
  }

  /**
   * La llave se valida al usarla, no al arrancar: un entorno sin el secreto
   * (prod antes de configurarlo) debe levantar la API igual y solo fallar en
   * este módulo.
   */
  private encryptionKey(): string {
    const key = this.config.get<string>('PASSWORDS_ENCRYPTION_KEY');
    if (!key || key.length < 32) {
      throw new ServiceUnavailableException('El cifrado de contraseñas no está configurado en este entorno');
    }
    return key;
  }

  private isSuperAdmin(user: User): boolean {
    return user.roles?.some((r) => r.name === 'SUPER_ADMIN') ?? false;
  }
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatDateMx(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}
