'use client';

import { EmployeeSimCards } from '@/app/(dashboard)/transformacion/sim-cards/employee-sim-cards';

/**
 * Líneas telefónicas del colaborador en su expediente, solo lectura. Usa el
 * componente compartido con Colaboradores y Responsivas; aquí el permiso es
 * `rrhh.empleados.read`, que el API de líneas acepta para esta consulta.
 */
export function SimCardsTab({ employeeId }: { employeeId: string }) {
  return <EmployeeSimCards employeeId={employeeId} />;
}
