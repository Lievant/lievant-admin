import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogEntityName, isCatalogEntityName } from './constants/catalog-entity.constant';
import { CreateCatalogItemDto, UpdateCatalogItemDto } from './dto/catalog-item.dto';
import { CatalogArea } from './entities/catalog-area.entity';
import { CatalogBloodType } from './entities/catalog-blood-type.entity';
import { CatalogCompany } from './entities/catalog-company.entity';
import { CatalogContractSchema } from './entities/catalog-contract-schema.entity';
import { CatalogContractType } from './entities/catalog-contract-type.entity';
import { CatalogDivision } from './entities/catalog-division.entity';
import { CatalogDocumentType } from './entities/catalog-document-type.entity';
import { CatalogIndustry } from './entities/catalog-industry.entity';
import { CatalogLocation } from './entities/catalog-location.entity';
import { CatalogMaritalStatus } from './entities/catalog-marital-status.entity';
import { CatalogModality } from './entities/catalog-modality.entity';
import { CatalogOrgLevel } from './entities/catalog-org-level.entity';
import { CatalogVendorCategory } from './entities/catalog-vendor-category.entity';
import { CatalogEmployeeDocumentType } from './entities/catalog-employee-document-type.entity';

export interface CatalogRecord {
  id: string;
  name: string;
  code?: string;
  country?: string;
  companyCode?: string | null;
  divisionName?: string | null;
  appliesTo?: string;
  isRequired?: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class CatalogsService {
  private readonly repositories: Record<CatalogEntityName, Repository<CatalogRecord>>;

  constructor(
    @InjectRepository(CatalogCompany) companies: Repository<CatalogCompany>,
    @InjectRepository(CatalogLocation) locations: Repository<CatalogLocation>,
    @InjectRepository(CatalogModality) modalities: Repository<CatalogModality>,
    @InjectRepository(CatalogDivision) divisions: Repository<CatalogDivision>,
    @InjectRepository(CatalogArea) areas: Repository<CatalogArea>,
    @InjectRepository(CatalogContractSchema) contractSchemas: Repository<CatalogContractSchema>,
    @InjectRepository(CatalogContractType) contractTypes: Repository<CatalogContractType>,
    @InjectRepository(CatalogOrgLevel) orgLevels: Repository<CatalogOrgLevel>,
    @InjectRepository(CatalogBloodType) bloodTypes: Repository<CatalogBloodType>,
    @InjectRepository(CatalogMaritalStatus) maritalStatuses: Repository<CatalogMaritalStatus>,
    @InjectRepository(CatalogIndustry) industries: Repository<CatalogIndustry>,
    @InjectRepository(CatalogDocumentType) documentTypes: Repository<CatalogDocumentType>,
    @InjectRepository(CatalogVendorCategory) vendorCategories: Repository<CatalogVendorCategory>,
    @InjectRepository(CatalogEmployeeDocumentType) employeeDocumentTypes: Repository<CatalogEmployeeDocumentType>,
  ) {
    this.repositories = {
      companies: companies as unknown as Repository<CatalogRecord>,
      locations: locations as unknown as Repository<CatalogRecord>,
      modalities: modalities as unknown as Repository<CatalogRecord>,
      divisions: divisions as unknown as Repository<CatalogRecord>,
      areas: areas as unknown as Repository<CatalogRecord>,
      contract_schemas: contractSchemas as unknown as Repository<CatalogRecord>,
      contract_types: contractTypes as unknown as Repository<CatalogRecord>,
      org_levels: orgLevels as unknown as Repository<CatalogRecord>,
      blood_types: bloodTypes as unknown as Repository<CatalogRecord>,
      marital_statuses: maritalStatuses as unknown as Repository<CatalogRecord>,
      industries: industries as unknown as Repository<CatalogRecord>,
      document_types: documentTypes as unknown as Repository<CatalogRecord>,
      vendor_categories: vendorCategories as unknown as Repository<CatalogRecord>,
      employee_document_types: employeeDocumentTypes as unknown as Repository<CatalogRecord>,
    };
  }

  async findAll(entity: string, appliesTo?: string): Promise<CatalogRecord[]> {
    const repo = this.getRepository(entity);
    return repo.find({ where: { ...(appliesTo ? { appliesTo } : {}) }, order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  async findActive(entity: string, appliesTo?: string): Promise<CatalogRecord[]> {
    const repo = this.getRepository(entity);
    return repo.find({ where: { isActive: true, ...(appliesTo ? { appliesTo } : {}) }, order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  async create(entity: string, dto: CreateCatalogItemDto): Promise<CatalogRecord> {
    const repo = this.getRepository(entity);

    const data: Partial<CatalogRecord> = { name: dto.name };
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.country !== undefined) data.country = dto.country;
    if (dto.companyCode !== undefined) data.companyCode = dto.companyCode;
    if (dto.divisionName !== undefined) data.divisionName = dto.divisionName;
    if (dto.appliesTo !== undefined) data.appliesTo = dto.appliesTo;
    if (dto.isRequired !== undefined) data.isRequired = dto.isRequired;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    return repo.save(repo.create(data));
  }

  async update(entity: string, id: string, dto: UpdateCatalogItemDto): Promise<CatalogRecord> {
    const repo = this.getRepository(entity);
    const record = await this.getRecordOrFail(repo, entity, id);

    if (dto.name !== undefined) record.name = dto.name;
    if (dto.code !== undefined) record.code = dto.code;
    if (dto.country !== undefined) record.country = dto.country;
    if (dto.companyCode !== undefined) record.companyCode = dto.companyCode;
    if (dto.divisionName !== undefined) record.divisionName = dto.divisionName;
    if (dto.appliesTo !== undefined) record.appliesTo = dto.appliesTo;
    if (dto.isRequired !== undefined) record.isRequired = dto.isRequired;
    if (dto.isActive !== undefined) record.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) record.sortOrder = dto.sortOrder;

    return repo.save(record);
  }

  async deactivate(entity: string, id: string): Promise<void> {
    const repo = this.getRepository(entity);
    const record = await this.getRecordOrFail(repo, entity, id);

    record.isActive = false;
    await repo.save(record);
  }

  private getRepository(entity: string): Repository<CatalogRecord> {
    if (!isCatalogEntityName(entity)) {
      throw new BadRequestException(`Catálogo desconocido: ${entity}`);
    }
    return this.repositories[entity];
  }

  private async getRecordOrFail(repo: Repository<CatalogRecord>, entity: string, id: string): Promise<CatalogRecord> {
    const record = await repo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException(`Elemento ${id} no encontrado en el catálogo ${entity}`);
    }
    return record;
  }
}
