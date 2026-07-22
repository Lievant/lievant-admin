import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Brand } from '../clients/entities/brand.entity';
import { ClientRecord } from '../clients/entities/client-record.entity';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import { AddMemberDto } from './dto/add-member.dto';
import { AddMilestoneDto } from './dto/add-milestone.dto';
import { BusinessUnitEntryDto, CreateProjectDto } from './dto/create-project.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';
import { UpdateFinancialsDto } from './dto/update-financials.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UploadProjectDocumentDto } from './dto/upload-document.dto';
import { ProjectBillingMilestone } from './entities/project-billing-milestone.entity';
import { ProjectBusinessUnit } from './entities/project-business-unit.entity';
import { ProjectDocument } from './entities/project-document.entity';
import { ProjectFinancials } from './entities/project-financials.entity';
import { ProjectHistory } from './entities/project-history.entity';
import { ProjectMember } from './entities/project-member.entity';
import { ProjectRecord } from './entities/project-record.entity';
import { ProjectStorageService } from './project-storage.service';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(ProjectRecord) private readonly projectsRepo: Repository<ProjectRecord>,
    @InjectRepository(ProjectMember) private readonly membersRepo: Repository<ProjectMember>,
    @InjectRepository(ProjectBusinessUnit) private readonly buRepo: Repository<ProjectBusinessUnit>,
    @InjectRepository(ProjectFinancials) private readonly financialsRepo: Repository<ProjectFinancials>,
    @InjectRepository(ProjectBillingMilestone) private readonly milestonesRepo: Repository<ProjectBillingMilestone>,
    @InjectRepository(ProjectDocument) private readonly documentsRepo: Repository<ProjectDocument>,
    @InjectRepository(ProjectHistory) private readonly historyRepo: Repository<ProjectHistory>,
    @InjectRepository(ClientRecord) private readonly clientsRepo: Repository<ClientRecord>,
    @InjectRepository(Brand) private readonly brandsRepo: Repository<Brand>,
    @InjectRepository(EmployeeRecord) private readonly employeesRepo: Repository<EmployeeRecord>,
    private readonly storage: ProjectStorageService,
  ) {}

  // ─── Lista ───────────────────────────────────────────────────────────────

  async findAll(query: QueryProjectsDto) {
    const limit = parseInt(query.limit ?? '20', 10);

    const qb = this.projectsRepo
      .createQueryBuilder('p')
      .where('p.deleted_at IS NULL')
      .orderBy('p.created_at', 'DESC')
      .addOrderBy('p.id', 'DESC')
      .limit(limit + 1);

    if (query.status) qb.andWhere('p.status = :status', { status: query.status });
    if (query.projectType) qb.andWhere('p.project_type = :pt', { pt: query.projectType });
    if (query.businessUnit) qb.andWhere('p.primary_business_unit = :bu', { bu: query.businessUnit });
    if (query.clientRecordId) qb.andWhere('p.client_record_id = :cid', { cid: query.clientRecordId });
    if (query.projectManagerId) qb.andWhere('p.project_manager_id = :pmid', { pmid: query.projectManagerId });
    if (query.search) {
      qb.andWhere(
        '(p.display_id ILIKE :s OR p.name ILIKE :s OR p.pm_code ILIKE :s)',
        { s: `%${query.search}%` },
      );
    }
    if (query.cursor) {
      const [cd = '', ci = ''] = Buffer.from(query.cursor, 'base64url').toString().split('|');
      qb.andWhere('(p.created_at < :cd OR (p.created_at = :cd AND p.id < :ci))', { cd, ci });
    }

    const items = await qb.getMany();
    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;

    const enriched = await this.enrichList(data);
    const last = data.at(-1);
    const nextCursor =
      hasMore && last
        ? Buffer.from(`${last.createdAt.toISOString()}|${last.id}`).toString('base64url')
        : null;

    return { data: enriched, nextCursor, total: enriched.length };
  }

  private async enrichList(projects: ProjectRecord[]) {
    if (projects.length === 0) return [];

    const clientIds = [...new Set(projects.map((p) => p.clientRecordId).filter(Boolean))] as string[];
    const brandIds = [...new Set(projects.map((p) => p.brandId).filter(Boolean))] as string[];
    const pmIds = [...new Set(projects.map((p) => p.projectManagerId).filter(Boolean))] as string[];

    const [clients, brands, employees, financials] = await Promise.all([
      clientIds.length ? this.clientsRepo.createQueryBuilder('c').leftJoinAndSelect('c.primaryCompany', 'pc').where('c.id IN (:...ids)', { ids: clientIds }).getMany() : [],
      brandIds.length ? this.brandsRepo.findBy(brandIds.map((id) => ({ id }))) : [],
      pmIds.length ? this.employeesRepo.findBy(pmIds.map((id) => ({ id }))) : [],
      this.financialsRepo.findBy(projects.map((p) => ({ projectId: p.id }))),
    ]);

    const clientMap = new Map(clients.map((c) => [c.id, c]));
    const brandMap = new Map(brands.map((b) => [b.id, b]));
    const empMap = new Map(employees.map((e) => [e.id, e]));
    const finMap = new Map(financials.map((f) => [f.projectId, f]));

    return projects.map((p) => {
      const client = p.clientRecordId ? clientMap.get(p.clientRecordId) : null;
      const brand = p.brandId ? brandMap.get(p.brandId) : null;
      const pm = p.projectManagerId ? empMap.get(p.projectManagerId) : null;
      const fin = finMap.get(p.id);
      return {
        ...p,
        clientName: client?.primaryCompany?.name ?? null,
        brandName: brand?.name ?? null,
        projectManagerName: pm?.fullName ?? null,
        projectManagerEmail: pm?.corporateEmail ?? null,
        monthlyFee: fin?.monthlyFee ?? null,
        totalValue: fin?.totalValue ?? null,
        currency: fin?.currency ?? 'MXN',
      };
    });
  }

  // ─── Detalle ─────────────────────────────────────────────────────────────

  async findById(id: string) {
    const project = await this.getOrFail(id);
    const [members, businessUnits, financials, milestones, rawDocs, history] = await Promise.all([
      this.membersRepo.find({ where: { projectId: id }, order: { createdAt: 'ASC' } }),
      this.buRepo.find({ where: { projectId: id } }),
      this.financialsRepo.findOne({ where: { projectId: id } }),
      this.milestonesRepo.find({ where: { projectId: id }, order: { sortOrder: 'ASC', createdAt: 'ASC' } }),
      this.documentsRepo.find({ where: { projectId: id, deletedAt: IsNull() }, order: { uploadedAt: 'DESC' } }),
      this.historyRepo.find({ where: { projectId: id }, order: { createdAt: 'DESC' } }),
    ]);

    const empIds = [...new Set(members.map((m) => m.employeeId))];
    const empMap = empIds.length
      ? new Map((await this.employeesRepo.findBy(empIds.map((id) => ({ id })))).map((e) => [e.id, e]))
      : new Map();

    const enrichedMembers = members.map((m) => {
      const emp = empMap.get(m.employeeId);
      return { ...m, employeeName: emp?.fullName ?? null, employeeEmail: emp?.corporateEmail ?? null };
    });

    const docs = await Promise.all(
      rawDocs.map(async (d) => ({ ...d, downloadUrl: await this.storage.getPresignedUrl(d.s3Key) })),
    );

    const [client, brand, pm] = await Promise.all([
      project.clientRecordId
        ? this.clientsRepo.createQueryBuilder('c').leftJoinAndSelect('c.primaryCompany', 'pc').where('c.id = :id', { id: project.clientRecordId }).getOne()
        : null,
      project.brandId ? this.brandsRepo.findOne({ where: { id: project.brandId } }) : null,
      project.projectManagerId ? this.employeesRepo.findOne({ where: { id: project.projectManagerId } }) : null,
    ]);

    return {
      ...project,
      clientName: client?.primaryCompany?.name ?? null,
      brandName: brand?.name ?? null,
      projectManagerName: pm?.fullName ?? null,
      projectManagerEmail: pm?.corporateEmail ?? null,
      members: enrichedMembers,
      businessUnits,
      financials,
      milestones,
      documents: docs,
      history,
    };
  }

  // ─── Crear ───────────────────────────────────────────────────────────────

  async create(dto: CreateProjectDto, userId: string, userName: string) {
    const displayId = await this.generateDisplayId();
    const project = await this.projectsRepo.save(
      this.projectsRepo.create({
        displayId,
        name: dto.name,
        description: dto.description ?? null,
        projectType: dto.projectType,
        status: dto.status ?? 'active',
        clientRecordId: dto.clientRecordId ?? null,
        brandId: dto.brandId ?? null,
        primaryBusinessUnit: dto.primaryBusinessUnit ?? null,
        projectManagerId: dto.projectManagerId ?? null,
        startDate: dto.startDate ?? null,
        endDate: dto.endDate ?? null,
        pmCode: dto.pmCode ?? null,
        corProjectId: dto.corProjectId ?? null,
        createdBy: userId,
      }),
    );

    if (dto.businessUnits?.length) {
      await this.syncBusinessUnits(project.id, dto.businessUnits);
    }

    await this.addHistory(project.id, userId, userName, 'CREADO', `Proyecto ${displayId} creado`);
    return project;
  }

  // ─── Actualizar ──────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateProjectDto, userId: string, userName: string) {
    const project = await this.getOrFail(id);
    const changed: string[] = [];

    if (dto.name !== undefined && dto.name !== project.name) { project.name = dto.name; changed.push('name'); }
    if (dto.description !== undefined) project.description = dto.description ?? null;
    if (dto.status !== undefined && dto.status !== project.status) { project.status = dto.status; changed.push('status'); }
    if (dto.projectType !== undefined) project.projectType = dto.projectType;
    if (dto.clientRecordId !== undefined) project.clientRecordId = dto.clientRecordId ?? null;
    if (dto.brandId !== undefined) project.brandId = dto.brandId ?? null;
    if (dto.primaryBusinessUnit !== undefined) project.primaryBusinessUnit = dto.primaryBusinessUnit ?? null;
    if (dto.projectManagerId !== undefined) project.projectManagerId = dto.projectManagerId ?? null;
    if (dto.startDate !== undefined) project.startDate = dto.startDate ?? null;
    if (dto.endDate !== undefined) project.endDate = dto.endDate ?? null;
    if (dto.pmCode !== undefined) project.pmCode = dto.pmCode ?? null;
    if (dto.corProjectId !== undefined) project.corProjectId = dto.corProjectId ?? null;

    await this.projectsRepo.save(project);

    if (dto.businessUnits) await this.syncBusinessUnits(id, dto.businessUnits);

    if (changed.length) {
      await this.addHistory(id, userId, userName, 'ACTUALIZADO', `Campos: ${changed.join(', ')}`);
    }

    return project;
  }

  // ─── Eliminar (soft) ─────────────────────────────────────────────────────

  async remove(id: string, userId: string, userName: string) {
    const project = await this.getOrFail(id);
    project.deletedBy = userId;
    await this.projectsRepo.save(project);
    await this.projectsRepo.softDelete(id);
    await this.addHistory(id, userId, userName, 'ELIMINADO', null);
  }

  // ─── Miembros ─────────────────────────────────────────────────────────────

  async addMember(projectId: string, dto: AddMemberDto, userId: string, userName: string) {
    await this.getOrFail(projectId);
    const existing = await this.membersRepo.findOne({ where: { projectId, employeeId: dto.employeeId } });
    if (existing) {
      Object.assign(existing, {
        role: dto.role ?? existing.role,
        estimatedHoursMonthly: dto.estimatedHoursMonthly ?? existing.estimatedHoursMonthly,
        startDate: dto.startDate ?? existing.startDate,
        endDate: dto.endDate ?? existing.endDate,
        isActive: dto.isActive ?? existing.isActive,
      });
      await this.membersRepo.save(existing);
      return existing;
    }
    const member = await this.membersRepo.save(
      this.membersRepo.create({
        projectId,
        employeeId: dto.employeeId,
        role: dto.role ?? null,
        estimatedHoursMonthly: dto.estimatedHoursMonthly ?? null,
        startDate: dto.startDate ?? null,
        endDate: dto.endDate ?? null,
        isActive: dto.isActive ?? true,
      }),
    );
    await this.addHistory(projectId, userId, userName, 'MIEMBRO_AGREGADO', `Empleado ${dto.employeeId}`);
    return member;
  }

  async removeMember(projectId: string, employeeId: string, userId: string, userName: string) {
    await this.getOrFail(projectId);
    await this.membersRepo.delete({ projectId, employeeId });
    await this.addHistory(projectId, userId, userName, 'MIEMBRO_REMOVIDO', `Empleado ${employeeId}`);
  }

  // ─── Financiero ──────────────────────────────────────────────────────────

  async updateFinancials(projectId: string, dto: UpdateFinancialsDto, userId: string, userName: string) {
    await this.getOrFail(projectId);
    let fin = await this.financialsRepo.findOne({ where: { projectId } });
    if (!fin) {
      fin = this.financialsRepo.create({ projectId, ...dto });
    } else {
      Object.assign(fin, dto);
    }
    const saved = await this.financialsRepo.save(fin);
    await this.addHistory(projectId, userId, userName, 'FINANCIERO_ACTUALIZADO', null);
    return saved;
  }

  // ─── Hitos ───────────────────────────────────────────────────────────────

  async addMilestone(projectId: string, dto: AddMilestoneDto, userId: string, userName: string) {
    await this.getOrFail(projectId);
    const milestone = await this.milestonesRepo.save(
      this.milestonesRepo.create({
        projectId,
        name: dto.name,
        amount: dto.amount,
        dueDate: dto.dueDate ?? null,
        notes: dto.notes ?? null,
        sortOrder: dto.sortOrder ?? 0,
      }),
    );
    await this.addHistory(projectId, userId, userName, 'HITO_AGREGADO', dto.name);
    return milestone;
  }

  // ─── Documentos ──────────────────────────────────────────────────────────

  async uploadDocument(
    projectId: string,
    file: Express.Multer.File,
    dto: UploadProjectDocumentDto,
    userId: string,
  ) {
    await this.getOrFail(projectId);
    const s3Key = await this.storage.uploadDocument(file, projectId, dto.type);
    return this.documentsRepo.save(
      this.documentsRepo.create({
        projectId,
        type: dto.type,
        name: dto.name,
        s3Key,
        fileSize: file.size,
        uploadedBy: userId,
      }),
    );
  }

  async getDocuments(projectId: string) {
    await this.getOrFail(projectId);
    const docs = await this.documentsRepo.find({
      where: { projectId, deletedAt: IsNull() },
      order: { uploadedAt: 'DESC' },
    });
    return Promise.all(
      docs.map(async (d) => ({ ...d, downloadUrl: await this.storage.getPresignedUrl(d.s3Key) })),
    );
  }

  // ─── Stats ───────────────────────────────────────────────────────────────

  async getStats() {
    const [total, active, recurring, oneTime, finData] = await Promise.all([
      this.projectsRepo.count({ where: { deletedAt: IsNull() } }),
      this.projectsRepo.count({ where: { status: 'active', deletedAt: IsNull() } }),
      this.projectsRepo.count({ where: { projectType: 'recurring', deletedAt: IsNull() } }),
      this.projectsRepo.count({ where: { projectType: 'one_time', deletedAt: IsNull() } }),
      this.financialsRepo
        .createQueryBuilder('f')
        .innerJoin(ProjectRecord, 'p', 'p.id = f.project_id AND p.deleted_at IS NULL AND p.status = :s', { s: 'active' })
        .select(['SUM(CAST(f.monthly_fee AS DECIMAL)) as monthly', 'SUM(CAST(f.total_value AS DECIMAL)) as total'])
        .getRawOne(),
    ]);

    return {
      total,
      active,
      recurring,
      oneTime,
      totalMonthlyFee: parseFloat(finData?.monthly ?? '0'),
      totalPortfolioValue: parseFloat(finData?.total ?? '0'),
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async getOrFail(id: string) {
    const p = await this.projectsRepo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!p) throw new NotFoundException(`Proyecto ${id} no encontrado`);
    return p;
  }

  private async generateDisplayId(): Promise<string> {
    const result = await this.projectsRepo.query(`SELECT nextval('projects.project_display_id_seq') AS seq`);
    const seq = parseInt((result as { seq: string }[])[0]?.seq ?? '1', 10);
    return `PRY-${String(seq).padStart(4, '0')}`;
  }

  private async syncBusinessUnits(projectId: string, units: BusinessUnitEntryDto[]) {
    await this.buRepo.delete({ projectId });
    if (units.length) {
      await this.buRepo.save(units.map((u) => this.buRepo.create({ projectId, businessUnit: u.businessUnit, percentage: u.percentage })));
    }
  }

  private async addHistory(projectId: string, changedById: string, changedByName: string, action: string, notes: string | null) {
    await this.historyRepo.save(
      this.historyRepo.create({ projectId, changedById, changedByName, action, notes }),
    );
  }
}
