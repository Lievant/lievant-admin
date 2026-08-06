import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import { AssignEmployeeDto } from './dto/assign-employee.dto';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { QueryEquipmentDto } from './dto/query-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { EquipmentBrand } from './entities/equipment-brand.entity';
import { EquipmentHistory } from './entities/equipment-history.entity';
import { EquipmentStatus } from './entities/equipment-status.entity';
import { EquipmentType } from './entities/equipment-type.entity';
import { Equipment } from './entities/equipment.entity';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Equipment) private readonly equipmentRepo: Repository<Equipment>,
    @InjectRepository(EquipmentHistory) private readonly historyRepo: Repository<EquipmentHistory>,
    @InjectRepository(EquipmentType) private readonly typesRepo: Repository<EquipmentType>,
    @InjectRepository(EquipmentBrand) private readonly brandsRepo: Repository<EquipmentBrand>,
    @InjectRepository(EquipmentStatus) private readonly statusesRepo: Repository<EquipmentStatus>,
    @InjectRepository(EmployeeRecord) private readonly employeesRepo: Repository<EmployeeRecord>,
  ) {}

  /**
   * Clave temporal del cursor de paginación, truncada a milisegundos.
   *
   * created_at es timestamptz (microsegundos) pero el cursor se serializa con
   * Date.toISOString(), que solo llega al milisegundo. Comparar el valor crudo
   * contra ese cursor truncado deja filas fuera de las dos ramas del predicado
   * (`.207456` no es `< .207` ni `= .207`), volviéndolas inalcanzables; y si
   * todas las filas comparten el timestamp —una carga masiva en una sola
   * transacción, donde now() es constante— la página siguiente sale vacía.
   *
   * Truncando aquí, la clave de orden tiene exactamente la misma precisión que
   * el cursor y el desempate por id vuelve a ser efectivo.
   */
  private static readonly CURSOR_MS_EXPR = "date_trunc('milliseconds', e.created_at)";

  // -------------------------------------------------------------------------
  // Catálogos
  // -------------------------------------------------------------------------

  findTypes() {
    return this.typesRepo.find({ where: { isActive: true }, order: { sortOrder: 'ASC' } });
  }

  findBrands() {
    return this.brandsRepo.find({ where: { isActive: true }, order: { sortOrder: 'ASC' } });
  }

  findStatuses() {
    return this.statusesRepo.find({ where: { isActive: true }, order: { sortOrder: 'ASC' } });
  }

  // -------------------------------------------------------------------------
  // Lista paginada con filtros
  // -------------------------------------------------------------------------

  async findAll(query: QueryEquipmentDto) {
    const limit = query.limit ?? 20;
    const qb = this.equipmentRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.assignedEmployee', 'emp')
      .where('e.deleted_at IS NULL')
      // Se ordena por created_at truncado a milisegundos, no por el valor
      // crudo: el cursor viaja como Date de JS y toISOString() solo conserva
      // milisegundos, mientras la columna timestamptz guarda microsegundos. Si
      // la clave de orden tiene más precisión que el cursor, el desempate por
      // id queda inservible y filas enteras se vuelven inalcanzables (ver
      // CURSOR_MS_EXPR).
      .orderBy(InventoryService.CURSOR_MS_EXPR, 'DESC')
      .addOrderBy('e.id', 'DESC');

    if (query.equipmentType) qb.andWhere('e.equipment_type = :et', { et: query.equipmentType });
    if (query.brand) qb.andWhere('e.brand = :brand', { brand: query.brand });
    if (query.status) qb.andWhere('e.status = :status', { status: query.status });
    if (query.location) qb.andWhere('e.location = :location', { location: query.location });
    if (query.area) qb.andWhere('e.area = :area', { area: query.area });
    if (query.assignedToEmployeeId) {
      qb.andWhere('e.assigned_to_employee_id = :empId', { empId: query.assignedToEmployeeId });
    }
    if (query.search) {
      // Todas las condiciones van dentro del mismo grupo OR entre paréntesis
      // (no como .orWhere() sueltos, que romperían los demás filtros AND).
      qb.andWhere(
        '(e.display_id ILIKE :s OR e.legacy_id ILIKE :s OR e.model ILIKE :s OR e.serial_number ILIKE :s OR e.brand ILIKE :s OR emp.fullName ILIKE :s OR emp.corporateEmail ILIKE :s)',
        { s: `%${query.search}%` },
      );
    }
    // El conteo se toma antes de aplicar el cursor: es el total de la consulta
    // filtrada, no el tamaño de la página. Antes se devolvía data.length, así
    // que el pie de tabla siempre mostraba "20 de 20+".
    const total = await qb.clone().getCount();

    if (query.cursor) {
      const [cursorDate = '', cursorId = ''] = Buffer.from(query.cursor, 'base64url').toString().split('|');
      // Misma expresión que el ORDER BY, así el desempate por id sí aplica a
      // las filas que caen en el mismo milisegundo que el cursor.
      qb.andWhere(
        `(${InventoryService.CURSOR_MS_EXPR} < :cd OR (${InventoryService.CURSOR_MS_EXPR} = :cd AND e.id < :ci))`,
        { cd: cursorDate, ci: cursorId },
      );
    }

    const items = await qb.limit(limit + 1).getMany();
    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;

    const last = data.at(-1);
    const nextCursor =
      hasMore && last
        ? Buffer.from(`${last.createdAt.toISOString()}|${last.id}`).toString('base64url')
        : null;

    const enriched = data.map((item) => ({
      ...item,
      assignedEmployeeName: item.assignedEmployee?.fullName ?? null,
      assignedEmployeeEmail: item.assignedEmployee?.corporateEmail ?? null,
      assignedEmployeePosition: item.assignedEmployee?.position ?? null,
    }));

    return { data: enriched, nextCursor, total };
  }

  // -------------------------------------------------------------------------
  // Reporte agrupado por área / empleado
  // -------------------------------------------------------------------------

  async getReportByArea() {
    const items = await this.equipmentRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.assignedEmployee', 'emp')
      .where('e.deleted_at IS NULL')
      .andWhere('e.status != :baja', { baja: 'Baja' })
      .andWhere('e.assigned_to_employee_id IS NOT NULL')
      .orderBy('emp.area', 'ASC', 'NULLS LAST')
      .addOrderBy('emp.full_name', 'ASC')
      .addOrderBy('e.equipment_type', 'ASC')
      .getMany();

    const areaMap = new Map<string, Map<string, {
      employeeId: string;
      fullName: string;
      area: string;
      division: string;
      location: string;
      equipment: {
        displayId: string;
        legacyId: string | null;
        equipmentType: string;
        brand: string | null;
        model: string | null;
        serialNumber: string | null;
        status: string;
        chargerIncluded: boolean;
      }[];
    }>>();

    for (const item of items) {
      const emp = item.assignedEmployee;
      if (!emp) continue;
      const areaKey = emp.area ?? 'SIN ÁREA';

      if (!areaMap.has(areaKey)) areaMap.set(areaKey, new Map());
      const empMap = areaMap.get(areaKey)!;

      if (!empMap.has(emp.id)) {
        empMap.set(emp.id, {
          employeeId: emp.id,
          fullName: emp.fullName,
          area: emp.area ?? '',
          division: emp.division ?? '',
          location: emp.location ?? '',
          equipment: [],
        });
      }

      empMap.get(emp.id)!.equipment.push({
        displayId: item.displayId,
        legacyId: item.legacyId,
        equipmentType: item.equipmentType,
        brand: item.brand,
        model: item.model,
        serialNumber: item.serialNumber,
        status: item.status,
        chargerIncluded: item.chargerIncluded,
      });
    }

    const areas = Array.from(areaMap.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'es'))
      .map(([area, empMap]) => ({ area, employees: Array.from(empMap.values()) }));

    return { areas };
  }

  // -------------------------------------------------------------------------
  // Detalle por id
  // -------------------------------------------------------------------------

  async findById(id: string) {
    const item = await this.equipmentRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Equipo ${id} no encontrado`);

    const [history, employee] = await Promise.all([
      this.historyRepo.find({ where: { equipmentId: id }, order: { createdAt: 'ASC' } }),
      item.assignedToEmployeeId
        ? this.employeesRepo.findOne({ where: { id: item.assignedToEmployeeId } })
        : Promise.resolve(null),
    ]);

    return { ...item, history, assignedEmployee: employee };
  }

  // -------------------------------------------------------------------------
  // Crear equipo
  // -------------------------------------------------------------------------

  async create(dto: CreateEquipmentDto, userId: string, userName: string) {
    const displayId = await this.generateDisplayId(dto.purchaseDate);

    const equipment = this.equipmentRepo.create({
      displayId,
      legacyId: dto.legacyId ?? null,
      equipmentType: dto.equipmentType,
      brand: dto.brand ?? null,
      model: dto.model ?? null,
      serialNumber: dto.serialNumber ?? null,
      operatingSystem: dto.operatingSystem ?? null,
      adName: dto.adName ?? null,
      specifications: dto.specifications ?? null,
      assignedToEmployeeId: dto.assignedToEmployeeId ?? null,
      assignmentDate: dto.assignmentDate ?? null,
      responsiva: dto.responsiva ?? null,
      chargerIncluded: dto.chargerIncluded ?? false,
      status: dto.status ?? (dto.assignedToEmployeeId ? 'Asignado' : 'Disponible'),
      location: dto.location ?? null,
      area: dto.area ?? null,
      purchaseDate: dto.purchaseDate ?? null,
      purchaseValue: dto.purchaseValue ?? 0,
      notes: dto.notes ?? null,
    });

    const saved = await this.equipmentRepo.save(equipment);

    await this.historyRepo.save(
      this.historyRepo.create({
        equipmentId: saved.id,
        changedById: userId,
        changedByName: userName,
        action: 'CREADO',
        notes: `Equipo registrado con ID ${displayId}`,
      }),
    );

    return saved;
  }

  // -------------------------------------------------------------------------
  // Actualizar equipo
  // -------------------------------------------------------------------------

  async update(id: string, dto: UpdateEquipmentDto, userId: string, userName: string) {
    const item = await this.equipmentRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Equipo ${id} no encontrado`);

    const changes: Array<{ field: string; old: string; new: string }> = [];
    const trackField = (field: string, oldVal: unknown, newVal: unknown) => {
      if (newVal !== undefined && String(oldVal ?? '') !== String(newVal ?? '')) {
        changes.push({ field, old: String(oldVal ?? ''), new: String(newVal ?? '') });
      }
    };

    trackField('equipmentType', item.equipmentType, dto.equipmentType);
    trackField('brand', item.brand, dto.brand);
    trackField('model', item.model, dto.model);
    trackField('serialNumber', item.serialNumber, dto.serialNumber);
    trackField('operatingSystem', item.operatingSystem, dto.operatingSystem);
    trackField('adName', item.adName, dto.adName);
    trackField('status', item.status, dto.status);
    trackField('location', item.location, dto.location);
    trackField('area', item.area, dto.area);
    trackField('purchaseValue', item.purchaseValue, dto.purchaseValue);
    trackField('notes', item.notes, dto.notes);
    trackField('specifications', item.specifications, dto.specifications);

    Object.assign(item, {
      ...(dto.equipmentType !== undefined && { equipmentType: dto.equipmentType }),
      ...(dto.legacyId !== undefined && { legacyId: dto.legacyId }),
      ...(dto.brand !== undefined && { brand: dto.brand }),
      ...(dto.model !== undefined && { model: dto.model }),
      ...(dto.serialNumber !== undefined && { serialNumber: dto.serialNumber }),
      ...(dto.operatingSystem !== undefined && { operatingSystem: dto.operatingSystem }),
      ...(dto.adName !== undefined && { adName: dto.adName }),
      ...(dto.specifications !== undefined && { specifications: dto.specifications }),
      ...(dto.responsiva !== undefined && { responsiva: dto.responsiva }),
      ...(dto.chargerIncluded !== undefined && { chargerIncluded: dto.chargerIncluded }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.location !== undefined && { location: dto.location }),
      ...(dto.area !== undefined && { area: dto.area }),
      ...(dto.purchaseDate !== undefined && { purchaseDate: dto.purchaseDate }),
      ...(dto.purchaseValue !== undefined && { purchaseValue: dto.purchaseValue }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
    });

    const saved = await this.equipmentRepo.save(item);

    if (changes.length > 0) {
      await Promise.all(
        changes.map((c) =>
          this.historyRepo.save(
            this.historyRepo.create({
              equipmentId: id,
              changedById: userId,
              changedByName: userName,
              action: 'EDITADO',
              fieldChanged: c.field,
              oldValue: c.old,
              newValue: c.new,
            }),
          ),
        ),
      );
    }

    return saved;
  }

  // -------------------------------------------------------------------------
  // Asignar empleado
  // -------------------------------------------------------------------------

  async getEquipmentByEmployee(employeeId: string) {
    const items = await this.equipmentRepo.find({
      where: { assignedToEmployeeId: employeeId, deletedAt: IsNull() },
      order: { equipmentType: 'ASC', brand: 'ASC' },
    });

    return items.map((item) => ({
      id: item.id,
      displayId: item.displayId,
      legacyId: item.legacyId,
      equipmentType: item.equipmentType,
      brand: item.brand,
      model: item.model,
      status: item.status,
    }));
  }

  async getEmployeeEquipmentFor(equipmentId: string) {
    const item = await this.equipmentRepo.findOne({ where: { id: equipmentId } });
    if (!item) throw new NotFoundException(`Equipo ${equipmentId} no encontrado`);
    if (!item.assignedToEmployeeId) return [];

    return this.getOtherEquipmentByEmployee(item.assignedToEmployeeId, equipmentId);
  }

  async getOtherEquipmentByEmployee(employeeId: string, currentEquipmentId: string) {
    const items = await this.getEquipmentByEmployee(employeeId);
    return items.filter((item) => item.id !== currentEquipmentId);
  }

  async assignEmployee(id: string, dto: AssignEmployeeDto, userId: string, userName: string) {
    const item = await this.equipmentRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Equipo ${id} no encontrado`);

    const employee = await this.employeesRepo.findOne({ where: { id: dto.employeeId } });
    if (!employee) throw new NotFoundException(`Empleado ${dto.employeeId} no encontrado`);

    const prevEmployeeId = item.assignedToEmployeeId;

    item.assignedToEmployeeId = dto.employeeId;
    item.assignmentDate = dto.assignmentDate ?? new Date().toISOString().split('T')[0] ?? null;
    item.responsiva = dto.responsiva ?? item.responsiva;
    item.status = 'Asignado';
    if (employee.area) item.area = employee.area;
    if (employee.location) item.location = employee.location;

    await this.equipmentRepo.save(item);

    await this.historyRepo.save(
      this.historyRepo.create({
        equipmentId: id,
        changedById: userId,
        changedByName: userName,
        action: 'ASIGNADO',
        fieldChanged: 'assignedToEmployeeId',
        oldValue: prevEmployeeId ?? null,
        newValue: dto.employeeId,
        notes: dto.notes ?? `Asignado a ${employee.fullName}`,
      }),
    );

    return this.findById(id);
  }

  // -------------------------------------------------------------------------
  // Desasignar empleado
  // -------------------------------------------------------------------------

  async unassignEmployee(id: string, userId: string, userName: string, notes?: string) {
    const item = await this.equipmentRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Equipo ${id} no encontrado`);

    const prevEmployeeId = item.assignedToEmployeeId;
    item.assignedToEmployeeId = null;
    item.assignmentDate = null;
    item.responsiva = null;
    item.status = 'Disponible';

    await this.equipmentRepo.save(item);

    await this.historyRepo.save(
      this.historyRepo.create({
        equipmentId: id,
        changedById: userId,
        changedByName: userName,
        action: 'DESASIGNADO',
        fieldChanged: 'assignedToEmployeeId',
        oldValue: prevEmployeeId ?? null,
        newValue: null,
        notes: notes ?? 'Equipo desasignado',
      }),
    );

    return this.findById(id);
  }

  // -------------------------------------------------------------------------
  // Stats / KPIs
  // -------------------------------------------------------------------------

  async getStats() {
    const [byType, byStatus, total, assigned] = await Promise.all([
      this.equipmentRepo
        .createQueryBuilder('e')
        .select('"e"."equipment_type"', 'type')
        .addSelect('COUNT(*)', 'count')
        .where('e.deleted_at IS NULL')
        .groupBy('"e"."equipment_type"')
        .orderBy('count', 'DESC')
        .getRawMany<{ type: string; count: string }>(),

      this.equipmentRepo
        .createQueryBuilder('e')
        .select('"e"."status"', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('e.deleted_at IS NULL')
        .groupBy('"e"."status"')
        .orderBy('count', 'DESC')
        .getRawMany<{ status: string; count: string }>(),

      this.equipmentRepo.count({ where: { deletedAt: IsNull() } }),
      this.equipmentRepo.count({ where: { status: 'Asignado', deletedAt: IsNull() } }),
    ]);

    return {
      total,
      assigned,
      available: total - assigned,
      assignedPercent: total > 0 ? Math.round((assigned / total) * 100) : 0,
      byType: byType.map((r) => ({ type: r.type, count: parseInt(r.count, 10) })),
      byStatus: byStatus.map((r) => ({ status: r.status, count: parseInt(r.count, 10) })),
    };
  }

  // -------------------------------------------------------------------------
  // Equipos del usuario autenticado
  // -------------------------------------------------------------------------

  async getMyEquipment(userEmail: string) {
    const employee = await this.employeesRepo.findOne({
      where: { corporateEmail: userEmail },
    });
    if (!employee) return [];

    const items = await this.equipmentRepo.find({
      where: { assignedToEmployeeId: employee.id, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });

    return items.map((e) => ({
      id: e.id,
      displayId: e.displayId,
      legacyId: e.legacyId,
      equipmentType: e.equipmentType,
      brand: e.brand,
      model: e.model,
      status: e.status,
    }));
  }

  // -------------------------------------------------------------------------
  // generateDisplayId: TEC-YYYY-NNN
  // -------------------------------------------------------------------------

  async generateDisplayId(purchaseDate?: string): Promise<string> {
    const year = purchaseDate ? new Date(purchaseDate).getFullYear() : new Date().getFullYear();
    const result = await this.equipmentRepo.query(
      `SELECT nextval('inventory.equipment_display_id_seq') AS next_id`,
    );
    const nextId = parseInt(result[0].next_id, 10);
    return `TEC-${year}-${String(nextId).padStart(3, '0')}`;
  }
}
