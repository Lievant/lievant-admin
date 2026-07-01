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
      .orderBy('e.createdAt', 'DESC')
      .addOrderBy('e.id', 'DESC')
      .limit(limit + 1);

    if (query.equipmentType) qb.andWhere('e.equipment_type = :et', { et: query.equipmentType });
    if (query.brand) qb.andWhere('e.brand = :brand', { brand: query.brand });
    if (query.status) qb.andWhere('e.status = :status', { status: query.status });
    if (query.location) qb.andWhere('e.location = :location', { location: query.location });
    if (query.area) qb.andWhere('e.area = :area', { area: query.area });
    if (query.assignedToEmployeeId) {
      qb.andWhere('e.assigned_to_employee_id = :empId', { empId: query.assignedToEmployeeId });
    }
    if (query.search) {
      qb.andWhere(
        '(e.display_id ILIKE :s OR e.legacy_id ILIKE :s OR e.model ILIKE :s OR e.serial_number ILIKE :s OR e.brand ILIKE :s)',
        { s: `%${query.search}%` },
      );
    }
    if (query.cursor) {
      const [cursorDate = '', cursorId = ''] = Buffer.from(query.cursor, 'base64url').toString().split('|');
      qb.andWhere(
        '(e.created_at < :cd OR (e.created_at = :cd AND e.id < :ci))',
        { cd: cursorDate, ci: cursorId },
      );
    }

    const items = await qb.getMany();
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

    return { data: enriched, nextCursor, total: enriched.length };
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
  // generateDisplayId: TEC-YYYY-NNN
  // -------------------------------------------------------------------------

  async generateDisplayId(purchaseDate?: string): Promise<string> {
    const year = purchaseDate ? new Date(purchaseDate).getFullYear() : new Date().getFullYear();
    const prefix = `TEC-${year}-`;
    const last = await this.equipmentRepo
      .createQueryBuilder('e')
      .select('"e"."display_id"', 'displayId')
      .where('"e"."display_id" LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('"e"."display_id"', 'DESC')
      .limit(1)
      .getRawOne<{ displayId: string }>();

    let seq = 1;
    if (last?.displayId) {
      const parts = last.displayId.split('-');
      const n = parseInt(parts[2] ?? '0', 10);
      if (!isNaN(n)) seq = n + 1;
    }
    return `${prefix}${String(seq).padStart(3, '0')}`;
  }
}
