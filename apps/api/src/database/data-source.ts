import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { Permission } from '../modules/auth/entities/permission.entity';
import { Role } from '../modules/auth/entities/role.entity';
import { User } from '../modules/auth/entities/user.entity';
import { UserPermission } from '../modules/auth/entities/user-permission.entity';
import { CatalogArea } from '../modules/catalogs/entities/catalog-area.entity';
import { CatalogBloodType } from '../modules/catalogs/entities/catalog-blood-type.entity';
import { CatalogCompany } from '../modules/catalogs/entities/catalog-company.entity';
import { CatalogContractSchema } from '../modules/catalogs/entities/catalog-contract-schema.entity';
import { CatalogContractType } from '../modules/catalogs/entities/catalog-contract-type.entity';
import { CatalogDivision } from '../modules/catalogs/entities/catalog-division.entity';
import { CatalogDocumentType } from '../modules/catalogs/entities/catalog-document-type.entity';
import { CatalogIndustry } from '../modules/catalogs/entities/catalog-industry.entity';
import { CatalogLocation } from '../modules/catalogs/entities/catalog-location.entity';
import { CatalogMaritalStatus } from '../modules/catalogs/entities/catalog-marital-status.entity';
import { CatalogModality } from '../modules/catalogs/entities/catalog-modality.entity';
import { CatalogOrgLevel } from '../modules/catalogs/entities/catalog-org-level.entity';
import { Brand } from '../modules/clients/entities/brand.entity';
import { ClientDocument } from '../modules/clients/entities/client-document.entity';
import { ClientRecord } from '../modules/clients/entities/client-record.entity';
import { Company } from '../modules/clients/entities/company.entity';
import { Contact } from '../modules/clients/entities/contact.entity';
import { FinancialData } from '../modules/clients/entities/financial-data.entity';
import { Group } from '../modules/clients/entities/group.entity';
import { Compensation } from '../modules/employees/entities/compensation.entity';
import { EmergencyContact } from '../modules/employees/entities/emergency-contact.entity';
import { EmployeeRecord } from '../modules/employees/entities/employee-record.entity';
import { PersonalData } from '../modules/employees/entities/personal-data.entity';
import { TerminationData } from '../modules/employees/entities/termination-data.entity';
import { Vacation } from '../modules/employees/entities/vacation.entity';

for (const envFile of ['.env.local', '.env', '../../.env.local', '../../.env']) {
  dotenv.config({ path: path.resolve(process.cwd(), envFile) });
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL no está definido');
}

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  schema: process.env.DATABASE_SCHEMA ?? 'auth',
  entities: [
    User,
    Role,
    Permission,
    UserPermission,
    Group,
    Company,
    Brand,
    ClientRecord,
    FinancialData,
    ClientDocument,
    Contact,
    EmployeeRecord,
    PersonalData,
    Compensation,
    Vacation,
    EmergencyContact,
    TerminationData,
    CatalogCompany,
    CatalogLocation,
    CatalogModality,
    CatalogDivision,
    CatalogArea,
    CatalogContractSchema,
    CatalogContractType,
    CatalogOrgLevel,
    CatalogBloodType,
    CatalogMaritalStatus,
    CatalogIndustry,
    CatalogDocumentType,
  ],
  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'migrations',
});

export default AppDataSource;
