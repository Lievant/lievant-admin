import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { ClientStatus } from './constants/client-status.constant';
import { DocumentStatus } from './constants/document-status.constant';
import { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto';
import { ClientCreationType, CreateClientDto } from './dto/create-client.dto';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';
import { CreateDocumentDto } from './dto/document.dto';
import { UpdateFinancialDto } from './dto/financial.dto';
import { QueryClientsDto } from './dto/query-clients.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { Brand } from './entities/brand.entity';
import { ClientDocument } from './entities/client-document.entity';
import { ClientRecord } from './entities/client-record.entity';
import { Company } from './entities/company.entity';
import { Contact } from './entities/contact.entity';
import { FinancialData } from './entities/financial-data.entity';
import { Group } from './entities/group.entity';
import { ClientListItem, PaginatedResult } from './interfaces/client-list-item.interface';
import { decodeCursor, encodeCursor } from './utils/cursor.util';

export interface ClientDetail extends ClientRecord {
  companies: Company[];
  brands: Brand[];
  contacts: Contact[];
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
  ) {}

  async findAll(query: QueryClientsDto): Promise<PaginatedResult<ClientListItem>> {
    const limit = query.limit ?? 10;

    const qb = this.clientsRepository
      .createQueryBuilder('client')
      .leftJoinAndSelect('client.group', 'group')
      .leftJoinAndSelect('client.primaryCompany', 'primaryCompany')
      .leftJoinAndSelect('client.accountManager', 'accountManager')
      .orderBy('client.createdAt', 'DESC')
      .addOrderBy('client.id', 'DESC')
      .take(limit + 1);

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

    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      qb.andWhere(
        '(client.createdAt < :cursorCreatedAt OR (client.createdAt = :cursorCreatedAt AND client.id < :cursorId))',
        { cursorCreatedAt: cursor.createdAt, cursorId: cursor.id },
      );
    }

    const records = await qb.getMany();
    const hasMore = records.length > limit;
    const page = hasMore ? records.slice(0, limit) : records;

    const data = await Promise.all(page.map((record) => this.toListItem(record)));

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

  async listDocuments(clientId: string): Promise<ClientDocument[]> {
    await this.getClientOrFail(clientId);
    return this.documentsRepository.find({ where: { clientRecordId: clientId }, order: { createdAt: 'DESC' } });
  }

  async addDocument(clientId: string, dto: CreateDocumentDto, uploadedBy: string): Promise<ClientDocument> {
    await this.getClientOrFail(clientId);

    return this.documentsRepository.save(
      this.documentsRepository.create({
        clientRecordId: clientId,
        documentType: dto.documentType,
        fileName: dto.fileName,
        filePath: dto.filePath,
        status: dto.status ?? DocumentStatus.UPLOADED,
        uploadedBy,
      }),
    );
  }

  async removeDocument(docId: string): Promise<void> {
    const doc = await this.documentsRepository.findOne({ where: { id: docId } });
    if (!doc) {
      throw new NotFoundException(`Documento ${docId} no encontrado`);
    }
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

  private async toListItem(record: ClientRecord): Promise<ClientListItem> {
    const companyIds = record.groupId
      ? (await this.companiesRepository.find({ where: { groupId: record.groupId } })).map((company) => company.id)
      : [record.primaryCompanyId];

    const [brandsCount, missingDocumentsCount] = await Promise.all([
      companyIds.length ? this.brandsRepository.count({ where: { companyId: In(companyIds) } }) : 0,
      this.documentsRepository.count({ where: { clientRecordId: record.id, status: DocumentStatus.MISSING } }),
    ]);

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
      missingDocumentsCount,
      createdAt: record.createdAt,
    };
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
