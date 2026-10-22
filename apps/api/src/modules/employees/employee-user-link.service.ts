import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';

export interface LinkUserCandidate {
  id: string;
  name: string;
  email: string;
}

interface EmployeeLinkRow {
  id: string;
  full_name: string;
  corporate_email: string | null;
  auth_user_id: string | null;
}

/**
 * Vincula un usuario de acceso (`auth.users`) con un expediente
 * (`employees.employee_records.auth_user_id`). El vínculo no se establece solo al
 * iniciar sesión, así que RRHH lo hace desde el expediente.
 *
 * Reglas: solo si el expediente no está vinculado; solo usuarios activos cuyo
 * correo coincide EXACTAMENTE (sin distinguir mayúsculas) con el correo
 * corporativo del expediente; y un usuario no puede quedar ligado a dos
 * expedientes. No hay búsqueda libre de usuarios.
 */
@Injectable()
export class EmployeeUserLinkService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  private async loadEmployee(m: { query: DataSource['query'] }, id: string, lock: boolean): Promise<EmployeeLinkRow> {
    const rows = (await m.query(
      `SELECT id, full_name, corporate_email, auth_user_id
       FROM employees.employee_records
       WHERE id = $1 AND deleted_at IS NULL ${lock ? 'FOR UPDATE' : ''}`,
      [id],
    )) as EmployeeLinkRow[];
    const row = rows[0];
    if (!row) throw new NotFoundException('Expediente no encontrado');
    return row;
  }

  /** Usuarios que se podrían vincular: mismo correo, activos y sin otro expediente. */
  async getCandidates(employeeId: string): Promise<LinkUserCandidate[]> {
    const employee = await this.loadEmployee(this.dataSource, employeeId, false);
    if (employee.auth_user_id || !employee.corporate_email) return [];

    return (await this.dataSource.query(
      `SELECT u.id, u.name, u.email
       FROM auth.users u
       WHERE lower(u.email) = lower($1)
         AND u.is_active = true
         AND u.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM employees.employee_records e
           WHERE e.auth_user_id = u.id AND e.deleted_at IS NULL
         )
       ORDER BY u.email`,
      [employee.corporate_email],
    )) as LinkUserCandidate[];
  }

  /** Vincula en una transacción; todo se revalida en el servidor. */
  async link(
    employeeId: string,
    authUserId: string,
    actor?: { id?: string; email?: string; name?: string },
  ): Promise<{ id: string; authUserId: string }> {
    const result = await this.dataSource.transaction(async (m) => {
      // El mismo usuario no puede vincularse a dos expedientes a la vez: se serializa por usuario.
      await m.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [authUserId]);

      const employee = await this.loadEmployee(m, employeeId, true);
      if (employee.auth_user_id) {
        throw new ConflictException('Este expediente ya tiene un usuario vinculado.');
      }
      if (!employee.corporate_email) {
        throw new BadRequestException('El expediente no tiene correo corporativo para comparar.');
      }

      const users = (await m.query(
        `SELECT id, name, email, is_active FROM auth.users WHERE id = $1 AND deleted_at IS NULL`,
        [authUserId],
      )) as { id: string; name: string; email: string; is_active: boolean }[];
      const user = users[0];
      if (!user || !user.is_active) throw new NotFoundException('Usuario no encontrado o inactivo');
      if (user.email.toLowerCase() !== employee.corporate_email.toLowerCase()) {
        throw new BadRequestException('El correo del usuario no coincide con el correo corporativo del expediente.');
      }

      const taken = (await m.query(
        `SELECT full_name FROM employees.employee_records WHERE auth_user_id = $1 AND deleted_at IS NULL LIMIT 1`,
        [authUserId],
      )) as { full_name: string }[];
      if (taken.length > 0) {
        throw new ConflictException(`Ese usuario ya está vinculado al expediente de ${taken[0]!.full_name}.`);
      }

      await m.query(
        `UPDATE employees.employee_records SET auth_user_id = $1, updated_at = NOW() WHERE id = $2`,
        [authUserId, employeeId],
      );
      return { id: employeeId, authUserId, employeeName: employee.full_name, userEmail: user.email };
    });

    // El interceptor global no cubre esta ruta (su módulo es 'employees', no 'empleados'),
    // así que la traza del vínculo se registra aquí, explícita.
    await this.audit.logActivity({
      userId: actor?.id ?? null,
      userEmail: actor?.email ?? null,
      userName: actor?.name ?? null,
      action: 'link-user',
      module: 'empleados',
      entityType: 'employee',
      entityId: employeeId,
      entityName: result.employeeName,
      changes: { authUserId: { from: null, to: authUserId }, userEmail: result.userEmail },
    });
    return { id: employeeId, authUserId };
  }
}
