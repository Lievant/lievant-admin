import { IsString, IsUUID } from 'class-validator';

export class EscalateTicketDto {
  /**
   * Id del expediente (employees.employee_records), no del usuario: es lo que
   * devuelve el buscador de empleados. El servicio lo traduce a auth.users.
   */
  @IsUUID()
  escalateToEmployeeId!: string;

  @IsString()
  reason!: string;
}
