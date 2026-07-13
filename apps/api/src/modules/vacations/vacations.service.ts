import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import { EmployeeStatus } from '../employees/constants/employee-status.constant';
import { CreateVacationRequestDto } from './dto/create-vacation-request.dto';
import { Holiday } from './entities/holiday.entity';
import { VacationBalance } from './entities/vacation-balance.entity';
import { VacationMovement } from './entities/vacation-movement.entity';
import { VacationPolicy } from './entities/vacation-policy.entity';
import { VacationRequest } from './entities/vacation-request.entity';

const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5];

interface HolidaySets {
  recurring: Set<string>; // 'MM-DD'
  fixed: Set<string>; // 'YYYY-MM-DD'
}

function ymd(date: string): { y: number; m: number; d: number } {
  const parts = date.slice(0, 10).split('-');
  return { y: Number(parts[0]), m: Number(parts[1]), d: Number(parts[2]) };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isoWeekday(dateUtcMs: number): number {
  const dow = new Date(dateUtcMs).getUTCDay(); // 0=Sun..6=Sat
  return dow === 0 ? 7 : dow;
}

function photoUrl(email: string | null): string | null {
  return email ? `/api/users/${encodeURIComponent(email)}/photo` : null;
}

@Injectable()
export class VacationsService {
  private readonly logger = new Logger(VacationsService.name);

  constructor(
    @InjectRepository(EmployeeRecord) private readonly employeesRepo: Repository<EmployeeRecord>,
    @InjectRepository(VacationBalance) private readonly balancesRepo: Repository<VacationBalance>,
    @InjectRepository(VacationRequest) private readonly requestsRepo: Repository<VacationRequest>,
    @InjectRepository(VacationMovement) private readonly movementsRepo: Repository<VacationMovement>,
    @InjectRepository(VacationPolicy) private readonly policiesRepo: Repository<VacationPolicy>,
    @InjectRepository(Holiday) private readonly holidaysRepo: Repository<Holiday>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  // ==========================================================================
  // Helpers de dominio
  // ==========================================================================

  private async getEmployeeByUserId(userId: string): Promise<EmployeeRecord> {
    // Primero por el vínculo directo auth_user_id
    let employee = await this.employeesRepo.findOne({ where: { authUserId: userId } });

    // Fallback: por el email del usuario (para expedientes aún sin vincular)
    if (!employee) {
      const user = await this.usersRepo.findOne({ where: { id: userId } });
      if (user?.email) {
        employee = await this.employeesRepo
          .createQueryBuilder('e')
          .where('LOWER(e.corporate_email) = LOWER(:email)', { email: user.email })
          .andWhere('e.deleted_at IS NULL')
          .getOne();

        // Auto-vincula para que las próximas consultas usen la vía directa
        if (employee && !employee.authUserId) {
          employee.authUserId = userId;
          await this.employeesRepo.save(employee);
        }
      }
    }

    if (!employee) {
      throw new NotFoundException('No se encontró un expediente de empleado vinculado a tu usuario.');
    }
    return employee;
  }

  /** Días a los que se tiene derecho según antigüedad (política LFT configurable). */
  async getVacationDaysEntitled(yearsOfService: number): Promise<number> {
    const yos = Math.max(1, yearsOfService);
    // Se toma el rango más alto cuyo year_from <= antigüedad (el último rango
    // queda "abierto" hacia arriba: 26-30 aplica también a 31+).
    const policy = await this.policiesRepo
      .createQueryBuilder('p')
      .where('p.country = :c', { c: 'MEX' })
      .andWhere('p.is_active = true')
      .andWhere('p.year_from <= :yos', { yos })
      .orderBy('p.year_from', 'DESC')
      .getOne();
    return policy?.vacationDays ?? 12;
  }

  /**
   * Período de vacaciones vigente para una fecha de antigüedad dada.
   * El período corre de aniversario a aniversario.
   */
  private computeCurrentPeriod(seniorityDate: string, today = new Date()): {
    periodStart: string;
    periodEnd: string;
    yearsOfService: number;
  } {
    const s = ymd(seniorityDate);
    const t = { y: today.getUTCFullYear(), m: today.getUTCMonth() + 1, d: today.getUTCDate() };

    // Aniversario en el año actual
    const annThisYearMs = Date.UTC(t.y, s.m - 1, s.d);
    const todayMs = Date.UTC(t.y, t.m - 1, t.d);

    let startY: number;
    if (annThisYearMs <= todayMs) {
      startY = t.y;
    } else {
      startY = t.y - 1;
    }

    const periodStartMs = Date.UTC(startY, s.m - 1, s.d);
    const periodEndMs = Date.UTC(startY + 1, s.m - 1, s.d) - 86400000; // -1 día

    const start = new Date(periodStartMs);
    const end = new Date(periodEndMs);

    return {
      periodStart: `${start.getUTCFullYear()}-${pad2(start.getUTCMonth() + 1)}-${pad2(start.getUTCDate())}`,
      periodEnd: `${end.getUTCFullYear()}-${pad2(end.getUTCMonth() + 1)}-${pad2(end.getUTCDate())}`,
      yearsOfService: startY - s.y,
    };
  }

  private async getHolidaySets(): Promise<HolidaySets> {
    const holidays = await this.holidaysRepo.find({ where: { isActive: true } });
    const recurring = new Set<string>();
    const fixed = new Set<string>();
    for (const h of holidays) {
      const { y, m, d } = ymd(h.date);
      if (h.isRecurring) {
        recurring.add(`${pad2(m)}-${pad2(d)}`);
      } else {
        fixed.add(`${y}-${pad2(m)}-${pad2(d)}`);
      }
    }
    return { recurring, fixed };
  }

  /**
   * Cuenta días hábiles entre dos fechas (inclusive), excluyendo días no
   * laborales del empleado y festivos activos.
   */
  async calculateWorkingDays(
    startDate: string,
    endDate: string,
    workDays: number[] | null | undefined,
    _year?: number,
  ): Promise<number> {
    const wd = workDays && workDays.length ? workDays : DEFAULT_WORK_DAYS;
    const { recurring, fixed } = await this.getHolidaySets();

    const s = ymd(startDate);
    const e = ymd(endDate);
    let cur = Date.UTC(s.y, s.m - 1, s.d);
    const end = Date.UTC(e.y, e.m - 1, e.d);
    if (cur > end) return 0;

    let count = 0;
    while (cur <= end) {
      const dt = new Date(cur);
      const iso = isoWeekday(cur);
      const mm = pad2(dt.getUTCMonth() + 1);
      const dd = pad2(dt.getUTCDate());
      const mmdd = `${mm}-${dd}`;
      const full = `${dt.getUTCFullYear()}-${mm}-${dd}`;
      if (wd.includes(iso) && !recurring.has(mmdd) && !fixed.has(full)) {
        count += 1;
      }
      cur += 86400000;
    }
    return count;
  }

  private availableDays(balance: VacationBalance): number {
    return Number(balance.entitledDays) - Number(balance.usedDays) - Number(balance.expiredDays);
  }

  // ==========================================================================
  // Saldos
  // ==========================================================================

  async getOrCreateCurrentBalance(employeeId: string): Promise<VacationBalance> {
    const existing = await this.balancesRepo.findOne({
      where: { employeeId, isCurrent: true },
      order: { periodStart: 'DESC' },
    });
    if (existing) return existing;

    const employee = await this.employeesRepo.findOne({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException(`Empleado ${employeeId} no encontrado.`);
    if (!employee.seniorityDate) {
      throw new BadRequestException('El empleado no tiene fecha de antigüedad registrada.');
    }

    const { periodStart, periodEnd, yearsOfService } = this.computeCurrentPeriod(employee.seniorityDate);
    const entitledDays = await this.getVacationDaysEntitled(yearsOfService);

    const balance = this.balancesRepo.create({
      employeeId,
      periodStart,
      periodEnd,
      yearsOfService,
      entitledDays,
      usedDays: '0',
      expiredDays: '0',
      isCurrent: true,
    });
    const saved = await this.balancesRepo.save(balance);

    await this.movementsRepo.save(
      this.movementsRepo.create({
        employeeId,
        balanceId: saved.id,
        movementType: 'PERIOD_START',
        daysDelta: String(entitledDays),
        description: `Inicio de período ${periodStart} — ${entitledDays} días (antigüedad ${yearsOfService} años).`,
      }),
    );

    return saved;
  }

  // ==========================================================================
  // Aniversarios (cron)
  // ==========================================================================

  async processAnniversaries(): Promise<{ processed: number; created: number }> {
    const today = new Date();
    const tm = today.getUTCMonth() + 1;
    const td = today.getUTCDate();

    const employees = await this.employeesRepo.find({
      where: { status: EmployeeStatus.ACTIVE },
    });

    let created = 0;
    for (const employee of employees) {
      if (!employee.seniorityDate) continue;
      const s = ymd(employee.seniorityDate);
      if (s.m !== tm || s.d !== td) continue; // no es su aniversario hoy

      const { periodStart, periodEnd, yearsOfService } = this.computeCurrentPeriod(employee.seniorityDate, today);
      const entitledDays = await this.getVacationDaysEntitled(yearsOfService);

      await this.dataSource.transaction(async (mgr) => {
        // ¿Ya existe el balance de este nuevo período?
        const already = await mgr.getRepository(VacationBalance).findOne({
          where: { employeeId: employee.id, periodStart },
        });
        if (already) return;

        // Cierra el período anterior vigente (expira lo no usado)
        const previous = await mgr.getRepository(VacationBalance).findOne({
          where: { employeeId: employee.id, isCurrent: true },
          order: { periodStart: 'DESC' },
        });
        if (previous) {
          const remaining = Math.max(
            0,
            Number(previous.entitledDays) - Number(previous.usedDays) - Number(previous.expiredDays),
          );
          previous.isCurrent = false;
          previous.expiredDays = String(Number(previous.expiredDays) + remaining);
          await mgr.getRepository(VacationBalance).save(previous);

          if (remaining > 0) {
            await mgr.getRepository(VacationMovement).save(
              mgr.getRepository(VacationMovement).create({
                employeeId: employee.id,
                balanceId: previous.id,
                movementType: 'PERIOD_EXPIRY',
                daysDelta: String(-remaining),
                description: `Expiración de ${remaining} días no utilizados del período ${previous.periodStart}.`,
              }),
            );
          }
        }

        // Nuevo período
        const balance = await mgr.getRepository(VacationBalance).save(
          mgr.getRepository(VacationBalance).create({
            employeeId: employee.id,
            periodStart,
            periodEnd,
            yearsOfService,
            entitledDays,
            usedDays: '0',
            expiredDays: '0',
            isCurrent: true,
          }),
        );

        await mgr.getRepository(VacationMovement).save(
          mgr.getRepository(VacationMovement).create({
            employeeId: employee.id,
            balanceId: balance.id,
            movementType: 'PERIOD_START',
            daysDelta: String(entitledDays),
            description: `Inicio de período ${periodStart} — ${entitledDays} días (antigüedad ${yearsOfService} años).`,
          }),
        );
        created += 1;
      });
    }

    this.logger.log(`processAnniversaries: ${employees.length} empleados revisados, ${created} períodos creados.`);
    return { processed: employees.length, created };
  }

  @Cron('0 6 * * *') // Todos los días a las 6:00 am
  async processAnniversariesCron(): Promise<void> {
    this.logger.log('Ejecutando cron de aniversarios de vacaciones…');
    try {
      await this.processAnniversaries();
    } catch (err) {
      this.logger.error('Error en cron de aniversarios', err instanceof Error ? err.stack : String(err));
    }
  }

  // ==========================================================================
  // Solicitudes
  // ==========================================================================

  async createRequest(dto: CreateVacationRequestDto, userId: string): Promise<VacationRequest> {
    const employee = await this.getEmployeeByUserId(userId);

    if (dto.endDate < dto.startDate) {
      throw new BadRequestException('La fecha de fin no puede ser anterior a la fecha de inicio.');
    }

    const balance = await this.getOrCreateCurrentBalance(employee.id);

    const workingDays = await this.calculateWorkingDays(dto.startDate, dto.endDate, employee.workDays);
    if (workingDays <= 0) {
      throw new BadRequestException('El rango seleccionado no contiene días hábiles.');
    }

    const available = this.availableDays(balance);
    if (workingDays > available) {
      throw new BadRequestException(
        `Días insuficientes: solicitas ${workingDays} y tu saldo disponible es ${available}.`,
      );
    }

    if (dto.substituteEmployeeId && dto.substituteEmployeeId === employee.id) {
      throw new BadRequestException('No puedes asignarte a ti mismo como sustituto.');
    }

    return this.dataSource.transaction(async (mgr) => {
      const seqRows = (await mgr.query(`SELECT nextval('hr.vacation_request_seq') AS seq`)) as { seq: string }[];
      const seq = seqRows[0]?.seq ?? '0';
      const year = new Date().getUTCFullYear();
      const displayId = `VAC-${year}-${String(seq).padStart(3, '0')}`;

      const request = await mgr.getRepository(VacationRequest).save(
        mgr.getRepository(VacationRequest).create({
          displayId,
          employeeId: employee.id,
          balanceId: balance.id,
          startDate: dto.startDate,
          endDate: dto.endDate,
          workingDaysTaken: String(workingDays),
          substituteEmployeeId: dto.substituteEmployeeId ?? null,
          status: 'pending',
          notes: dto.notes ?? null,
        }),
      );

      // Descuento provisional del saldo (retención mientras está pendiente)
      balance.usedDays = String(Number(balance.usedDays) + workingDays);
      await mgr.getRepository(VacationBalance).save(balance);

      return request;
    });
  }

  private async resolveApproverEmployeeId(user: User): Promise<string | null> {
    const emp = await this.employeesRepo.findOne({ where: { authUserId: user.id } });
    return emp?.id ?? null;
  }

  /** Solo el jefe directo (o un SUPER_ADMIN) puede gestionar la solicitud. */
  private async assertCanManage(
    request: VacationRequest,
    user: User,
    approverEmployeeId: string | null,
  ): Promise<void> {
    const isSuperAdmin = (user.roles ?? []).some((r) => r.name === 'SUPER_ADMIN');
    if (isSuperAdmin) return;
    if (!approverEmployeeId) return; // usuario sin expediente vinculado (cuenta administrativa)

    const employee = await this.employeesRepo.findOne({ where: { id: request.employeeId } });
    if (employee?.directReportToId && employee.directReportToId === approverEmployeeId) return;

    throw new ForbiddenException('Solo el jefe directo puede gestionar esta solicitud.');
  }

  async approveRequest(requestId: string, user: User): Promise<VacationRequest> {
    const request = await this.requestsRepo.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Solicitud no encontrada.');
    if (request.status !== 'pending') {
      throw new BadRequestException(`La solicitud ya está ${request.status}.`);
    }

    const approverEmployeeId = await this.resolveApproverEmployeeId(user);
    await this.assertCanManage(request, user, approverEmployeeId);

    request.status = 'approved';
    request.approvedBy = approverEmployeeId;
    request.approvedAt = new Date();
    await this.requestsRepo.save(request);

    await this.movementsRepo.save(
      this.movementsRepo.create({
        employeeId: request.employeeId,
        balanceId: request.balanceId,
        requestId: request.id,
        movementType: 'REQUEST_APPROVED',
        daysDelta: String(-Number(request.workingDaysTaken)),
        description: `Solicitud ${request.displayId} aprobada (${request.workingDaysTaken} días).`,
        createdBy: user.id,
      }),
    );

    // TODO: enviar notificación al colaborador (placeholder)
    this.logger.log(`TODO notificación: solicitud ${request.displayId} aprobada.`);

    return request;
  }

  async rejectRequest(requestId: string, user: User, reason: string): Promise<VacationRequest> {
    const request = await this.requestsRepo.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Solicitud no encontrada.');
    if (request.status !== 'pending') {
      throw new BadRequestException(`La solicitud ya está ${request.status}.`);
    }

    const approverEmployeeId = await this.resolveApproverEmployeeId(user);
    await this.assertCanManage(request, user, approverEmployeeId);
    const days = Number(request.workingDaysTaken);

    await this.dataSource.transaction(async (mgr) => {
      request.status = 'rejected';
      request.approvedBy = approverEmployeeId;
      request.approvedAt = new Date();
      request.rejectionReason = reason;
      await mgr.getRepository(VacationRequest).save(request);

      // Devuelve los días retenidos al saldo
      const balance = await mgr.getRepository(VacationBalance).findOne({ where: { id: request.balanceId } });
      if (balance) {
        balance.usedDays = String(Math.max(0, Number(balance.usedDays) - days));
        await mgr.getRepository(VacationBalance).save(balance);
      }

      await mgr.getRepository(VacationMovement).save(
        mgr.getRepository(VacationMovement).create({
          employeeId: request.employeeId,
          balanceId: request.balanceId,
          requestId: request.id,
          movementType: 'REQUEST_CANCELLED',
          daysDelta: String(days),
          description: `Solicitud ${request.displayId} rechazada: ${reason}`,
          createdBy: user.id,
        }),
      );
    });

    // TODO: enviar notificación al colaborador (placeholder)
    this.logger.log(`TODO notificación: solicitud ${request.displayId} rechazada.`);

    return request;
  }

  // ==========================================================================
  // Consultas
  // ==========================================================================

  async getMyBalance(userId: string) {
    const employee = await this.getEmployeeByUserId(userId);
    const balance = await this.getOrCreateCurrentBalance(employee.id);
    return {
      employeeId: employee.id,
      fullName: employee.fullName,
      seniorityDate: employee.seniorityDate,
      workDays: employee.workDays ?? DEFAULT_WORK_DAYS,
      balance: this.serializeBalance(balance),
    };
  }

  private serializeBalance(balance: VacationBalance) {
    return {
      id: balance.id,
      periodStart: balance.periodStart,
      periodEnd: balance.periodEnd,
      yearsOfService: balance.yearsOfService,
      entitledDays: Number(balance.entitledDays),
      usedDays: Number(balance.usedDays),
      expiredDays: Number(balance.expiredDays),
      availableDays: this.availableDays(balance),
      isCurrent: balance.isCurrent,
    };
  }

  async getMyRequests(userId: string) {
    const employee = await this.getEmployeeByUserId(userId);
    return this.listRequestsForEmployee(employee.id);
  }

  private async listRequestsForEmployee(employeeId: string) {
    const requests = await this.requestsRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.substitute', 'sub')
      .leftJoinAndSelect('r.balance', 'bal')
      .where('r.employee_id = :employeeId', { employeeId })
      .andWhere('r.deleted_at IS NULL')
      .orderBy('r.created_at', 'DESC')
      .getMany();

    return requests.map((r) => this.serializeRequest(r));
  }

  private serializeRequest(r: VacationRequest) {
    return {
      id: r.id,
      displayId: r.displayId,
      startDate: r.startDate,
      endDate: r.endDate,
      workingDaysTaken: Number(r.workingDaysTaken),
      status: r.status,
      notes: r.notes,
      rejectionReason: r.rejectionReason,
      approvedAt: r.approvedAt,
      createdAt: r.createdAt,
      substitute: r.substitute
        ? { id: r.substitute.id, fullName: r.substitute.fullName, corporateEmail: r.substitute.corporateEmail }
        : null,
      period: r.balance
        ? { periodStart: r.balance.periodStart, periodEnd: r.balance.periodEnd }
        : null,
    };
  }

  async getPendingApprovals(userId: string) {
    const manager = await this.employeesRepo.findOne({ where: { authUserId: userId } });
    if (!manager) return [];

    const requests = await this.requestsRepo
      .createQueryBuilder('r')
      .innerJoinAndSelect('r.employee', 'emp')
      .leftJoinAndSelect('r.substitute', 'sub')
      .where('r.status = :status', { status: 'pending' })
      .andWhere('r.deleted_at IS NULL')
      .andWhere('emp.direct_report_to_id = :managerId', { managerId: manager.id })
      .orderBy('r.created_at', 'ASC')
      .getMany();

    return requests.map((r) => ({
      id: r.id,
      displayId: r.displayId,
      startDate: r.startDate,
      endDate: r.endDate,
      workingDaysTaken: Number(r.workingDaysTaken),
      notes: r.notes,
      createdAt: r.createdAt,
      employee: {
        id: r.employee.id,
        fullName: r.employee.fullName,
        position: r.employee.position,
        corporateEmail: r.employee.corporateEmail,
        photoUrl: photoUrl(r.employee.corporateEmail),
      },
      substitute: r.substitute
        ? {
            id: r.substitute.id,
            fullName: r.substitute.fullName,
            photoUrl: photoUrl(r.substitute.corporateEmail),
          }
        : null,
    }));
  }

  /** Resumen para el tab de RRHH (solo lectura). */
  async getEmployeeVacationSummary(employeeId: string) {
    const employee = await this.employeesRepo.findOne({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException(`Empleado ${employeeId} no encontrado.`);

    const balance = employee.seniorityDate ? await this.getOrCreateCurrentBalance(employeeId) : null;

    const movements = await this.movementsRepo.find({
      where: { employeeId },
      order: { createdAt: 'DESC' },
      take: 100,
    });

    const requests = await this.listRequestsForEmployee(employeeId);

    // Prima vacacional estimada sobre los días con derecho del período vigente
    const comp = (await this.dataSource.query(
      `SELECT monthly_gross_salary FROM employees.compensation WHERE employee_id = $1`,
      [employeeId],
    )) as { monthly_gross_salary: string | null }[];
    const monthlySalary = comp[0]?.monthly_gross_salary ? Number(comp[0].monthly_gross_salary) : null;
    const dailySalary = monthlySalary !== null ? monthlySalary / 30 : null;
    const entitled = balance ? Number(balance.entitledDays) : 0;
    const estimatedPrima = dailySalary !== null ? Number((entitled * dailySalary * 0.25).toFixed(2)) : null;

    return {
      employeeId: employee.id,
      fullName: employee.fullName,
      seniorityDate: employee.seniorityDate,
      balance: balance ? this.serializeBalance(balance) : null,
      compensation: {
        monthlySalary,
        dailySalary: dailySalary !== null ? Number(dailySalary.toFixed(2)) : null,
        estimatedPrima,
      },
      movements: movements.map((m) => ({
        id: m.id,
        movementType: m.movementType,
        daysDelta: Number(m.daysDelta),
        description: m.description,
        createdAt: m.createdAt,
      })),
      requests,
    };
  }

  async getVacationReport(startDate: string, endDate: string) {
    if (endDate < startDate) {
      throw new BadRequestException('La fecha de fin no puede ser anterior a la fecha de inicio.');
    }

    const requests = await this.requestsRepo
      .createQueryBuilder('r')
      .innerJoinAndSelect('r.employee', 'emp')
      .where('r.status = :status', { status: 'approved' })
      .andWhere('r.deleted_at IS NULL')
      .andWhere('r.start_date <= :end', { end: endDate })
      .andWhere('r.end_date >= :start', { start: startDate })
      .orderBy('emp.full_name', 'ASC')
      .getMany();

    if (requests.length === 0) return [];

    const employeeIds = [...new Set(requests.map((r) => r.employeeId))];
    const comps = (await this.dataSource.query(
      `SELECT employee_id, monthly_gross_salary FROM employees.compensation WHERE employee_id = ANY($1)`,
      [employeeIds],
    )) as { employee_id: string; monthly_gross_salary: string | null }[];
    const salaryByEmployee = new Map(comps.map((c) => [c.employee_id, c.monthly_gross_salary]));

    const rows = [];
    for (const r of requests) {
      const rangeStart = r.startDate > startDate ? r.startDate : startDate;
      const rangeEnd = r.endDate < endDate ? r.endDate : endDate;
      const daysInRange = await this.calculateWorkingDays(rangeStart, rangeEnd, r.employee.workDays);
      const daysOutsideRange = Number((Number(r.workingDaysTaken) - daysInRange).toFixed(2));

      const monthlyRaw = salaryByEmployee.get(r.employeeId);
      const monthlySalary = monthlyRaw ? Number(monthlyRaw) : null;
      const dailySalary = monthlySalary !== null ? Number((monthlySalary / 30).toFixed(2)) : null;
      const primaVacacional =
        dailySalary !== null ? Number((daysInRange * dailySalary * 0.25).toFixed(2)) : null;

      rows.push({
        requestId: r.id,
        displayId: r.displayId,
        employeeId: r.employeeId,
        fullName: r.employee.fullName,
        area: r.employee.area,
        startDate: r.startDate,
        endDate: r.endDate,
        workingDaysTaken: Number(r.workingDaysTaken),
        daysInRange,
        daysOutsideRange: Math.max(0, daysOutsideRange),
        monthlySalary,
        dailySalary,
        primaVacacional,
      });
    }

    return rows;
  }

  async getHolidays(year: number) {
    const holidays = await this.holidaysRepo.find({ where: { isActive: true }, order: { date: 'ASC' } });
    const result = holidays
      .map((h) => {
        const { y, m, d } = ymd(h.date);
        if (h.isRecurring) {
          return {
            id: h.id,
            name: h.name,
            date: `${year}-${pad2(m)}-${pad2(d)}`,
            isRecurring: true,
            country: h.country,
          };
        }
        if (y !== year) return null;
        return {
          id: h.id,
          name: h.name,
          date: `${y}-${pad2(m)}-${pad2(d)}`,
          isRecurring: false,
          country: h.country,
        };
      })
      .filter((h): h is NonNullable<typeof h> => h !== null);

    result.sort((a, b) => a.date.localeCompare(b.date));
    return result;
  }

  /** Calcula días hábiles para un rango; usa los work_days del empleado indicado o del usuario. */
  async calculateDaysForUser(startDate: string, endDate: string, userId: string, employeeId?: string) {
    let workDays: number[] | null | undefined;
    if (employeeId) {
      const emp = await this.employeesRepo.findOne({ where: { id: employeeId } });
      workDays = emp?.workDays;
    } else {
      const emp = await this.employeesRepo.findOne({ where: { authUserId: userId } });
      workDays = emp?.workDays;
    }
    const workingDays = await this.calculateWorkingDays(startDate, endDate, workDays);

    // Festivos excluidos dentro del rango (para mostrar en el resumen)
    const yearOfStart = ymd(startDate).y;
    const holidays = await this.getHolidays(yearOfStart);
    const excludedHolidays = holidays.filter((h) => h.date >= startDate.slice(0, 10) && h.date <= endDate.slice(0, 10));

    return { workingDays, excludedHolidays };
  }
}
