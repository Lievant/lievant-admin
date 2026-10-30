import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogCompetency } from '../entities/catalog-competency.entity';
import { CreateCompetencyDto, UpdateCompetencyDto } from './competencies.dto';
import { cleanDescription, cleanName, nameKey } from './competencies.util';

export interface CompetencyRecord {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export const toCompetencyRecord = (c: CatalogCompetency): CompetencyRecord => ({
  id: c.id,
  name: c.name,
  description: c.description ?? null,
  isActive: c.isActive,
  sortOrder: c.sortOrder,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

const ORDER = { sortOrder: 'ASC', name: 'ASC' } as const;

/**
 * Catálogo de Competencias. La eliminación es lógica (`deleted_at`): las eliminadas no salen en la lista ni en
 * `/active`, y su nombre queda libre para recrearla.
 */
@Injectable()
export class CompetenciesService {
  constructor(@InjectRepository(CatalogCompetency) private readonly repo: Repository<CatalogCompetency>) {}

  async findAll(): Promise<CompetencyRecord[]> {
    return (await this.repo.find({ order: ORDER })).map(toCompetencyRecord);
  }

  async findActive(): Promise<CompetencyRecord[]> {
    return (await this.repo.find({ where: { isActive: true }, order: ORDER })).map(toCompetencyRecord);
  }

  async create(dto: CreateCompetencyDto): Promise<CompetencyRecord> {
    const name = cleanName(dto.name);
    if (name === '') throw new BadRequestException('El nombre es obligatorio.');
    await this.assertNameFree(name);
    const record = this.repo.create({
      name,
      description: cleanDescription(dto.description),
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
    });
    return toCompetencyRecord(await this.save(record, name));
  }

  async update(id: string, dto: UpdateCompetencyDto): Promise<CompetencyRecord> {
    const record = await this.getOrFail(id);
    if (dto.name !== undefined) {
      const name = cleanName(dto.name);
      if (name === '') throw new BadRequestException('El nombre es obligatorio.');
      if (nameKey(name) !== nameKey(record.name)) await this.assertNameFree(name, id);
      record.name = name;
    }
    if (dto.description !== undefined) record.description = cleanDescription(dto.description);
    if (dto.sortOrder !== undefined) record.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) record.isActive = dto.isActive;
    return toCompetencyRecord(await this.save(record, record.name));
  }

  /** Igual que el resto de catálogos: el DELETE genérico solo desactiva (se reactiva con `update({ isActive: true })`). */
  async deactivate(id: string): Promise<void> {
    const record = await this.getOrFail(id);
    record.isActive = false;
    await this.repo.save(record);
  }

  /** Eliminación lógica. Deja de salir en la lista y en `/active`; su nombre queda libre. */
  async remove(id: string): Promise<void> {
    const record = await this.getOrFail(id);
    // PUNTO DE EXTENSIÓN: cuando otros módulos liguen competencias por id (puestos, OKRs, capacitaciones…), aquí se
    // debe bloquear la eliminación si la competencia está en uso (409 con el módulo que la usa). Hoy nada la usa.
    record.deletedAt = new Date();
    await this.repo.save(record);
  }

  private async getOrFail(id: string): Promise<CatalogCompetency> {
    const record = await this.repo.findOne({ where: { id } });
    if (!record) throw new NotFoundException(`Competencia ${id} no encontrada.`);
    return record;
  }

  /** Sin duplicados entre las no eliminadas, sin importar mayúsculas, acentos ni espacios extra. */
  private async assertNameFree(name: string, exceptId?: string): Promise<void> {
    const key = nameKey(name);
    const all = await this.repo.find();
    const clash = all.find((c) => c.id !== exceptId && nameKey(c.name) === key);
    if (clash) throw new ConflictException(`Ya existe una competencia con el nombre «${clash.name}».`);
  }

  /** El índice único parcial es la última defensa contra dos altas simultáneas. */
  private async save(record: CatalogCompetency, name: string): Promise<CatalogCompetency> {
    try {
      return await this.repo.save(record);
    } catch (err) {
      if ((err as { code?: string }).code === '23505') throw new ConflictException(`Ya existe una competencia con el nombre «${name}».`);
      throw err;
    }
  }
}
