import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import { EmployeeStatus } from '../employees/constants/employee-status.constant';
import { CreateToolDto, UpdateToolDto } from './dto/tool-catalog.dto';
import { QueryLicensesDto } from './dto/query-licenses.dto';
import { UpsertLicensesDto } from './dto/upsert-licenses.dto';
import { EmployeeLicense } from './entities/employee-license.entity';
import { ToolAssignment } from './entities/tool-assignment.entity';
import { ToolCatalog } from './entities/tool-catalog.entity';

interface EmployeeRow {
  employee_id: string;
  display_id: string;
  full_name: string;
  corporate_email: string | null;
  area: string | null;
  division: string | null;
  location: string | null;
  employee_license_id: string | null;
  active_directory_name: string | null;
  responsiva: string | null;
}

@Injectable()
export class LicensesService {
  constructor(
    @InjectRepository(EmployeeRecord) private readonly employeesRepo: Repository<EmployeeRecord>,
    @InjectRepository(EmployeeLicense) private readonly licensesRepo: Repository<EmployeeLicense>,
    @InjectRepository(ToolAssignment) private readonly assignmentsRepo: Repository<ToolAssignment>,
    @InjectRepository(ToolCatalog) private readonly toolsRepo: Repository<ToolCatalog>,
  ) {}

  // -------------------------------------------------------------------------
  // Catálogo de herramientas
  // -------------------------------------------------------------------------

  getTools() {
    return this.toolsRepo.find({ where: { isActive: true }, order: { sortOrder: 'ASC' } });
  }

  async createTool(dto: CreateToolDto) {
    const tool = this.toolsRepo.create({
      name: dto.name,
      description: dto.description ?? null,
      category: dto.category ?? 'software',
      icon: dto.icon ?? 'ti-app',
      color: dto.color ?? '#666666',
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.toolsRepo.save(tool);
  }

  async updateTool(id: string, dto: UpdateToolDto) {
    const tool = await this.toolsRepo.findOne({ where: { id } });
    if (!tool) throw new NotFoundException(`Herramienta ${id} no encontrada`);

    Object.assign(tool, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.category !== undefined && { category: dto.category }),
      ...(dto.icon !== undefined && { icon: dto.icon }),
      ...(dto.color !== undefined && { color: dto.color }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
    });

    return this.toolsRepo.save(tool);
  }

  // -------------------------------------------------------------------------
  // Lista de empleados con licencias
  // -------------------------------------------------------------------------

  async findAll(query: QueryLicensesDto) {
    const tools = await this.getTools();

    const params: unknown[] = [];
    const conditions: string[] = [`emp.deleted_at IS NULL`, `emp.status = $${params.push(EmployeeStatus.ACTIVE)}`];

    if (query.search) {
      const p = params.push(`%${query.search}%`);
      conditions.push(`(emp.full_name ILIKE $${p} OR emp.corporate_email ILIKE $${p})`);
    }
    if (query.department) {
      conditions.push(`emp.area = $${params.push(query.department)}`);
    }
    if (query.division) {
      conditions.push(`emp.division = $${params.push(query.division)}`);
    }
    if (query.location) {
      conditions.push(`emp.location = $${params.push(query.location)}`);
    }
    if (query.tool) {
      const toolParam = params.push(query.tool);
      if (query.hasAccess !== undefined) {
        const accessParam = params.push(query.hasAccess);
        conditions.push(
          `EXISTS (SELECT 1 FROM licenses.tool_assignments ta WHERE ta.employee_license_id = el.id AND ta.tool_id = $${toolParam} AND ta.has_access = $${accessParam})`,
        );
      } else {
        conditions.push(
          `EXISTS (SELECT 1 FROM licenses.tool_assignments ta WHERE ta.employee_license_id = el.id AND ta.tool_id = $${toolParam} AND ta.has_access = true)`,
        );
      }
    } else if (query.hasAccess !== undefined) {
      conditions.push(
        `${query.hasAccess ? 'EXISTS' : 'NOT EXISTS'} (SELECT 1 FROM licenses.tool_assignments ta WHERE ta.employee_license_id = el.id AND ta.has_access = true)`,
      );
    }

    const rows = await this.employeesRepo.manager.query<EmployeeRow[]>(
      `
      SELECT
        emp.id AS employee_id,
        emp.display_id,
        emp.full_name,
        emp.corporate_email,
        emp.area,
        emp.division,
        emp.location,
        el.id AS employee_license_id,
        el.active_directory_name,
        el.responsiva
      FROM employees.employee_records emp
      LEFT JOIN licenses.employee_licenses el ON el.employee_id = emp.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY emp.full_name ASC
      `,
      params,
    );

    const licenseIds = rows.map((r) => r.employee_license_id).filter((id): id is string => id !== null);
    const assignments = licenseIds.length
      ? await this.assignmentsRepo.find({ where: { employeeLicenseId: In(licenseIds) }, relations: ['tool'] })
      : [];

    const assignmentsByLicense = new Map<string, ToolAssignment[]>();
    for (const a of assignments) {
      const list = assignmentsByLicense.get(a.employeeLicenseId) ?? [];
      list.push(a);
      assignmentsByLicense.set(a.employeeLicenseId, list);
    }

    return rows.map((row) => {
      const licenseAssignments = row.employee_license_id
        ? (assignmentsByLicense.get(row.employee_license_id) ?? [])
        : [];

      return {
        employeeId: row.employee_id,
        displayId: row.display_id,
        fullName: row.full_name,
        corporateEmail: row.corporate_email,
        area: row.area,
        division: row.division,
        location: row.location,
        photoUrl: row.corporate_email ? `/api/users/${encodeURIComponent(row.corporate_email)}/photo` : null,
        activeDirectoryName: row.active_directory_name,
        responsiva: row.responsiva,
        tools: tools.map((tool) => {
          const assignment = licenseAssignments.find((a) => a.toolId === tool.id);
          return {
            toolId: tool.id,
            toolName: tool.name,
            hasAccess: assignment?.hasAccess ?? false,
            isAdmin: assignment?.isAdmin ?? false,
          };
        }),
      };
    });
  }

  // -------------------------------------------------------------------------
  // Detalle por empleado
  // -------------------------------------------------------------------------

  async findByEmployee(employeeId: string) {
    const employee = await this.employeesRepo.findOne({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException(`Empleado ${employeeId} no encontrado`);

    const tools = await this.getTools();
    const license = await this.licensesRepo.findOne({ where: { employeeId } });

    const assignments = license
      ? await this.assignmentsRepo.find({ where: { employeeLicenseId: license.id }, relations: ['tool'] })
      : [];

    return {
      employeeId: employee.id,
      displayId: employee.displayId,
      fullName: employee.fullName,
      corporateEmail: employee.corporateEmail,
      position: employee.position,
      area: employee.area,
      division: employee.division,
      location: employee.location,
      photoUrl: employee.corporateEmail
        ? `/api/users/${encodeURIComponent(employee.corporateEmail)}/photo`
        : null,
      activeDirectoryName: license?.activeDirectoryName ?? null,
      responsiva: license?.responsiva ?? null,
      notes: license?.notes ?? null,
      tools: tools.map((tool) => {
        const assignment = assignments.find((a) => a.toolId === tool.id);
        return {
          toolId: tool.id,
          toolName: tool.name,
          category: tool.category,
          icon: tool.icon,
          color: tool.color,
          hasAccess: assignment?.hasAccess ?? false,
          isAdmin: assignment?.isAdmin ?? false,
          grantedAt: assignment?.grantedAt ?? null,
          revokedAt: assignment?.revokedAt ?? null,
        };
      }),
    };
  }

  // -------------------------------------------------------------------------
  // Crear / actualizar licencias de un empleado
  // -------------------------------------------------------------------------

  async upsertLicenses(employeeId: string, dto: UpsertLicensesDto, userId: string) {
    const employee = await this.employeesRepo.findOne({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException(`Empleado ${employeeId} no encontrado`);

    let license = await this.licensesRepo.findOne({ where: { employeeId } });

    if (!license) {
      license = this.licensesRepo.create({
        employeeId,
        activeDirectoryName: dto.activeDirectoryName ?? null,
        responsiva: dto.responsiva ?? null,
        notes: dto.notes ?? null,
        createdBy: userId,
        updatedBy: userId,
      });
    } else {
      license.activeDirectoryName = dto.activeDirectoryName ?? license.activeDirectoryName;
      license.responsiva = dto.responsiva ?? license.responsiva;
      license.notes = dto.notes ?? license.notes;
      license.updatedBy = userId;
    }
    license = await this.licensesRepo.save(license);

    const existingAssignments = await this.assignmentsRepo.find({ where: { employeeLicenseId: license.id } });
    const existingByTool = new Map(existingAssignments.map((a) => [a.toolId, a]));

    for (const toolDto of dto.tools) {
      const existing = existingByTool.get(toolDto.toolId);
      const now = new Date();

      if (existing) {
        const wasActive = existing.hasAccess;
        existing.hasAccess = toolDto.hasAccess;
        existing.isAdmin = toolDto.isAdmin ?? existing.isAdmin;
        existing.notes = toolDto.notes ?? existing.notes;
        if (!wasActive && toolDto.hasAccess) existing.grantedAt = now;
        if (wasActive && !toolDto.hasAccess) existing.revokedAt = now;
        await this.assignmentsRepo.save(existing);
      } else {
        await this.assignmentsRepo.save(
          this.assignmentsRepo.create({
            employeeLicenseId: license.id,
            toolId: toolDto.toolId,
            hasAccess: toolDto.hasAccess,
            isAdmin: toolDto.isAdmin ?? false,
            notes: toolDto.notes ?? null,
            grantedAt: toolDto.hasAccess ? now : null,
          }),
        );
      }
    }

    return this.findByEmployee(employeeId);
  }

  // -------------------------------------------------------------------------
  // Stats / KPIs
  // -------------------------------------------------------------------------

  async getStats() {
    const tools = await this.getTools();

    const [totalWithLicenses, byTool] = await Promise.all([
      this.licensesRepo.count(),
      this.assignmentsRepo.manager.query<Array<{ tool_id: string; count: string }>>(
        `
        SELECT tool_id, COUNT(*)::int AS count
        FROM licenses.tool_assignments
        WHERE has_access = true
        GROUP BY tool_id
        `,
      ),
    ]);

    const countByTool = new Map(byTool.map((r) => [r.tool_id, parseInt(r.count, 10)]));

    return {
      totalEmployeesWithLicenses: totalWithLicenses,
      byTool: tools.map((tool) => ({
        toolId: tool.id,
        toolName: tool.name,
        count: countByTool.get(tool.id) ?? 0,
      })),
    };
  }
}
