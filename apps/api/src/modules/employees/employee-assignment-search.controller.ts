import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmployeesService } from './employees.service';

// Controlador separado (no EmployeesController) a propósito: EmployeesController
// tiene @RequirePermission('rrhh','empleados','read') a nivel de clase, que
// se hereda vía getAllAndOverride en todos sus métodos — no hay forma de
// "exceptuar" un solo endpoint dentro de esa clase. Este endpoint solo
// necesita JWT porque lo usa cualquier colaborador con permiso de inventario
// para buscar a quién asignarle un equipo, no requiere ver datos de RRHH.
@UseGuards(JwtAuthGuard)
@Controller('employees')
export class EmployeeAssignmentSearchController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get('search-for-assignment')
  searchForAssignment(@Query('q') q: string, @Query('limit') limit?: string) {
    const parsedLimit = limit ? Number(limit) : 10;
    return this.employeesService.searchForAssignment(q ?? '', Number.isFinite(parsedLimit) ? parsedLimit : 10);
  }
}
