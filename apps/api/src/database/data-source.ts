import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { Announcement } from '../modules/auth/entities/announcement.entity';
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
import { EmployeeDocument } from '../modules/employees/entities/employee-document.entity';
import { EmployeePhoto } from '../modules/employees/entities/employee-photo.entity';
import { EmployeeRecord } from '../modules/employees/entities/employee-record.entity';
import { PersonalData } from '../modules/employees/entities/personal-data.entity';
import { TerminationData } from '../modules/employees/entities/termination-data.entity';
import { Equipment } from '../modules/inventory/entities/equipment.entity';
import { EquipmentBrand } from '../modules/inventory/entities/equipment-brand.entity';
import { EquipmentHistory } from '../modules/inventory/entities/equipment-history.entity';
import { EquipmentStatus } from '../modules/inventory/entities/equipment-status.entity';
import { EquipmentType } from '../modules/inventory/entities/equipment-type.entity';
import { CardExpenseLine } from '../modules/credit-cards/entities/card-expense-line.entity';
import { CardExpenseReport } from '../modules/credit-cards/entities/card-expense-report.entity';
import { CreditCard } from '../modules/credit-cards/entities/credit-card.entity';
import { CatalogExpenseConcept } from '../modules/expenses/entities/catalog-expense-concept.entity';
import { CatalogExpenseType } from '../modules/expenses/entities/catalog-expense-type.entity';
import { ExpenseLine } from '../modules/expenses/entities/expense-line.entity';
import { ExpenseReport } from '../modules/expenses/entities/expense-report.entity';
import { EmployeeLicense } from '../modules/licenses/entities/employee-license.entity';
import { ToolAssignment } from '../modules/licenses/entities/tool-assignment.entity';
import { ToolCatalog } from '../modules/licenses/entities/tool-catalog.entity';
import { AdAccount } from '../modules/media/entities/ad-account.entity';
import { ApiCredential } from '../modules/media/entities/api-credential.entity';
import { MediaBudget } from '../modules/media/entities/budget.entity';
import { DailySpend } from '../modules/media/entities/daily-spend.entity';
import { MediaAlert } from '../modules/media/entities/media-alert.entity';
import { MediaAuditLog } from '../modules/media/entities/media-audit-log.entity';
import { PacingSnapshot } from '../modules/media/entities/pacing-snapshot.entity';
import { Platform } from '../modules/media/entities/platform.entity';
import { SyncLog } from '../modules/media/entities/sync-log.entity';
import { FlowRecipient } from '../modules/notifications/entities/flow-recipient.entity';
import { Notification } from '../modules/notifications/entities/notification.entity';
import { NotificationFlow } from '../modules/notifications/entities/notification-flow.entity';
import { ProjectBillingMilestone } from '../modules/projects/entities/project-billing-milestone.entity';
import { ProjectBusinessUnit } from '../modules/projects/entities/project-business-unit.entity';
import { ProjectDocument } from '../modules/projects/entities/project-document.entity';
import { ProjectFinancials } from '../modules/projects/entities/project-financials.entity';
import { ProjectHistory } from '../modules/projects/entities/project-history.entity';
import { ProjectMember } from '../modules/projects/entities/project-member.entity';
import { ProjectRecord } from '../modules/projects/entities/project-record.entity';
import { Holiday } from '../modules/vacations/entities/holiday.entity';
import { VacationBalance } from '../modules/vacations/entities/vacation-balance.entity';
import { VacationMovement } from '../modules/vacations/entities/vacation-movement.entity';
import { VacationPolicy } from '../modules/vacations/entities/vacation-policy.entity';
import { VacationRequest } from '../modules/vacations/entities/vacation-request.entity';

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
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  entities: [
    User,
    Role,
    Permission,
    UserPermission,
    Announcement,
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
    EmergencyContact,
    TerminationData,
    EmployeeDocument,
    EmployeePhoto,
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
    Equipment,
    EquipmentHistory,
    EquipmentType,
    EquipmentBrand,
    EquipmentStatus,
    ProjectRecord,
    ProjectMember,
    ProjectBusinessUnit,
    ProjectFinancials,
    ProjectBillingMilestone,
    ProjectDocument,
    ProjectHistory,
    ToolCatalog,
    EmployeeLicense,
    ToolAssignment,
    VacationBalance,
    VacationRequest,
    VacationMovement,
    VacationPolicy,
    Holiday,
    Platform,
    ApiCredential,
    AdAccount,
    DailySpend,
    MediaBudget,
    PacingSnapshot,
    MediaAlert,
    MediaAuditLog,
    SyncLog,
    Notification,
    NotificationFlow,
    FlowRecipient,
    ExpenseReport,
    ExpenseLine,
    CatalogExpenseConcept,
    CatalogExpenseType,
    CreditCard,
    CardExpenseReport,
    CardExpenseLine,
  ],
  migrations: [__dirname + '/migrations/*{.js,.ts}'],
  migrationsTableName: 'migrations',
});

export default AppDataSource;
