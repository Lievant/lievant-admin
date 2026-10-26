import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { VacationsService } from '../vacations/vacations.service';
import { NOT_LEADER_CODE, NOT_LEADER_MESSAGE, NOT_LINKED_CODE, NOT_LINKED_MESSAGE } from './job-requisitions.util';

export interface Leader {
  userId: string;
  employeeId: string;
  fullName: string;
  area: string | null;
}

/**
 * ¿Quién es líder? Se reutiliza la lógica de Gestión de Vacaciones
 * (`VacationsService.isTeamManager`: al menos un subordinado activo directo,
 * sin contarse a sí mismo). Aquí solo se agrega que el líder sea un empleado
 * activo vinculado al usuario y se distinguen los dos mensajes de rechazo.
 */
@Injectable()
export class RequisitionLeaderService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly vacations: VacationsService,
  ) {}

  async resolve(userId: string): Promise<Leader> {
    const rows = (await this.dataSource.query(
      `SELECT id, full_name, area, status FROM employees.employee_records
       WHERE auth_user_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [userId],
    )) as { id: string; full_name: string; area: string | null; status: string }[];
    const employee = rows[0];
    if (!employee) {
      throw new ForbiddenException({ statusCode: 403, code: NOT_LINKED_CODE, message: NOT_LINKED_MESSAGE });
    }
    const { isManager } = await this.vacations.isTeamManager(userId);
    if (!isManager || employee.status !== 'active') {
      throw new ForbiddenException({ statusCode: 403, code: NOT_LEADER_CODE, message: NOT_LEADER_MESSAGE });
    }
    return { userId, employeeId: employee.id, fullName: employee.full_name, area: employee.area };
  }
}
