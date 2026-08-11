import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmployeesService } from './employees.service';

const MAX_LIMIT = 10;

function parseLimit(limit?: string): number {
  const parsed = limit ? Number(limit) : MAX_LIMIT;
  if (!Number.isFinite(parsed) || parsed < 1) return MAX_LIMIT;
  return Math.min(Math.trunc(parsed), MAX_LIMIT);
}

// Controlador separado (no EmployeesController) a propósito: EmployeesController
// tiene @RequirePermission('rrhh','empleados','read') a nivel de clase, que
// se hereda vía getAllAndOverride en todos sus métodos — no hay forma de
// "exceptuar" un solo endpoint dentro de esa clase. Estos endpoints solo
// necesitan JWT porque cualquier colaborador tiene que poder buscar a una
// persona (a quién asignarle un equipo, quién autoriza su reembolso) sin ver
// datos de RRHH: la respuesta se limita a identificación y puesto.
@UseGuards(JwtAuthGuard)
@Controller('employees')
export class EmployeeAssignmentSearchController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get('search-for-assignment')
  searchForAssignment(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.employeesService.searchDirectory(q ?? '', parseLimit(limit));
  }

  /** Alimenta al EmployeePicker de toda la interfaz. */
  @Get('picker')
  picker(@Query('search') search: string, @Query('limit') limit?: string) {
    return this.employeesService.searchDirectory(search ?? '', parseLimit(limit));
  }
}
