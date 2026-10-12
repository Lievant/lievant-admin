import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { todayInMexico } from '../../common/business-date';
import { User } from '../auth/entities/user.entity';
import { CreateRiskDto, UpdateRiskDto } from './dto/risk.dto';
import { Risk } from './entities/risk.entity';
import { calculateRisk, RiskLevel } from './risk-calculation';

export interface RiskItem {
  id: string;
  category: string;
  threat: string;
  vulnerability: string;
  affectedAsset: string;
  risk: string;
  vulnerabilityScore: number;
  severityScore: number;
  probabilityScore: number;
  riskValue: number;
  control: string;
  controlEfficacy: number;
  residualRisk: number;
  level: RiskLevel;
  reportedAt: string | null;
  mitigationStrategy: string | null;
  actions: string | null;
  estimatedResolutionDate: string | null;
  owner: string;
  actionStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface RiskList {
  data: RiskItem[];
  /** Máximo `updated_at` de los riesgos activos; null si no hay ninguno. */
  lastUpdate: string | null;
}

/** Texto vacío o solo espacios se guarda como null en los campos opcionales. */
function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

@Injectable()
export class RisksService {
  constructor(@InjectRepository(Risk) private readonly risksRepo: Repository<Risk>) {}

  private toItem(r: Risk): RiskItem {
    return {
      id: r.id,
      category: r.category,
      threat: r.threat,
      vulnerability: r.vulnerability,
      affectedAsset: r.affectedAsset,
      risk: r.risk,
      vulnerabilityScore: r.vulnerabilityScore,
      severityScore: r.severityScore,
      probabilityScore: r.probabilityScore,
      riskValue: r.riskValue,
      control: r.control,
      controlEfficacy: r.controlEfficacy,
      residualRisk: r.residualRisk,
      level: calculateRisk(
        r.vulnerabilityScore,
        r.severityScore,
        r.probabilityScore,
        r.controlEfficacy,
      ).level,
      reportedAt: r.reportedAt,
      mitigationStrategy: r.mitigationStrategy,
      actions: r.actions,
      estimatedResolutionDate: r.estimatedResolutionDate,
      owner: r.owner,
      actionStatus: r.actionStatus,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  private async findActiveOrFail(id: string): Promise<Risk> {
    const risk = await this.risksRepo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!risk) throw new NotFoundException('Riesgo no encontrado.');
    return risk;
  }

  /** Todos los activos, sin paginar: la tabla ordena en el cliente. */
  async list(): Promise<RiskList> {
    const rows = await this.risksRepo.find({
      where: { deletedAt: IsNull() },
      order: { updatedAt: 'DESC' },
    });
    const last = rows.reduce<Date | null>(
      (max, r) => (max === null || r.updatedAt > max ? r.updatedAt : max),
      null,
    );
    return { data: rows.map((r) => this.toItem(r)), lastUpdate: last?.toISOString() ?? null };
  }

  async get(id: string): Promise<RiskItem> {
    return this.toItem(await this.findActiveOrFail(id));
  }

  async create(dto: CreateRiskDto, user: User): Promise<RiskItem> {
    const { riskValue, residualRisk } = calculateRisk(
      dto.vulnerabilityScore,
      dto.severityScore,
      dto.probabilityScore,
      dto.controlEfficacy,
    );

    const saved = await this.risksRepo.save(
      this.risksRepo.create({
        category: dto.category,
        threat: dto.threat,
        vulnerability: dto.vulnerability,
        affectedAsset: dto.affectedAsset,
        risk: dto.risk,
        vulnerabilityScore: dto.vulnerabilityScore,
        severityScore: dto.severityScore,
        probabilityScore: dto.probabilityScore,
        riskValue,
        control: dto.control,
        controlEfficacy: dto.controlEfficacy,
        residualRisk,
        reportedAt: dto.reportedAt ?? todayInMexico(),
        mitigationStrategy: emptyToNull(dto.mitigationStrategy),
        actions: emptyToNull(dto.actions),
        estimatedResolutionDate: dto.estimatedResolutionDate ?? null,
        owner: dto.owner,
        actionStatus: dto.actionStatus,
        createdBy: user.id,
        updatedBy: user.id,
      }),
    );
    return this.toItem(saved);
  }

  async update(id: string, dto: UpdateRiskDto, user: User): Promise<RiskItem> {
    const risk = await this.findActiveOrFail(id);

    if (dto.category !== undefined) risk.category = dto.category;
    if (dto.threat !== undefined) risk.threat = dto.threat;
    if (dto.vulnerability !== undefined) risk.vulnerability = dto.vulnerability;
    if (dto.affectedAsset !== undefined) risk.affectedAsset = dto.affectedAsset;
    if (dto.risk !== undefined) risk.risk = dto.risk;
    if (dto.vulnerabilityScore !== undefined) risk.vulnerabilityScore = dto.vulnerabilityScore;
    if (dto.severityScore !== undefined) risk.severityScore = dto.severityScore;
    if (dto.probabilityScore !== undefined) risk.probabilityScore = dto.probabilityScore;
    if (dto.control !== undefined) risk.control = dto.control;
    if (dto.controlEfficacy !== undefined) risk.controlEfficacy = dto.controlEfficacy;
    if (dto.owner !== undefined) risk.owner = dto.owner;
    if (dto.actionStatus !== undefined) risk.actionStatus = dto.actionStatus;
    if (dto.reportedAt !== undefined) risk.reportedAt = dto.reportedAt;
    if (dto.mitigationStrategy !== undefined) risk.mitigationStrategy = emptyToNull(dto.mitigationStrategy);
    if (dto.actions !== undefined) risk.actions = emptyToNull(dto.actions);
    if (dto.estimatedResolutionDate !== undefined) {
      risk.estimatedResolutionDate = dto.estimatedResolutionDate;
    }

    // Siempre se recalculan con los valores resultantes, nunca con lo que mande el cliente.
    const { riskValue, residualRisk } = calculateRisk(
      risk.vulnerabilityScore,
      risk.severityScore,
      risk.probabilityScore,
      risk.controlEfficacy,
    );
    risk.riskValue = riskValue;
    risk.residualRisk = residualRisk;
    risk.updatedBy = user.id;

    return this.toItem(await this.risksRepo.save(risk));
  }

  /** Baja lógica: el registro se conserva y deja de listarse. */
  async remove(id: string, user: User): Promise<{ deleted: true }> {
    const risk = await this.findActiveOrFail(id);
    risk.deletedAt = new Date();
    risk.deletedBy = user.id;
    risk.updatedBy = user.id;
    await this.risksRepo.save(risk);
    return { deleted: true };
  }
}
