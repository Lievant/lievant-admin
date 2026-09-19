import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { CatalogToolCategory } from '../catalogs/entities/catalog-tool-category.entity';
import {
  BILLING_PERIODS_PER_YEAR,
  TOOL_BILLING_PERIODS,
  TOOL_CATEGORIES_FALLBACK,
  TOOL_CONTRACT_STATUSES,
  TOOL_CURRENCIES,
} from './constants/tools.constants';
import { CreateToolDto } from './dto/create-tool.dto';
import { QueryToolsDto } from './dto/query-tools.dto';
import { UpdateToolDto } from './dto/update-tool.dto';
import { Tool } from './entities/tool.entity';

@Injectable()
export class ToolsService {
  constructor(
    @InjectRepository(Tool) private readonly toolsRepo: Repository<Tool>,
    @InjectRepository(CatalogToolCategory)
    private readonly categoriesRepo: Repository<CatalogToolCategory>,
    private readonly dataSource: DataSource,
  ) {}

  // -------------------------------------------------------------------------
  // Catálogo
  // -------------------------------------------------------------------------

  async findAll(query: QueryToolsDto) {
    const qb = this.toolsRepo
      .createQueryBuilder('t')
      .where('t.deleted_at IS NULL')
      .orderBy('t.tool_code', 'ASC');

    if (query.search) {
      qb.andWhere(
        '(t.name ILIKE :search OR t.provider ILIKE :search OR t.tool_code ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    if (query.category) qb.andWhere('t.category = :category', { category: query.category });
    if (query.contractStatus) {
      qb.andWhere('t.contract_status = :contractStatus', { contractStatus: query.contractStatus });
    }
    if (query.renewingWithinDays !== undefined && !Number.isNaN(query.renewingWithinDays)) {
      qb.andWhere('t.next_renewal_date IS NOT NULL').andWhere(
        `t.next_renewal_date <= CURRENT_DATE + (:days || ' days')::interval`,
        { days: query.renewingWithinDays },
      );
    }

    const tools = await qb.getMany();
    return tools.map((tool) => this.toDto(tool));
  }

  /**
   * Opciones del formulario. Las categorías vienen del catálogo editable; si
   * está vacío se cae a la semilla para que el alta no quede sin opciones.
   */
  async getOptions() {
    const categories = await this.listCategoryNames();
    return {
      categories: categories.length ? categories : [...TOOL_CATEGORIES_FALLBACK],
      currencies: [...TOOL_CURRENCIES],
      billingPeriods: [...TOOL_BILLING_PERIODS],
      contractStatuses: [...TOOL_CONTRACT_STATUSES],
    };
  }

  private async listCategoryNames(): Promise<string[]> {
    const rows = await this.categoriesRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    return rows.map((r) => r.name);
  }

  /**
   * La categoría se valida contra el catálogo en vez de contra un @IsIn: la
   * lista es editable desde /admin/catalogos y congelarla en el DTO obligaría
   * a un deploy por cada categoría nueva. Si el catálogo está vacío se acepta
   * cualquier valor, para no bloquear el alta por una siembra pendiente.
   */
  private async assertCategory(category: string) {
    const names = await this.listCategoryNames();
    if (names.length && !names.includes(category)) {
      throw new BadRequestException(
        `Categoría "${category}" no existe en el catálogo. Opciones: ${names.join(', ')}.`,
      );
    }
  }

  async findOne(id: string) {
    const tool = await this.toolsRepo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!tool) throw new NotFoundException(`Herramienta ${id} no encontrada`);
    return this.toDto(tool);
  }

  async create(dto: CreateToolDto, userId: string) {
    await this.assertCategory(dto.category);

    return this.dataSource.transaction(async (manager) => {
      const toolCode = await this.nextToolCode(manager);

      const tool = manager.create(Tool, {
        toolCode,
        name: dto.name,
        category: dto.category,
        provider: dto.provider,
        description: dto.description ?? null,
        url: null,
        unitCost: dto.unitCost ?? 0,
        currency: dto.currency ?? 'MXN',
        billingPeriod: dto.billingPeriod,
        billingDay: dto.billingDay ?? null,
        commercialContact: dto.commercialContact ?? null,
        nextRenewalDate: dto.nextRenewalDate ?? null,
        contractStatus: dto.contractStatus ?? 'activo',
        requiresApproval: dto.requiresApproval ?? false,
        totalCostCalculated: 0,
        activeAssignmentsCount: 0,
        createdBy: userId,
        updatedBy: userId,
      });

      const saved = await manager.save(Tool, tool);
      return this.toDto(saved);
    });
  }

  async update(id: string, dto: UpdateToolDto, userId: string) {
    if (dto.category !== undefined) await this.assertCategory(dto.category);

    return this.dataSource.transaction(async (manager) => {
      const tool = await manager.findOne(Tool, { where: { id, deletedAt: IsNull() } });
      if (!tool) throw new NotFoundException(`Herramienta ${id} no encontrada`);

      Object.assign(tool, {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.provider !== undefined && { provider: dto.provider }),
        ...(dto.description !== undefined && { description: dto.description ?? null }),
        ...(dto.unitCost !== undefined && { unitCost: dto.unitCost }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.billingPeriod !== undefined && { billingPeriod: dto.billingPeriod }),
        ...(dto.billingDay !== undefined && { billingDay: dto.billingDay ?? null }),
        ...(dto.commercialContact !== undefined && {
          commercialContact: dto.commercialContact ?? null,
        }),
        ...(dto.nextRenewalDate !== undefined && { nextRenewalDate: dto.nextRenewalDate ?? null }),
        ...(dto.contractStatus !== undefined && { contractStatus: dto.contractStatus }),
        ...(dto.requiresApproval !== undefined && { requiresApproval: dto.requiresApproval }),
        updatedBy: userId,
      });

      await manager.save(Tool, tool);

      // El costo unitario entra en el total, que mantiene AssignmentsService
      // (es quien conoce las asignaciones vivas); aquí solo se reproyecta.
      if (dto.unitCost !== undefined) {
        await manager.query(
          `UPDATE tools.tools SET total_cost_calculated = (unit_cost * active_assignments_count)::numeric(14,2) WHERE id = $1`,
          [id],
        );
      }

      const fresh = await manager.findOneOrFail(Tool, { where: { id } });
      return this.toDto(fresh);
    });
  }

  /**
   * Baja lógica. Una herramienta con asignaciones vivas no se borra: su costo
   * sigue corriendo y borrarla dejaría el gasto sin dueño en los reportes.
   */
  async remove(id: string, userId: string) {
    const tool = await this.toolsRepo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!tool) throw new NotFoundException(`Herramienta ${id} no encontrada`);

    if (tool.activeAssignmentsCount > 0) {
      throw new BadRequestException(
        `La herramienta tiene ${tool.activeAssignmentsCount} asignación(es) activa(s). Revócalas antes de eliminarla.`,
      );
    }

    tool.updatedBy = userId;
    await this.toolsRepo.save(tool);
    await this.toolsRepo.softDelete(id);
    return { id, deleted: true };
  }

  // -------------------------------------------------------------------------
  // Estadísticas
  // -------------------------------------------------------------------------

  async getStats() {
    const tools = await this.toolsRepo.find({ where: { deletedAt: IsNull() } });

    // Las categorías del catálogo se siembran en 0 para que una recién creada
    // aparezca en el desglose aunque todavía no tenga herramientas.
    const categoryNames = await this.listCategoryNames();

    const stats = {
      total: tools.length,
      byContractStatus: {} as Record<string, number>,
      byCategory: Object.fromEntries(categoryNames.map((n) => [n, 0])) as Record<string, number>,
      activeAssignments: 0,
      // Gasto anualizado por moneda: sumar MXN y USD en un solo número exigiría
      // un tipo de cambio que el módulo no tiene, y daría una cifra falsa.
      annualCostByCurrency: {} as Record<string, number>,
      monthlyCostByCurrency: {} as Record<string, number>,
      renewingIn30Days: 0,
    };

    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);

    for (const tool of tools) {
      stats.byContractStatus[tool.contractStatus] =
        (stats.byContractStatus[tool.contractStatus] ?? 0) + 1;
      stats.byCategory[tool.category] = (stats.byCategory[tool.category] ?? 0) + 1;
      stats.activeAssignments += tool.activeAssignmentsCount;

      if (tool.contractStatus === 'cancelado') continue;

      const perYear = BILLING_PERIODS_PER_YEAR[tool.billingPeriod] ?? 0;
      const annual = tool.totalCostCalculated * perYear;
      stats.annualCostByCurrency[tool.currency] =
        (stats.annualCostByCurrency[tool.currency] ?? 0) + annual;
      stats.monthlyCostByCurrency[tool.currency] =
        (stats.monthlyCostByCurrency[tool.currency] ?? 0) + annual / 12;

      if (tool.nextRenewalDate && new Date(tool.nextRenewalDate) <= in30) {
        stats.renewingIn30Days += 1;
      }
    }

    for (const currency of Object.keys(stats.annualCostByCurrency)) {
      stats.annualCostByCurrency[currency] = round2(stats.annualCostByCurrency[currency] ?? 0);
      stats.monthlyCostByCurrency[currency] = round2(stats.monthlyCostByCurrency[currency] ?? 0);
    }

    return stats;
  }

  // -------------------------------------------------------------------------
  // Internos
  // -------------------------------------------------------------------------

  /** Folio HTA-###. Sale de la secuencia para no reutilizar códigos emitidos. */
  private async nextToolCode(manager: EntityManager): Promise<string> {
    const rows = await manager.query(`SELECT nextval('tools.tool_number_seq') AS value`);
    const value = Number(rows[0].value);
    return `HTA-${String(value).padStart(3, '0')}`;
  }

  private toDto(tool: Tool) {
    const perYear = BILLING_PERIODS_PER_YEAR[tool.billingPeriod] ?? 0;
    const annualCost = round2(tool.totalCostCalculated * perYear);

    return {
      id: tool.id,
      toolCode: tool.toolCode,
      name: tool.name,
      category: tool.category,
      provider: tool.provider,
      description: tool.description,
      unitCost: tool.unitCost,
      currency: tool.currency,
      billingPeriod: tool.billingPeriod,
      billingDay: tool.billingDay,
      commercialContact: tool.commercialContact,
      nextRenewalDate: tool.nextRenewalDate,
      contractStatus: tool.contractStatus,
      requiresApproval: tool.requiresApproval,
      totalCostCalculated: tool.totalCostCalculated,
      activeAssignmentsCount: tool.activeAssignmentsCount,
      annualCost,
      monthlyCost: round2(annualCost / 12),
      createdAt: tool.createdAt,
      updatedAt: tool.updatedAt,
    };
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
