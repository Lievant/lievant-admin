import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { CatalogDocumentType } from '../catalogs/entities/catalog-document-type.entity';
import { EmployeeStatus } from './constants/employee-status.constant';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdatePersonalDataDto } from './dto/personal-data.dto';
import { UpdateCompensationDto } from './dto/compensation.dto';
import { CreateVacationDto, UpdateVacationDto } from './dto/vacation.dto';
import { CreateEmergencyContactDto, UpdateEmergencyContactDto } from './dto/emergency-contact.dto';
import { UpdateTerminationDto } from './dto/termination.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';
import { UploadEmployeeDocumentDto } from './dto/upload-employee-document.dto';
import { Compensation } from './entities/compensation.entity';
import { EmergencyContact } from './entities/emergency-contact.entity';
import { EmployeeDocument } from './entities/employee-document.entity';
import { EmployeeRecord } from './entities/employee-record.entity';
import { PersonalData } from './entities/personal-data.entity';
import { TerminationData } from './entities/termination-data.entity';
import { Vacation } from './entities/vacation.entity';
import { DocStatus, EmployeeListItem, EmployeesPaginatedResult, EmployeeStats, ExpiringContractItem } from './interfaces/employee-list-item.interface';
import { BirthdayReportItem } from './interfaces/birthday-report.interface';
import { decodeCursor, encodeCursor } from './utils/cursor.util';
import { EmployeeStorageService } from './employee-storage.service';

function toFixed(value: number | undefined, fallback = 0): string {
  return (value ?? fallback).toFixed(1);
}

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(EmployeeRecord) private readonly employeesRepository: Repository<EmployeeRecord>,
    @InjectRepository(PersonalData) private readonly personalDataRepository: Repository<PersonalData>,
    @InjectRepository(Compensation) private readonly compensationRepository: Repository<Compensation>,
    @InjectRepository(Vacation) private readonly vacationsRepository: Repository<Vacation>,
    @InjectRepository(EmergencyContact) private readonly emergencyContactsRepository: Repository<EmergencyContact>,
    @InjectRepository(TerminationData) private readonly terminationRepository: Repository<TerminationData>,
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    @InjectRepository(EmployeeDocument) private readonly documentsRepository: Repository<EmployeeDocument>,
    @InjectRepository(CatalogDocumentType) private readonly catalogDocTypesRepository: Repository<CatalogDocumentType>,
    private readonly storageService: EmployeeStorageService,
  ) {}

  async searchForAssignment(q: string, limit = 10) {
    const term = q.trim();
    if (!term) return [];

    const rows = await this.employeesRepository
      .createQueryBuilder('employee')
      .where('employee.status = :status', { status: EmployeeStatus.ACTIVE })
      .andWhere('(employee.fullName ILIKE :q OR employee.corporateEmail ILIKE :q)', { q: `%${term}%` })
      .orderBy('employee.fullName', 'ASC')
      .take(limit)
      .getMany();

    return rows.map((e) => ({
      id: e.id,
      displayId: e.displayId,
      fullName: e.fullName,
      corporateEmail: e.corporateEmail,
      area: e.area,
      position: e.position,
    }));
  }

  async findAll(query: QueryEmployeesDto): Promise<EmployeesPaginatedResult<EmployeeListItem>> {
    const limit = query.limit ?? 10;
    const filterByDocStatus = !!query.docStatus;

    const qb = this.employeesRepository
      .createQueryBuilder('employee')
      .orderBy('employee.createdAt', 'DESC')
      .addOrderBy('employee.id', 'DESC');

    if (query.status) {
      qb.andWhere('employee.status = :status', { status: query.status });
    }

    if (query.companyCode) {
      qb.andWhere('employee.companyCode = :companyCode', { companyCode: query.companyCode });
    }

    if (query.division) {
      qb.andWhere('employee.division = :division', { division: query.division });
    }

    if (query.location) {
      qb.andWhere('employee.location = :location', { location: query.location });
    }

    if (query.search) {
      qb.andWhere(
        '(employee.fullName ILIKE :search OR employee.displayId ILIKE :search OR employee.corporateEmail ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (!filterByDocStatus && query.cursor) {
      const cursor = decodeCursor(query.cursor);
      qb.andWhere(
        '(employee.createdAt < :cursorCreatedAt OR (employee.createdAt = :cursorCreatedAt AND employee.id < :cursorId))',
        { cursorCreatedAt: cursor.createdAt, cursorId: cursor.id },
      );
    }

    if (!filterByDocStatus) {
      qb.take(limit + 1);
    }

    const records = await qb.getMany();

    if (filterByDocStatus) {
      const allItems = await this.buildListItems(records);
      const filtered = allItems.filter((item) => item.docStatus === query.docStatus);
      const filteredActive = filtered.filter((i) => i.status === EmployeeStatus.ACTIVE).length;
      const filteredStats: EmployeeStats = {
        total: filtered.length,
        active: filteredActive,
        inactive: filtered.length - filteredActive,
        newHires: 0,
        companies: new Set(filtered.map((i) => i.companyCode)).size,
        expiringContracts: filtered.filter((i) => {
          if (!i.contractEndDate) return false;
          const end = new Date(i.contractEndDate);
          const now = new Date();
          const in30 = new Date();
          in30.setDate(in30.getDate() + 30);
          return end >= now && end <= in30;
        }).length,
      };
      return { data: filtered, nextCursor: null, stats: filteredStats };
    }

    const stats = await this.computeStats(query);

    const hasMore = records.length > limit;
    const page = hasMore ? records.slice(0, limit) : records;

    const data = await this.buildListItems(page);

    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null;

    return { data, nextCursor, stats };
  }

  async create(dto: CreateEmployeeDto): Promise<EmployeeRecord> {
    if (dto.corporateEmail) {
      await this.assertCorporateEmailAvailable(dto.corporateEmail);
    }

    if (dto.authUserId) {
      await this.assertUserExists(dto.authUserId);
    }

    const displayId = await this.generateDisplayId();

    const record = await this.employeesRepository.save(
      this.employeesRepository.create({
        ...dto,
        displayId,
        fullName: dto.fullName.toUpperCase().trim(),
        position: dto.position.toUpperCase().trim(),
        companyName: dto.companyName?.toUpperCase().trim() ?? dto.companyName,
        area: dto.area?.toUpperCase().trim() ?? null,
        division: dto.division?.toUpperCase().trim() ?? null,
        location: dto.location?.toUpperCase().trim() ?? null,
        directReportTo: dto.directReportTo?.toUpperCase().trim() ?? null,
        directReportToId: dto.directReportToId ?? null,
        status: dto.status ?? EmployeeStatus.ACTIVE,
        nationality: dto.nationality?.toUpperCase().trim() ?? 'MEXICANA',
      }),
    );

    return this.findOne(record.id);
  }

  async findOne(id: string): Promise<EmployeeRecord> {
    const record = await this.employeesRepository.findOne({
      where: { id },
      relations: { authUser: true },
      withDeleted: true,
    });

    if (!record) {
      throw new NotFoundException(`Empleado ${id} no encontrado`);
    }

    return record;
  }

  async update(id: string, dto: UpdateEmployeeDto): Promise<EmployeeRecord> {
    const record = await this.getEmployeeOrFail(id);

    if (dto.corporateEmail !== undefined && dto.corporateEmail !== record.corporateEmail) {
      if (dto.corporateEmail) {
        await this.assertCorporateEmailAvailable(dto.corporateEmail);
      }
      record.corporateEmail = dto.corporateEmail ?? null;
    }

    if (dto.authUserId !== undefined) {
      if (dto.authUserId) {
        await this.assertUserExists(dto.authUserId);
      }
      record.authUserId = dto.authUserId ?? null;
    }

    if (dto.codNom !== undefined) record.codNom = dto.codNom ?? null;
    if (dto.companyCode !== undefined) record.companyCode = dto.companyCode;
    if (dto.companyName !== undefined) record.companyName = dto.companyName?.toUpperCase().trim() ?? dto.companyName;
    if (dto.division !== undefined) record.division = dto.division?.toUpperCase().trim() ?? null;
    if (dto.area !== undefined) record.area = dto.area?.toUpperCase().trim() ?? null;
    if (dto.project !== undefined) record.project = dto.project ?? null;
    if (dto.level !== undefined) record.level = dto.level ?? null;
    if (dto.position !== undefined) record.position = dto.position.toUpperCase().trim();
    if (dto.emailSignature !== undefined) record.emailSignature = dto.emailSignature ?? null;
    if (dto.location !== undefined) record.location = dto.location?.toUpperCase().trim() ?? null;
    if (dto.modality !== undefined) record.modality = dto.modality ?? null;
    if (dto.contractSchema !== undefined) record.contractSchema = dto.contractSchema ?? null;
    if (dto.fullName !== undefined) record.fullName = dto.fullName.toUpperCase().trim();
    if (dto.directReportTo !== undefined) record.directReportTo = dto.directReportTo?.toUpperCase().trim() ?? null;
    if (dto.directReportToId !== undefined) record.directReportToId = dto.directReportToId ?? null;
    if (dto.gender !== undefined) record.gender = dto.gender ?? null;
    if (dto.nationality !== undefined) record.nationality = dto.nationality ?? null;
    if (dto.seniorityDate !== undefined) record.seniorityDate = dto.seniorityDate ?? null;
    if (dto.contractType !== undefined) record.contractType = dto.contractType ?? null;
    if (dto.contractEndDate !== undefined) record.contractEndDate = dto.contractEndDate ?? null;
    if (dto.schedule !== undefined) record.schedule = dto.schedule ?? null;
    if (dto.lunchTime !== undefined) record.lunchTime = dto.lunchTime ?? null;
    if (dto.studies !== undefined) record.studies = dto.studies ?? null;
    if (dto.status !== undefined) record.status = dto.status;

    await this.employeesRepository.save(record);

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.getEmployeeOrFail(id);
    await this.employeesRepository.softDelete(id);
  }

  async getPersonalData(employeeId: string): Promise<PersonalData | null> {
    await this.getEmployeeOrFail(employeeId);
    return this.personalDataRepository.findOne({ where: { employeeId } });
  }

  async updatePersonalData(employeeId: string, dto: UpdatePersonalDataDto): Promise<PersonalData> {
    await this.getEmployeeOrFail(employeeId);

    let personalData = await this.personalDataRepository.findOne({ where: { employeeId } });
    if (!personalData) {
      personalData = this.personalDataRepository.create({ employeeId });
    }

    if (dto.rfc !== undefined) personalData.rfc = dto.rfc;
    if (dto.imssNumber !== undefined) personalData.imssNumber = dto.imssNumber;
    if (dto.curp !== undefined) personalData.curp = dto.curp;
    if (dto.birthDate !== undefined) personalData.birthDate = dto.birthDate;
    if (dto.bloodType !== undefined) personalData.bloodType = dto.bloodType;
    if (dto.maritalStatus !== undefined) personalData.maritalStatus = dto.maritalStatus;
    if (dto.children !== undefined) personalData.children = dto.children;
    if (dto.phone !== undefined) personalData.phone = dto.phone;
    if (dto.street !== undefined) personalData.street = dto.street;
    if (dto.extNumber !== undefined) personalData.extNumber = dto.extNumber;
    if (dto.intNumber !== undefined) personalData.intNumber = dto.intNumber;
    if (dto.neighborhood !== undefined) personalData.neighborhood = dto.neighborhood;
    if (dto.postalCode !== undefined) personalData.postalCode = dto.postalCode;
    if (dto.city !== undefined) personalData.city = dto.city;
    if (dto.state !== undefined) personalData.state = dto.state;
    if (dto.mainTransport !== undefined) personalData.mainTransport = dto.mainTransport;
    if (dto.commuteTime !== undefined) personalData.commuteTime = dto.commuteTime;

    return this.personalDataRepository.save(personalData);
  }

  async getCompensation(employeeId: string): Promise<Compensation | null> {
    await this.getEmployeeOrFail(employeeId);
    return this.compensationRepository.findOne({ where: { employeeId } });
  }

  async updateCompensation(employeeId: string, dto: UpdateCompensationDto): Promise<Compensation> {
    await this.getEmployeeOrFail(employeeId);

    let compensation = await this.compensationRepository.findOne({ where: { employeeId } });
    if (!compensation) {
      compensation = this.compensationRepository.create({ employeeId });
    }

    if (dto.dailyGrossSalary !== undefined) compensation.dailyGrossSalary = dto.dailyGrossSalary.toFixed(2);
    if (dto.monthlyGrossSalary !== undefined) compensation.monthlyGrossSalary = dto.monthlyGrossSalary.toFixed(2);
    if (dto.servicePayment !== undefined) compensation.servicePayment = dto.servicePayment.toFixed(2);
    if (dto.lastSalaryChange !== undefined) compensation.lastSalaryChange = dto.lastSalaryChange;
    if (dto.remoteWorkAllowance !== undefined) compensation.remoteWorkAllowance = dto.remoteWorkAllowance.toFixed(2);
    if (dto.groceryVouchers !== undefined) compensation.groceryVouchers = dto.groceryVouchers.toFixed(2);
    if (dto.gasVouchers !== undefined) compensation.gasVouchers = dto.gasVouchers.toFixed(2);
    if (dto.healthInsurance !== undefined) compensation.healthInsurance = dto.healthInsurance;
    if (dto.phoneAllowance !== undefined) compensation.phoneAllowance = dto.phoneAllowance.toFixed(2);
    if (dto.punctualityBonus !== undefined) compensation.punctualityBonus = dto.punctualityBonus.toFixed(2);
    if (dto.otherBenefits !== undefined) compensation.otherBenefits = dto.otherBenefits;
    if (dto.totalGross !== undefined) compensation.totalGross = dto.totalGross.toFixed(2);
    if (dto.netEstimate !== undefined) compensation.netEstimate = dto.netEstimate.toFixed(2);

    return this.compensationRepository.save(compensation);
  }

  async listVacations(employeeId: string): Promise<Vacation[]> {
    await this.getEmployeeOrFail(employeeId);
    return this.vacationsRepository.find({ where: { employeeId }, order: { year: 'DESC' } });
  }

  async createVacation(employeeId: string, dto: CreateVacationDto): Promise<Vacation> {
    await this.getEmployeeOrFail(employeeId);

    const existing = await this.vacationsRepository.findOne({ where: { employeeId, year: dto.year } });
    if (existing) {
      throw new ConflictException(`Ya existe un registro de vacaciones para el año ${dto.year}`);
    }

    const opening = dto.openingBalance ?? 0;
    const taken = dto.taken ?? 0;

    const vacation = this.vacationsRepository.create({
      employeeId,
      year: dto.year,
      openingBalance: toFixed(opening),
      taken: toFixed(taken),
      closingBalance: toFixed(opening - taken),
      supportActivityDays: toFixed(dto.supportActivityDays ?? 0),
      notes: dto.notes ?? null,
    });

    return this.vacationsRepository.save(vacation);
  }

  async updateVacation(vacationId: string, dto: UpdateVacationDto): Promise<Vacation> {
    const vacation = await this.vacationsRepository.findOne({ where: { id: vacationId } });
    if (!vacation) {
      throw new NotFoundException(`Registro de vacaciones ${vacationId} no encontrado`);
    }

    if (dto.year !== undefined) vacation.year = dto.year;
    if (dto.openingBalance !== undefined) vacation.openingBalance = toFixed(dto.openingBalance);
    if (dto.taken !== undefined) vacation.taken = toFixed(dto.taken);
    if (dto.supportActivityDays !== undefined) vacation.supportActivityDays = toFixed(dto.supportActivityDays);
    if (dto.notes !== undefined) vacation.notes = dto.notes ?? null;

    vacation.closingBalance = toFixed(Number(vacation.openingBalance ?? 0) - Number(vacation.taken ?? 0));

    return this.vacationsRepository.save(vacation);
  }

  async listEmergencyContacts(employeeId: string): Promise<EmergencyContact[]> {
    await this.getEmployeeOrFail(employeeId);
    return this.emergencyContactsRepository.find({ where: { employeeId }, order: { createdAt: 'ASC' } });
  }

  async addEmergencyContact(employeeId: string, dto: CreateEmergencyContactDto): Promise<EmergencyContact> {
    await this.getEmployeeOrFail(employeeId);

    return this.emergencyContactsRepository.save(
      this.emergencyContactsRepository.create({
        employeeId,
        name: dto.name,
        relationship: dto.relationship ?? null,
        phone: dto.phone ?? null,
      }),
    );
  }

  async updateEmergencyContact(contactId: string, dto: UpdateEmergencyContactDto): Promise<EmergencyContact> {
    const contact = await this.emergencyContactsRepository.findOne({ where: { id: contactId } });
    if (!contact) {
      throw new NotFoundException(`Contacto de emergencia ${contactId} no encontrado`);
    }

    if (dto.name !== undefined) contact.name = dto.name;
    if (dto.relationship !== undefined) contact.relationship = dto.relationship ?? null;
    if (dto.phone !== undefined) contact.phone = dto.phone ?? null;

    return this.emergencyContactsRepository.save(contact);
  }

  async removeEmergencyContact(contactId: string): Promise<void> {
    const contact = await this.emergencyContactsRepository.findOne({ where: { id: contactId } });
    if (!contact) {
      throw new NotFoundException(`Contacto de emergencia ${contactId} no encontrado`);
    }
    await this.emergencyContactsRepository.softDelete(contactId);
  }

  async getTermination(employeeId: string): Promise<TerminationData | null> {
    await this.getEmployeeOrFail(employeeId);
    return this.terminationRepository.findOne({ where: { employeeId } });
  }

  async updateTermination(employeeId: string, dto: UpdateTerminationDto): Promise<TerminationData> {
    const employee = await this.getEmployeeOrFail(employeeId);

    let termination = await this.terminationRepository.findOne({ where: { employeeId } });
    if (!termination) {
      termination = this.terminationRepository.create({ employeeId });
    }

    if (dto.terminationDate !== undefined) termination.terminationDate = dto.terminationDate;
    if (dto.reason !== undefined) termination.reason = dto.reason;
    if (dto.severancePaid !== undefined) termination.severancePaid = dto.severancePaid;
    if (dto.severanceAmount !== undefined) termination.severanceAmount = dto.severanceAmount.toFixed(2);
    if (dto.references !== undefined) termination.references = dto.references;
    if (dto.notes !== undefined) termination.notes = dto.notes;

    const saved = await this.terminationRepository.save(termination);

    if (dto.terminationDate && employee.status !== EmployeeStatus.INACTIVE) {
      employee.status = EmployeeStatus.INACTIVE;
      await this.employeesRepository.save(employee);
    }

    return saved;
  }

  async getDocuments(employeeId: string): Promise<(EmployeeDocument & { downloadUrl?: string })[]> {
    await this.getEmployeeOrFail(employeeId);
    const docs = await this.documentsRepository.find({ where: { employeeId }, order: { uploadedAt: 'DESC' } });
    return Promise.all(
      docs.map(async (doc) => ({ ...doc, downloadUrl: await this.storageService.getPresignedUrl(doc.s3Key) })),
    );
  }

  async uploadDocument(
    employeeId: string,
    file: Express.Multer.File,
    dto: UploadEmployeeDocumentDto,
    userId: string,
  ): Promise<EmployeeDocument & { downloadUrl?: string }> {
    await this.getEmployeeOrFail(employeeId);
    const s3Key = await this.storageService.uploadDocument(file, employeeId, dto.type);
    const doc = await this.documentsRepository.save(
      this.documentsRepository.create({
        employeeId,
        type: dto.type,
        name: dto.name,
        s3Key,
        fileSize: file.size,
        uploadedBy: userId,
      }),
    );
    const downloadUrl = await this.storageService.getPresignedUrl(doc.s3Key);
    return { ...doc, downloadUrl };
  }

  async removeDocument(docId: string): Promise<void> {
    const doc = await this.documentsRepository.findOne({ where: { id: docId } });
    if (!doc) throw new NotFoundException(`Documento ${docId} no encontrado`);
    await this.storageService.deleteDocument(doc.s3Key);
    await this.documentsRepository.softDelete(docId);
  }

  async getDashboard(userId: string): Promise<{
    todayBookings: { id: string; title: string; roomName: string; startTime: string; endTime: string }[];
    todayBirthdays: { id: string; fullName: string; area: string | null; division: string | null }[];
    upcomingBirthdays: {
      id: string;
      fullName: string;
      area: string | null;
      division: string | null;
      birthDate: string;
      daysUntil: number;
    }[];
  }> {
    const [todayBookings, todayBirthdays, upcomingBirthdays] = await Promise.all([
      this.employeesRepository.manager
        .query(
          `SELECT b.id, b.title, r.name AS "roomName",
                  b.start_time AS "startTime", b.end_time AS "endTime"
           FROM rooms.bookings b
           INNER JOIN rooms.rooms r ON r.id = b.room_id
           WHERE b.user_id = $1
             AND b.status = 'confirmada'
             AND b.start_time::date = CURRENT_DATE
           ORDER BY b.start_time`,
          [userId],
        )
        .catch(() => []),

      this.employeesRepository.manager.query(
        `SELECT e.id, e.full_name AS "fullName", e.area, e.division
         FROM employees.employee_records e
         INNER JOIN employees.personal_data pd ON pd.employee_id = e.id
         WHERE e.deleted_at IS NULL
           AND pd.birth_date IS NOT NULL
           AND EXTRACT(MONTH FROM pd.birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)
           AND EXTRACT(DAY   FROM pd.birth_date) = EXTRACT(DAY   FROM CURRENT_DATE)
         ORDER BY e.full_name`,
      ),

      this.employeesRepository.manager.query(
        `WITH days AS (
           SELECT (CURRENT_DATE + (n || ' days')::INTERVAL)::date AS d
           FROM generate_series(1, 7) AS n
         )
         SELECT DISTINCT
           e.id,
           e.full_name AS "fullName",
           e.area,
           e.division,
           TO_CHAR(pd.birth_date, 'MM-DD') AS "birthDate",
           (d.d - CURRENT_DATE)::int AS "daysUntil"
         FROM employees.employee_records e
         INNER JOIN employees.personal_data pd ON pd.employee_id = e.id
         CROSS JOIN days d
         WHERE e.deleted_at IS NULL
           AND pd.birth_date IS NOT NULL
           AND TO_CHAR(pd.birth_date, 'MM-DD') = TO_CHAR(d.d, 'MM-DD')
         ORDER BY "daysUntil"`,
      ),
    ]);

    return { todayBookings, todayBirthdays, upcomingBirthdays };
  }

  async getBirthdayReport(month: number, orderBy: 'date' | 'name' | 'area'): Promise<BirthdayReportItem[]> {
    const ORDER_CLAUSES: Record<string, string> = {
      date: 'EXTRACT(DAY FROM pd.birth_date)',
      name: 'e.full_name',
      area: 'e.area NULLS LAST, e.full_name',
    };
    const orderClause = ORDER_CLAUSES[orderBy] ?? ORDER_CLAUSES.date;

    const rows = await this.employeesRepository.manager.query(
      `SELECT
        e.id,
        e.full_name AS "fullName",
        e.area,
        e.division,
        e.position,
        e.company_code AS "companyCode",
        e.company_name AS "companyName",
        TO_CHAR(e.seniority_date, 'YYYY-MM-DD') AS "seniorityDate",
        TO_CHAR(pd.birth_date, 'MM-DD') AS "birthDate"
      FROM employees.employee_records e
      INNER JOIN employees.personal_data pd ON pd.employee_id = e.id
      WHERE e.deleted_at IS NULL
        AND pd.birth_date IS NOT NULL
        AND EXTRACT(MONTH FROM pd.birth_date) = $1
      ORDER BY ${orderClause}`,
      [month],
    );
    return rows as BirthdayReportItem[];
  }

  private async buildListItems(records: EmployeeRecord[]): Promise<EmployeeListItem[]> {
    if (records.length === 0) return [];

    const requiredDocTypes = await this.catalogDocTypesRepository.find({
      where: { appliesTo: 'employee', isRequired: true, isActive: true },
      select: { name: true },
    });
    const requiredNames = new Set(requiredDocTypes.map((dt) => dt.name));

    const employeeIds = records.map((r) => r.id);
    const allDocs =
      employeeIds.length > 0
        ? await this.documentsRepository.find({
            where: { employeeId: In(employeeIds) },
            select: { employeeId: true, type: true },
          })
        : [];

    const uploadedByEmployee = new Map<string, Set<string>>();
    for (const doc of allDocs) {
      if (!uploadedByEmployee.has(doc.employeeId)) {
        uploadedByEmployee.set(doc.employeeId, new Set());
      }
      uploadedByEmployee.get(doc.employeeId)!.add(doc.type);
    }

    return records.map((record) => {
      const uploaded = uploadedByEmployee.get(record.id) ?? new Set<string>();
      const docStatus = this.computeDocStatus(requiredNames, uploaded);
      return {
        id: record.id,
        displayId: record.displayId,
        status: record.status,
        fullName: record.fullName,
        corporateEmail: record.corporateEmail,
        companyCode: record.companyCode,
        companyName: record.companyName,
        division: record.division,
        area: record.area,
        position: record.position,
        location: record.location,
        modality: record.modality,
        seniorityDate: record.seniorityDate,
        contractEndDate: record.contractEndDate,
        docStatus,
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

  async getExpiringContracts(days: number): Promise<ExpiringContractItem[]> {
    const rows = await this.employeesRepository.manager.query(
      `SELECT
        e.id,
        e.display_id AS "displayId",
        e.full_name AS "fullName",
        e.position,
        e.area,
        e.division,
        e.company_name AS "companyName",
        e.contract_type AS "contractType",
        TO_CHAR(e.contract_end_date, 'YYYY-MM-DD') AS "contractEndDate",
        (e.contract_end_date - CURRENT_DATE)::int AS "daysUntilExpiry"
      FROM employees.employee_records e
      WHERE e.deleted_at IS NULL
        AND e.contract_end_date IS NOT NULL
        AND e.contract_end_date >= CURRENT_DATE
        AND e.contract_end_date <= (CURRENT_DATE + ($1 || ' days')::INTERVAL)::date
      ORDER BY e.contract_end_date ASC, e.full_name ASC`,
      [days],
    );
    return rows as ExpiringContractItem[];
  }

  private async computeStats(query?: QueryEmployeesDto): Promise<EmployeeStats> {
    const applyFilters = (qb: ReturnType<typeof this.employeesRepository.createQueryBuilder>) => {
      if (query?.status) qb.andWhere('employee.status = :status', { status: query.status });
      if (query?.companyCode) qb.andWhere('employee.companyCode = :companyCode', { companyCode: query.companyCode });
      if (query?.division) qb.andWhere('employee.division = :division', { division: query.division });
      if (query?.location) qb.andWhere('employee.location = :location', { location: query.location });
      if (query?.search) {
        qb.andWhere(
          '(employee.fullName ILIKE :search OR employee.displayId ILIKE :search OR employee.corporateEmail ILIKE :search)',
          { search: `%${query.search}%` },
        );
      }
      return qb;
    };

    const baseQb = () => applyFilters(this.employeesRepository.createQueryBuilder('employee'));

    const total = await baseQb().getCount();
    const active = await baseQb().andWhere('employee.status = :activeStatus', { activeStatus: EmployeeStatus.ACTIVE }).getCount();
    const inactive = total - active;

    const companyRows = await baseQb()
      .select('DISTINCT employee.company_code', 'companyCode')
      .getRawMany<{ companyCode: string }>();
    const companies = companyRows.length;

    const expiringContracts = await baseQb()
      .andWhere('employee.contractEndDate IS NOT NULL')
      .andWhere(`employee.contractEndDate <= (CURRENT_DATE + INTERVAL '30 days')`)
      .andWhere('employee.contractEndDate >= CURRENT_DATE')
      .getCount();

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const newHires = await baseQb()
      .andWhere('employee.seniorityDate >= :firstDay', { firstDay: firstDayOfMonth.toISOString().split('T')[0] })
      .andWhere('employee.seniorityDate <= :lastDay', { lastDay: lastDayOfMonth.toISOString().split('T')[0] })
      .getCount();

    return { total, active, inactive, companies, expiringContracts, newHires };
  }

  private async generateDisplayId(): Promise<string> {
    const result = await this.employeesRepository.query(
      `SELECT nextval('employees.employee_display_id_seq') AS next_id`,
    );
    const nextId = parseInt(result[0].next_id, 10);
    return `EMP-${String(nextId).padStart(4, '0')}`;
  }

  private async assertUserExists(id: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Usuario ${id} no encontrado`);
    }
  }

  private async assertCorporateEmailAvailable(email: string): Promise<void> {
    const existing = await this.employeesRepository.findOne({ where: { corporateEmail: email }, withDeleted: true });
    if (existing) {
      throw new ConflictException(`Ya existe un empleado con el email corporativo ${email}`);
    }
  }

  private async getEmployeeOrFail(id: string): Promise<EmployeeRecord> {
    const record = await this.employeesRepository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException(`Empleado ${id} no encontrado`);
    }
    return record;
  }
}
