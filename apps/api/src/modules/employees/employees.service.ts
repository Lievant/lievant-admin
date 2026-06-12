import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { EmployeeStatus } from './constants/employee-status.constant';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdatePersonalDataDto } from './dto/personal-data.dto';
import { UpdateCompensationDto } from './dto/compensation.dto';
import { CreateVacationDto, UpdateVacationDto } from './dto/vacation.dto';
import { CreateEmergencyContactDto, UpdateEmergencyContactDto } from './dto/emergency-contact.dto';
import { UpdateTerminationDto } from './dto/termination.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';
import { Compensation } from './entities/compensation.entity';
import { EmergencyContact } from './entities/emergency-contact.entity';
import { EmployeeRecord } from './entities/employee-record.entity';
import { PersonalData } from './entities/personal-data.entity';
import { TerminationData } from './entities/termination-data.entity';
import { Vacation } from './entities/vacation.entity';
import { EmployeeListItem, EmployeesPaginatedResult, EmployeeStats } from './interfaces/employee-list-item.interface';
import { decodeCursor, encodeCursor } from './utils/cursor.util';

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
  ) {}

  async findAll(query: QueryEmployeesDto): Promise<EmployeesPaginatedResult<EmployeeListItem>> {
    const limit = query.limit ?? 10;

    const qb = this.employeesRepository
      .createQueryBuilder('employee')
      .orderBy('employee.createdAt', 'DESC')
      .addOrderBy('employee.id', 'DESC')
      .take(limit + 1);

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

    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      qb.andWhere(
        '(employee.createdAt < :cursorCreatedAt OR (employee.createdAt = :cursorCreatedAt AND employee.id < :cursorId))',
        { cursorCreatedAt: cursor.createdAt, cursorId: cursor.id },
      );
    }

    const records = await qb.getMany();
    const hasMore = records.length > limit;
    const page = hasMore ? records.slice(0, limit) : records;

    const data = page.map((record) => this.toListItem(record));

    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null;

    const stats = await this.computeStats();

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
        status: dto.status ?? EmployeeStatus.ACTIVE,
        nationality: dto.nationality ?? 'Mexicana',
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
    if (dto.companyName !== undefined) record.companyName = dto.companyName;
    if (dto.division !== undefined) record.division = dto.division ?? null;
    if (dto.area !== undefined) record.area = dto.area ?? null;
    if (dto.project !== undefined) record.project = dto.project ?? null;
    if (dto.level !== undefined) record.level = dto.level ?? null;
    if (dto.position !== undefined) record.position = dto.position;
    if (dto.emailSignature !== undefined) record.emailSignature = dto.emailSignature ?? null;
    if (dto.location !== undefined) record.location = dto.location ?? null;
    if (dto.modality !== undefined) record.modality = dto.modality ?? null;
    if (dto.contractSchema !== undefined) record.contractSchema = dto.contractSchema ?? null;
    if (dto.fullName !== undefined) record.fullName = dto.fullName;
    if (dto.directReportTo !== undefined) record.directReportTo = dto.directReportTo ?? null;
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

  private toListItem(record: EmployeeRecord): EmployeeListItem {
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
      createdAt: record.createdAt,
    };
  }

  private async computeStats(): Promise<EmployeeStats> {
    const total = await this.employeesRepository.count();
    const active = await this.employeesRepository.count({ where: { status: EmployeeStatus.ACTIVE } });
    const inactive = total - active;

    const companyRows = await this.employeesRepository
      .createQueryBuilder('employee')
      .select('DISTINCT employee.company_code', 'companyCode')
      .getRawMany<{ companyCode: string }>();
    const companies = companyRows.length;

    const expiringContracts = await this.employeesRepository
      .createQueryBuilder('employee')
      .where('employee.contractEndDate IS NOT NULL')
      .andWhere(`employee.contractEndDate <= (CURRENT_DATE + INTERVAL '30 days')`)
      .andWhere('employee.contractEndDate >= CURRENT_DATE')
      .getCount();

    return { total, active, inactive, companies, expiringContracts };
  }

  private async generateDisplayId(): Promise<string> {
    const last = await this.employeesRepository
      .createQueryBuilder('employee')
      .withDeleted()
      .orderBy('employee.displayId', 'DESC')
      .limit(1)
      .getOne();

    const lastNumber = last ? parseInt(last.displayId.replace('EMP-', ''), 10) || 0 : 0;
    return `EMP-${String(lastNumber + 1).padStart(4, '0')}`;
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
