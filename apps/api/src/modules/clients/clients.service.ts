import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { CatalogDocumentType } from '../catalogs/entities/catalog-document-type.entity';
import { ClientStatus } from './constants/client-status.constant';
import { DocumentStatus } from './constants/document-status.constant';
import { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto';
import { ClientCreationType, CreateClientDto } from './dto/create-client.dto';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';
import { UploadDocumentDto } from './dto/document.dto';
import { UpdateFinancialDto } from './dto/financial.dto';
import { QueryClientsDto } from './dto/query-clients.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { DocumentStorageService } from './document-storage.service';
import { Brand } from './entities/brand.entity';
import { ClientDocument } from './entities/client-document.entity';
import { ClientRecord } from './entities/client-record.entity';
import { Company } from './entities/company.entity';
import { Contact } from './entities/contact.entity';
import { FinancialData } from './entities/financial-data.entity';
import { Group } from './entities/group.entity';
import { ClientListItem, DocStatus, PaginatedResult } from './interfaces/client-list-item.interface';
import { decodeCursor, encodeCursor } from './utils/cursor.util';

export interface MissingDocumentReportItem {
  clientId: string;
  displayId: string;
  companyName: string;
  requiredDocs: string[];
  uploadedDocs: string[];
  missingDocs: string[];
  completionPct: number;
}

export interface ClientDetail extends ClientRecord {
  companies: Company[];
  brands: Brand[];
  contacts: Contact[];
}

export interface ClientDocumentWithUrl extends ClientDocument {
  downloadUrl?: string;
}

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(ClientRecord) private readonly clientsRepository: Repository<ClientRecord>,
    @InjectRepository(Group) private readonly groupsRepository: Repository<Group>,
    @InjectRepository(Company) private readonly companiesRepository: Repository<Company>,
    @InjectRepository(Brand) private readonly brandsRepository: Repository<Brand>,
    @InjectRepository(FinancialData) private readonly financialRepository: Repository<FinancialData>,
    @InjectRepository(ClientDocument) private readonly documentsRepository: Repository<ClientDocument>,
    @InjectRepository(Contact) private readonly contactsRepository: Repository<Contact>,
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    @InjectRepository(CatalogDocumentType)
    private readonly catalogDocTypesRepository: Repository<CatalogDocumentType>,
    private readonly documentStorageService: DocumentStorageService,
  ) {}

  async findAll(query: QueryClientsDto): Promise<PaginatedResult<ClientListItem>> {
    const limit = query.limit ?? 10;
    const filterByDocStatus = !!query.docStatus;

    const qb = this.clientsRepository
      .createQueryBuilder('client')
      .leftJoinAndSelect('client.group', 'group')
      .leftJoinAndSelect('client.primaryCompany', 'primaryCompany')
      .leftJoinAndSelect('client.accountManager', 'accountManager')
      .orderBy('client.createdAt', 'DESC')
      .addOrderBy('client.id', 'DESC');

    if (!filterByDocStatus) {
      qb.take(limit + 1);
    }

    if (query.status) {
      qb.andWhere('client.status = :status', { status: query.status });
    }

    if (query.accountManagerId) {
      qb.andWhere('client.accountManagerId = :accountManagerId', { accountManagerId: query.accountManagerId });
    }

    if (query.industry) {
      qb.andWhere('primaryCompany.industry = :industry', { industry: query.industry });
    }

    if (query.search) {
      qb.andWhere(
        '(client.displayId ILIKE :search OR primaryCompany.name ILIKE :search OR group.name ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (!filterByDocStatus && query.cursor) {
      const cursor = decodeCursor(query.cursor);
      qb.andWhere(
        '(client.createdAt < :cursorCreatedAt OR (client.createdAt = :cursorCreatedAt AND client.id < :cursorId))',
        { cursorCreatedAt: cursor.createdAt, cursorId: cursor.id },
      );
    }

    const records = await qb.getMany();

    if (filterByDocStatus) {
      const allItems = await this.buildListItems(records);
      const filtered = allItems.filter((item) => item.docStatus === query.docStatus);
      return { data: filtered, nextCursor: null };
    }

    const hasMore = records.length > limit;
    const page = hasMore ? records.slice(0, limit) : records;

    const data = await this.buildListItems(page);

    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null;

    return { data, nextCursor };
  }

  async create(dto: CreateClientDto): Promise<ClientDetail> {
    if (dto.accountManagerId) {
      await this.assertUserExists(dto.accountManagerId);
    }

    if (dto.company.rfc) {
      await this.assertRfcAvailable(dto.company.rfc);
    }

    let group: Group | null = null;
    if (dto.type === ClientCreationType.GROUP) {
      if (!dto.groupName?.trim()) {
        throw new BadRequestException('El nombre del grupo es obligatorio para clientes tipo grupo económico');
      }
      group = await this.groupsRepository.save(this.groupsRepository.create({ name: dto.groupName.trim() }));
    }

    const company = await this.companiesRepository.save(
      this.companiesRepository.create({
        groupId: group?.id ?? null,
        name: dto.company.name,
        legalName: dto.company.legalName ?? null,
        rfc: dto.company.rfc ?? null,
        industry: dto.industry ?? null,
      }),
    );

    await this.brandsRepository.save(
      this.brandsRepository.create({
        companyId: company.id,
        name: dto.brand?.name?.trim() || company.name,
      }),
    );

    const displayId = await this.generateDisplayId();

    const clientRecord = await this.clientsRepository.save(
      this.clientsRepository.create({
        displayId,
        groupId: group?.id ?? null,
        primaryCompanyId: company.id,
        status: dto.status ?? ClientStatus.ACTIVE,
        accountManagerId: dto.accountManagerId ?? null,
        notes: dto.notes ?? null,
      }),
    );

    return this.findOne(clientRecord.id);
  }

  async findOne(id: string): Promise<ClientDetail> {
    const record = await this.clientsRepository.findOne({
      where: { id },
      relations: { group: true, primaryCompany: true, accountManager: true },
      withDeleted: true,
    });

    if (!record) {
      throw new NotFoundException(`Cliente ${id} no encontrado`);
    }

    const { companies, brands } = await this.getCompaniesAndBrands(record);
    const contacts = await this.contactsRepository.find({
      where: { clientRecordId: record.id },
      order: { createdAt: 'ASC' },
    });

    return { ...record, companies, brands, contacts };
  }

  async update(id: string, dto: UpdateClientDto): Promise<ClientDetail> {
    const record = await this.getClientOrFail(id);

    if (dto.accountManagerId !== undefined) {
      if (dto.accountManagerId) {
        await this.assertUserExists(dto.accountManagerId);
      }
      record.accountManagerId = dto.accountManagerId ?? null;
    }

    if (dto.status !== undefined) record.status = dto.status;
    if (dto.notes !== undefined) record.notes = dto.notes;
    if (dto.crmId !== undefined) record.crmId = dto.crmId;
    if (dto.corId !== undefined) record.corId = dto.corId;
    if (dto.contpaqId !== undefined) record.contpaqId = dto.contpaqId;
    if (dto.segment !== undefined) record.segment = dto.segment;
    if (dto.npsScore !== undefined) record.npsScore = dto.npsScore;
    if (dto.lastContactDate !== undefined) record.lastContactDate = dto.lastContactDate;
    if (dto.dynamicsId !== undefined) record.dynamicsId = dto.dynamicsId;
    if (dto.website !== undefined) record.website = dto.website;
    if (dto.linkedin !== undefined) record.linkedin = dto.linkedin;
    if (dto.country !== undefined) record.country = dto.country;
    if (dto.city !== undefined) record.city = dto.city;
    if (dto.address !== undefined) record.address = dto.address;

    await this.clientsRepository.save(record);

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.getClientOrFail(id);
    await this.clientsRepository.softDelete(id);
  }

  async listCompanies(clientId: string): Promise<{ companies: Company[]; brands: Brand[] }> {
    const record = await this.getClientOrFail(clientId);
    return this.getCompaniesAndBrands(record);
  }

  async addCompany(clientId: string, dto: CreateCompanyDto): Promise<Company> {
    const record = await this.getClientOrFail(clientId);

    if (!record.groupId) {
      throw new BadRequestException('Solo los clientes con grupo económico pueden tener varias empresas');
    }

    if (dto.rfc) {
      await this.assertRfcAvailable(dto.rfc);
    }

    return this.companiesRepository.save(
      this.companiesRepository.create({
        groupId: record.groupId,
        name: dto.name,
        legalName: dto.legalName ?? null,
        rfc: dto.rfc ?? null,
        industry: dto.industry ?? null,
      }),
    );
  }

  async updateCompany(companyId: string, dto: UpdateCompanyDto): Promise<Company> {
    const company = await this.companiesRepository.findOne({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException(`Empresa ${companyId} no encontrada`);
    }

    if (dto.rfc !== undefined && dto.rfc !== company.rfc) {
      if (dto.rfc) {
        await this.assertRfcAvailable(dto.rfc);
      }
      company.rfc = dto.rfc ?? null;
    }

    if (dto.name !== undefined) company.name = dto.name;
    if (dto.legalName !== undefined) company.legalName = dto.legalName ?? null;
    if (dto.industry !== undefined) company.industry = dto.industry ?? null;

    return this.companiesRepository.save(company);
  }

  async addBrand(companyId: string, dto: CreateBrandDto): Promise<Brand> {
    const company = await this.companiesRepository.findOne({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException(`Empresa ${companyId} no encontrada`);
    }

    return this.brandsRepository.save(this.brandsRepository.create({ companyId, name: dto.name }));
  }

  async updateBrand(brandId: string, dto: UpdateBrandDto): Promise<Brand> {
    const brand = await this.brandsRepository.findOne({ where: { id: brandId } });
    if (!brand) {
      throw new NotFoundException(`Marca ${brandId} no encontrada`);
    }

    if (dto.name !== undefined) brand.name = dto.name;

    return this.brandsRepository.save(brand);
  }

  async getFinancial(clientId: string): Promise<FinancialData | null> {
    await this.getClientOrFail(clientId);
    return this.financialRepository.findOne({ where: { clientRecordId: clientId } });
  }

  async updateFinancial(clientId: string, dto: UpdateFinancialDto): Promise<FinancialData> {
    await this.getClientOrFail(clientId);

    let financial = await this.financialRepository.findOne({ where: { clientRecordId: clientId } });
    if (!financial) {
      financial = this.financialRepository.create({ clientRecordId: clientId });
    }

    if (dto.paymentDays !== undefined) financial.paymentDays = dto.paymentDays;
    if (dto.billingEmail !== undefined) financial.billingEmail = dto.billingEmail;
    if (dto.billingContact !== undefined) financial.billingContact = dto.billingContact;
    if (dto.creditLimit !== undefined) financial.creditLimit = dto.creditLimit.toFixed(2);
    if (dto.currency !== undefined) financial.currency = dto.currency;
    if (dto.paymentMethod !== undefined) financial.paymentMethod = dto.paymentMethod;
    if (dto.satPaymentMethod !== undefined) financial.satPaymentMethod = dto.satPaymentMethod;
    if (dto.satPaymentForm !== undefined) financial.satPaymentForm = dto.satPaymentForm;
    if (dto.satCfdiUse !== undefined) financial.satCfdiUse = dto.satCfdiUse;
    if (dto.satTaxRegime !== undefined) financial.satTaxRegime = dto.satTaxRegime;
    if (dto.bankName !== undefined) financial.bankName = dto.bankName;
    if (dto.bankAccount !== undefined) financial.bankAccount = dto.bankAccount;
    if (dto.bankClabe !== undefined) financial.bankClabe = dto.bankClabe;
    if (dto.contractStartDate !== undefined) financial.contractStartDate = dto.contractStartDate;
    if (dto.contractEndDate !== undefined) financial.contractEndDate = dto.contractEndDate;
    if (dto.autoRenewal !== undefined) financial.autoRenewal = dto.autoRenewal;
    if (dto.internalNotes !== undefined) financial.internalNotes = dto.internalNotes;

    return this.financialRepository.save(financial);
  }

  async listDocuments(clientId: string): Promise<ClientDocumentWithUrl[]> {
    await this.getClientOrFail(clientId);
    const documents = await this.documentsRepository.find({
      where: { clientRecordId: clientId },
      order: { createdAt: 'DESC' },
    });

    return Promise.all(
      documents.map(async (document): Promise<ClientDocumentWithUrl> => {
        if (document.status !== DocumentStatus.UPLOADED) {
          return document;
        }
        const downloadUrl = await this.documentStorageService.getPresignedUrl(document.filePath, 3600);
        return { ...document, downloadUrl };
      }),
    );
  }

  async addDocument(
    clientId: string,
    file: Express.Multer.File,
    dto: UploadDocumentDto,
    uploadedBy: string,
  ): Promise<ClientDocumentWithUrl> {
    await this.getClientOrFail(clientId);

    const key = await this.documentStorageService.uploadDocument(file, clientId, dto.documentType);

    const document = await this.documentsRepository.save(
      this.documentsRepository.create({
        clientRecordId: clientId,
        documentType: dto.documentType,
        fileName: file.originalname,
        filePath: key,
        status: DocumentStatus.UPLOADED,
        version: dto.version ?? 1,
        uploadedBy,
      }),
    );

    const downloadUrl = await this.documentStorageService.getPresignedUrl(key, 3600);

    return { ...document, downloadUrl };
  }

  async removeDocument(docId: string): Promise<void> {
    const doc = await this.documentsRepository.findOne({ where: { id: docId } });
    if (!doc) {
      throw new NotFoundException(`Documento ${docId} no encontrado`);
    }
    await this.documentStorageService.deleteDocument(doc.filePath);
    await this.documentsRepository.delete(docId);
  }

  async listContacts(clientId: string): Promise<Contact[]> {
    await this.getClientOrFail(clientId);
    return this.contactsRepository.find({ where: { clientRecordId: clientId }, order: { createdAt: 'ASC' } });
  }

  async addContact(clientId: string, dto: CreateContactDto): Promise<Contact> {
    await this.getClientOrFail(clientId);

    return this.contactsRepository.save(
      this.contactsRepository.create({
        clientRecordId: clientId,
        name: dto.name,
        position: dto.position ?? null,
        area: dto.area ?? null,
        contactType: dto.contactType ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        mobile: dto.mobile ?? null,
        isPrimary: dto.isPrimary ?? false,
        notes: dto.notes ?? null,
      }),
    );
  }

  async updateContact(contactId: string, dto: UpdateContactDto): Promise<Contact> {
    const contact = await this.contactsRepository.findOne({ where: { id: contactId } });
    if (!contact) {
      throw new NotFoundException(`Contacto ${contactId} no encontrado`);
    }

    if (dto.name !== undefined) contact.name = dto.name;
    if (dto.position !== undefined) contact.position = dto.position;
    if (dto.area !== undefined) contact.area = dto.area;
    if (dto.contactType !== undefined) contact.contactType = dto.contactType;
    if (dto.email !== undefined) contact.email = dto.email;
    if (dto.phone !== undefined) contact.phone = dto.phone;
    if (dto.mobile !== undefined) contact.mobile = dto.mobile;
    if (dto.isPrimary !== undefined) contact.isPrimary = dto.isPrimary;
    if (dto.notes !== undefined) contact.notes = dto.notes;

    return this.contactsRepository.save(contact);
  }

  async removeContact(contactId: string): Promise<void> {
    const contact = await this.contactsRepository.findOne({ where: { id: contactId } });
    if (!contact) {
      throw new NotFoundException(`Contacto ${contactId} no encontrado`);
    }
    await this.contactsRepository.softDelete(contactId);
  }

  private async buildListItems(records: ClientRecord[]): Promise<ClientListItem[]> {
    if (records.length === 0) return [];

    // Load required client doc type names once
    const requiredDocTypes = await this.catalogDocTypesRepository.find({
      where: { appliesTo: 'client', isRequired: true, isActive: true },
      select: { name: true },
    });
    const requiredNames = new Set(requiredDocTypes.map((dt) => dt.name));

    // Load all uploaded doc types for this page of clients in one query
    const clientIds = records.map((r) => r.id);
    const allDocs =
      clientIds.length > 0
        ? await this.documentsRepository.find({
            where: { clientRecordId: In(clientIds) },
            select: { clientRecordId: true, documentType: true },
          })
        : [];

    const uploadedByClient = new Map<string, Set<string>>();
    for (const doc of allDocs) {
      if (!uploadedByClient.has(doc.clientRecordId)) {
        uploadedByClient.set(doc.clientRecordId, new Set());
      }
      uploadedByClient.get(doc.clientRecordId)!.add(doc.documentType);
    }

    // Load brands counts per group/company in batch
    const groupIds = records.filter((r) => r.groupId).map((r) => r.groupId as string);
    const soloCompanyIds = records.filter((r) => !r.groupId).map((r) => r.primaryCompanyId);

    const groupCompanies =
      groupIds.length > 0
        ? await this.companiesRepository.find({ where: { groupId: In(groupIds) }, select: { id: true, groupId: true } })
        : [];
    const allCompanyIdsForBrands = [
      ...groupCompanies.map((c) => c.id),
      ...soloCompanyIds,
    ];
    const brands =
      allCompanyIdsForBrands.length > 0
        ? await this.brandsRepository.find({
            where: { companyId: In(allCompanyIdsForBrands) },
            select: { id: true, companyId: true },
          })
        : [];

    // Group companies and brands by client
    const companiesByGroupId = new Map<string, string[]>();
    for (const c of groupCompanies) {
      if (c.groupId) {
        if (!companiesByGroupId.has(c.groupId)) companiesByGroupId.set(c.groupId, []);
        companiesByGroupId.get(c.groupId)!.push(c.id);
      }
    }
    const brandsByCompanyId = new Map<string, number>();
    for (const b of brands) {
      brandsByCompanyId.set(b.companyId, (brandsByCompanyId.get(b.companyId) ?? 0) + 1);
    }

    return records.map((record) => {
      const companyIds = record.groupId
        ? (companiesByGroupId.get(record.groupId) ?? [record.primaryCompanyId])
        : [record.primaryCompanyId];

      const brandsCount = companyIds.reduce((sum, id) => sum + (brandsByCompanyId.get(id) ?? 0), 0);

      const uploaded = uploadedByClient.get(record.id) ?? new Set<string>();
      const docStatus = this.computeDocStatus(requiredNames, uploaded);

      return {
        id: record.id,
        displayId: record.displayId,
        status: record.status,
        group: record.group ? { id: record.group.id, name: record.group.name } : null,
        primaryCompany: {
          id: record.primaryCompany.id,
          name: record.primaryCompany.name,
          industry: record.primaryCompany.industry,
        },
        accountManager: record.accountManager
          ? { id: record.accountManager.id, name: record.accountManager.name }
          : null,
        companiesCount: companyIds.length,
        brandsCount,
        docStatus,
        country: record.country,
        city: record.city,
        createdAt: record.createdAt,
      };
    });
  }

  private computeDocStatus(requiredNames: Set<string>, uploaded: Set<string>): DocStatus {
    if (requiredNames.size === 0) return 'no_required';
    for (const name of requiredNames) {
      if (!uploaded.has(name)) return 'incomplete';
    }
    return 'complete';
  }

  async getMissingDocumentsReport(): Promise<MissingDocumentReportItem[]> {
    const requiredDocTypes = await this.catalogDocTypesRepository.find({
      where: { appliesTo: 'client', isRequired: true, isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });

    if (requiredDocTypes.length === 0) return [];

    const requiredNames = requiredDocTypes.map((dt) => dt.name);

    const allClients = await this.clientsRepository.find({
      relations: { primaryCompany: true },
      order: { displayId: 'ASC' },
    });

    if (allClients.length === 0) return [];

    const allDocs = await this.documentsRepository.find({
      where: { clientRecordId: In(allClients.map((c) => c.id)) },
      select: { clientRecordId: true, documentType: true },
    });

    const uploadedByClient = new Map<string, Set<string>>();
    for (const doc of allDocs) {
      if (!uploadedByClient.has(doc.clientRecordId)) {
        uploadedByClient.set(doc.clientRecordId, new Set());
      }
      uploadedByClient.get(doc.clientRecordId)!.add(doc.documentType);
    }

    const result: MissingDocumentReportItem[] = [];

    for (const client of allClients) {
      const uploaded = uploadedByClient.get(client.id) ?? new Set<string>();
      const uploadedDocs = requiredNames.filter((n) => uploaded.has(n));
      const missingDocs = requiredNames.filter((n) => !uploaded.has(n));

      if (missingDocs.length === 0) continue;

      const completionPct = Math.round((uploadedDocs.length / requiredNames.length) * 100);

      result.push({
        clientId: client.id,
        displayId: client.displayId,
        companyName: client.primaryCompany.name,
        requiredDocs: requiredNames,
        uploadedDocs,
        missingDocs,
        completionPct,
      });
    }

    return result.sort((a, b) => a.completionPct - b.completionPct);
  }

  private async getCompaniesAndBrands(record: ClientRecord): Promise<{ companies: Company[]; brands: Brand[] }> {
    const companies = record.groupId
      ? await this.companiesRepository.find({ where: { groupId: record.groupId }, order: { createdAt: 'ASC' } })
      : await this.companiesRepository.find({ where: { id: record.primaryCompanyId } });

    const brands = companies.length
      ? await this.brandsRepository.find({
          where: { companyId: In(companies.map((company) => company.id)) },
          order: { createdAt: 'ASC' },
        })
      : [];

    return { companies, brands };
  }

  private async generateDisplayId(): Promise<string> {
    const last = await this.clientsRepository
      .createQueryBuilder('client')
      .withDeleted()
      .orderBy('client.displayId', 'DESC')
      .limit(1)
      .getOne();

    const lastNumber = last ? parseInt(last.displayId.replace('CLI-', ''), 10) || 0 : 0;
    return `CLI-${String(lastNumber + 1).padStart(4, '0')}`;
  }

  private async assertUserExists(id: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Usuario ${id} no encontrado`);
    }
  }

  private async assertRfcAvailable(rfc: string): Promise<void> {
    const existing = await this.companiesRepository.findOne({ where: { rfc }, withDeleted: true });
    if (existing) {
      throw new ConflictException(`Ya existe una empresa con el RFC ${rfc}`);
    }
  }

  private async getClientOrFail(id: string): Promise<ClientRecord> {
    const record = await this.clientsRepository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException(`Cliente ${id} no encontrado`);
    }
    return record;
  }
}
