import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (body.message) {
        message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
      }
    } catch {
      // el cuerpo no es JSON, se usa el mensaje por defecto
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  });

  return parseResponse<T>(res);
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  roles: { id: string; name: string }[];
}

export type UserLocation = 'LEON' | 'CDMX' | 'GUADALAJARA' | 'COLOMBIA' | 'ESTADOS_UNIDOS';

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  cognitoId: string | null;
  location: UserLocation | null;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  roles: { id: string; name: string }[];
}

export interface RoleSummary {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  isSystem: boolean;
}

export interface CreateUserPayload {
  email: string;
  name: string;
  location?: UserLocation;
  roleIds?: string[];
  isActive?: boolean;
}

export interface UpdateUserPayload {
  email?: string;
  name?: string;
  location?: UserLocation;
  roleIds?: string[];
  isActive?: boolean;
}

export function getCurrentUser(): Promise<CurrentUser> {
  return apiFetch<CurrentUser>('/auth/me');
}

export function listUsers(): Promise<UserSummary[]> {
  return apiFetch<UserSummary[]>('/users');
}

export function listRoles(): Promise<RoleSummary[]> {
  return apiFetch<RoleSummary[]>('/roles');
}

export function createUser(payload: CreateUserPayload): Promise<UserSummary> {
  return apiFetch<UserSummary>('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateUser(id: string, payload: UpdateUserPayload): Promise<UserSummary> {
  return apiFetch<UserSummary>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteUser(id: string): Promise<void> {
  return apiFetch<void>(`/users/${id}`, {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------------------
// Clientes (Módulo 1)
// ---------------------------------------------------------------------------

export type ClientStatus = 'active' | 'paused' | 'lost';

export type DocumentStatus = 'uploaded' | 'pending' | 'missing';

export type ClientSegment = 'A' | 'B' | 'C';

export type ContactType =
  | 'financial'
  | 'administrative'
  | 'commercial'
  | 'operational'
  | 'legal'
  | 'direction';

export interface ClientGroupSummary {
  id: string;
  name: string;
}

export interface ClientCompanySummary {
  id: string;
  name: string;
  industry: string | null;
}

export interface ClientAccountManagerSummary {
  id: string;
  name: string;
}

export interface ClientListItem {
  id: string;
  displayId: string;
  status: ClientStatus;
  group: ClientGroupSummary | null;
  primaryCompany: ClientCompanySummary;
  accountManager: ClientAccountManagerSummary | null;
  companiesCount: number;
  brandsCount: number;
  missingDocumentsCount: number;
  country: string | null;
  city: string | null;
  createdAt: string;
}

export interface ClientsPage {
  data: ClientListItem[];
  nextCursor: string | null;
}

export interface Company {
  id: string;
  groupId: string | null;
  name: string;
  legalName: string | null;
  rfc: string | null;
  industry: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Brand {
  id: string;
  companyId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Contact {
  id: string;
  clientRecordId: string;
  name: string;
  position: string | null;
  area: string | null;
  contactType: ContactType | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  isPrimary: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ClientDetail {
  id: string;
  displayId: string;
  status: ClientStatus;
  groupId: string | null;
  group: ClientGroupSummary | null;
  primaryCompanyId: string;
  primaryCompany: Company;
  accountManagerId: string | null;
  accountManager: ClientAccountManagerSummary | null;
  notes: string | null;
  crmId: string | null;
  corId: string | null;
  contpaqId: string | null;
  segment: ClientSegment | null;
  npsScore: number | null;
  lastContactDate: string | null;
  dynamicsId: string | null;
  website: string | null;
  linkedin: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  companies: Company[];
  brands: Brand[];
  contacts: Contact[];
}

export interface FinancialData {
  id: string;
  clientRecordId: string;
  paymentDays: number | null;
  billingEmail: string | null;
  billingContact: string | null;
  creditLimit: string | null;
  currency: string | null;
  paymentMethod: string | null;
  satPaymentMethod: string | null;
  satPaymentForm: string | null;
  satCfdiUse: string | null;
  satTaxRegime: string | null;
  bankName: string | null;
  bankAccount: string | null;
  bankClabe: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  autoRenewal: boolean;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientDocumentSummary {
  id: string;
  clientRecordId: string;
  documentType: string;
  fileName: string;
  filePath: string;
  status: DocumentStatus;
  version: number;
  uploadedBy: string | null;
  downloadUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListClientsParams {
  cursor?: string;
  limit?: number;
  status?: ClientStatus;
  accountManagerId?: string;
  industry?: string;
  search?: string;
}

export function listClients(params: ListClientsParams = {}): Promise<ClientsPage> {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.status) query.set('status', params.status);
  if (params.accountManagerId) query.set('accountManagerId', params.accountManagerId);
  if (params.industry) query.set('industry', params.industry);
  if (params.search) query.set('search', params.search);

  const qs = query.toString();
  return apiFetch<ClientsPage>(`/clients${qs ? `?${qs}` : ''}`);
}

export function getClient(id: string): Promise<ClientDetail> {
  return apiFetch<ClientDetail>(`/clients/${id}`);
}

export interface CreateClientPayload {
  type: 'group' | 'direct';
  groupName?: string;
  industry?: string;
  accountManagerId?: string;
  status?: ClientStatus;
  notes?: string;
  company: {
    name: string;
    legalName?: string;
    rfc?: string;
  };
  brand?: {
    name?: string;
  };
}

export function createClient(payload: CreateClientPayload): Promise<ClientDetail> {
  return apiFetch<ClientDetail>('/clients', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface UpdateClientPayload {
  status?: ClientStatus;
  accountManagerId?: string;
  notes?: string;
  crmId?: string;
  corId?: string;
  contpaqId?: string;
  segment?: ClientSegment;
  npsScore?: number;
  lastContactDate?: string;
  dynamicsId?: string;
  website?: string;
  linkedin?: string;
  country?: string;
  city?: string;
  address?: string;
}

export function updateClient(id: string, payload: UpdateClientPayload): Promise<ClientDetail> {
  return apiFetch<ClientDetail>(`/clients/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteClient(id: string): Promise<void> {
  return apiFetch<void>(`/clients/${id}`, {
    method: 'DELETE',
  });
}

export interface CompanyPayload {
  name?: string;
  legalName?: string;
  rfc?: string;
  industry?: string;
}

export function addClientCompany(clientId: string, payload: CompanyPayload): Promise<Company> {
  return apiFetch<Company>(`/clients/${clientId}/companies`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateCompany(companyId: string, payload: CompanyPayload): Promise<Company> {
  return apiFetch<Company>(`/clients/companies/${companyId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function addBrand(companyId: string, payload: { name: string }): Promise<Brand> {
  return apiFetch<Brand>(`/clients/companies/${companyId}/brands`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateBrand(brandId: string, payload: { name?: string }): Promise<Brand> {
  return apiFetch<Brand>(`/clients/brands/${brandId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function getClientFinancial(clientId: string): Promise<FinancialData | null> {
  return apiFetch<FinancialData | null>(`/clients/${clientId}/financial`);
}

export interface UpdateFinancialPayload {
  paymentDays?: number;
  billingEmail?: string;
  billingContact?: string;
  creditLimit?: number;
  currency?: string;
  paymentMethod?: string;
  satPaymentMethod?: string;
  satPaymentForm?: string;
  satCfdiUse?: string;
  satTaxRegime?: string;
  bankName?: string;
  bankAccount?: string;
  bankClabe?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  autoRenewal?: boolean;
  internalNotes?: string;
}

export function updateClientFinancial(clientId: string, payload: UpdateFinancialPayload): Promise<FinancialData> {
  return apiFetch<FinancialData>(`/clients/${clientId}/financial`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function listClientDocuments(clientId: string): Promise<ClientDocumentSummary[]> {
  return apiFetch<ClientDocumentSummary[]>(`/clients/${clientId}/documents`);
}

export function removeClientDocument(docId: string): Promise<void> {
  return apiFetch<void>(`/clients/documents/${docId}`, {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------------------
// Contactos
// ---------------------------------------------------------------------------

export interface CreateContactPayload {
  name: string;
  position?: string;
  area?: string;
  contactType?: ContactType;
  email?: string;
  phone?: string;
  mobile?: string;
  isPrimary?: boolean;
  notes?: string;
}

export type UpdateContactPayload = Partial<CreateContactPayload>;

export function listClientContacts(clientId: string): Promise<Contact[]> {
  return apiFetch<Contact[]>(`/clients/${clientId}/contacts`);
}

export function addClientContact(clientId: string, payload: CreateContactPayload): Promise<Contact> {
  return apiFetch<Contact>(`/clients/${clientId}/contacts`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateClientContact(contactId: string, payload: UpdateContactPayload): Promise<Contact> {
  return apiFetch<Contact>(`/clients/contacts/${contactId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function removeClientContact(contactId: string): Promise<void> {
  return apiFetch<void>(`/clients/contacts/${contactId}`, {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------------------
// Empleados (Módulo 3)
// ---------------------------------------------------------------------------

export type EmployeeStatus = 'active' | 'inactive';

export type Modality = 'presencial' | 'hibrido' | 'remoto';

export interface EmployeeListItem {
  id: string;
  displayId: string;
  status: EmployeeStatus;
  fullName: string;
  corporateEmail: string | null;
  companyCode: string;
  companyName: string;
  division: string | null;
  area: string | null;
  position: string;
  location: string | null;
  modality: Modality | null;
  seniorityDate: string | null;
  contractEndDate: string | null;
  createdAt: string;
}

export interface EmployeeStats {
  total: number;
  active: number;
  inactive: number;
  companies: number;
  expiringContracts: number;
}

export interface EmployeesPage {
  data: EmployeeListItem[];
  nextCursor: string | null;
  stats: EmployeeStats;
}

export interface EmployeeAuthUserSummary {
  id: string;
  email: string;
  name: string;
}

export interface EmployeeDetail {
  id: string;
  displayId: string;
  codNom: string | null;
  companyCode: string;
  companyName: string;
  division: string | null;
  area: string | null;
  project: string | null;
  level: string | null;
  position: string;
  emailSignature: string | null;
  location: string | null;
  modality: Modality | null;
  contractSchema: string | null;
  fullName: string;
  directReportTo: string | null;
  corporateEmail: string | null;
  gender: string | null;
  nationality: string | null;
  seniorityDate: string | null;
  contractType: string | null;
  contractEndDate: string | null;
  schedule: string | null;
  lunchTime: string | null;
  studies: string | null;
  status: EmployeeStatus;
  authUserId: string | null;
  authUser: EmployeeAuthUserSummary | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateEmployeePayload {
  codNom?: string;
  companyCode: string;
  companyName: string;
  division?: string;
  area?: string;
  project?: string;
  level?: string;
  position: string;
  emailSignature?: string;
  location?: string;
  modality?: Modality;
  contractSchema?: string;
  fullName: string;
  directReportTo?: string;
  corporateEmail?: string;
  gender?: string;
  nationality?: string;
  seniorityDate?: string;
  contractType?: string;
  contractEndDate?: string;
  schedule?: string;
  lunchTime?: string;
  studies?: string;
  status?: EmployeeStatus;
  authUserId?: string;
}

export type UpdateEmployeePayload = Partial<CreateEmployeePayload>;

export interface ListEmployeesParams {
  cursor?: string;
  limit?: number;
  status?: EmployeeStatus;
  companyCode?: string;
  division?: string;
  location?: string;
  search?: string;
}

export function listEmployees(params: ListEmployeesParams = {}): Promise<EmployeesPage> {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.status) query.set('status', params.status);
  if (params.companyCode) query.set('companyCode', params.companyCode);
  if (params.division) query.set('division', params.division);
  if (params.location) query.set('location', params.location);
  if (params.search) query.set('search', params.search);

  const qs = query.toString();
  return apiFetch<EmployeesPage>(`/employees${qs ? `?${qs}` : ''}`);
}

export function getEmployee(id: string): Promise<EmployeeDetail> {
  return apiFetch<EmployeeDetail>(`/employees/${id}`);
}

export function createEmployee(payload: CreateEmployeePayload): Promise<EmployeeDetail> {
  return apiFetch<EmployeeDetail>('/employees', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateEmployee(id: string, payload: UpdateEmployeePayload): Promise<EmployeeDetail> {
  return apiFetch<EmployeeDetail>(`/employees/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteEmployee(id: string): Promise<void> {
  return apiFetch<void>(`/employees/${id}`, {
    method: 'DELETE',
  });
}

// Datos personales (acceso restringido: ADMIN_RRHH, SUPER_ADMIN)

export interface EmployeePersonalData {
  id: string;
  employeeId: string;
  rfc: string | null;
  imssNumber: string | null;
  curp: string | null;
  birthDate: string | null;
  bloodType: string | null;
  maritalStatus: string | null;
  children: number;
  phone: string | null;
  street: string | null;
  extNumber: string | null;
  intNumber: string | null;
  neighborhood: string | null;
  postalCode: string | null;
  city: string | null;
  state: string | null;
  mainTransport: string | null;
  commuteTime: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePersonalDataPayload {
  rfc?: string;
  imssNumber?: string;
  curp?: string;
  birthDate?: string;
  bloodType?: string;
  maritalStatus?: string;
  children?: number;
  phone?: string;
  street?: string;
  extNumber?: string;
  intNumber?: string;
  neighborhood?: string;
  postalCode?: string;
  city?: string;
  state?: string;
  mainTransport?: string;
  commuteTime?: string;
}

export function getEmployeePersonalData(employeeId: string): Promise<EmployeePersonalData | null> {
  return apiFetch<EmployeePersonalData | null>(`/employees/${employeeId}/personal`);
}

export function updateEmployeePersonalData(
  employeeId: string,
  payload: UpdatePersonalDataPayload,
): Promise<EmployeePersonalData> {
  return apiFetch<EmployeePersonalData>(`/employees/${employeeId}/personal`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// Compensación (acceso restringido: ADMIN_NOMINA, SUPER_ADMIN)

export interface EmployeeCompensation {
  id: string;
  employeeId: string;
  dailyGrossSalary: string | null;
  monthlyGrossSalary: string | null;
  servicePayment: string | null;
  lastSalaryChange: string | null;
  remoteWorkAllowance: string | null;
  groceryVouchers: string | null;
  gasVouchers: string | null;
  healthInsurance: string | null;
  phoneAllowance: string | null;
  punctualityBonus: string | null;
  otherBenefits: string | null;
  totalGross: string | null;
  netEstimate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateCompensationPayload {
  dailyGrossSalary?: number;
  monthlyGrossSalary?: number;
  servicePayment?: number;
  lastSalaryChange?: string;
  remoteWorkAllowance?: number;
  groceryVouchers?: number;
  gasVouchers?: number;
  healthInsurance?: string;
  phoneAllowance?: number;
  punctualityBonus?: number;
  otherBenefits?: string;
  totalGross?: number;
  netEstimate?: number;
}

export function getEmployeeCompensation(employeeId: string): Promise<EmployeeCompensation | null> {
  return apiFetch<EmployeeCompensation | null>(`/employees/${employeeId}/compensation`);
}

export function updateEmployeeCompensation(
  employeeId: string,
  payload: UpdateCompensationPayload,
): Promise<EmployeeCompensation> {
  return apiFetch<EmployeeCompensation>(`/employees/${employeeId}/compensation`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// Vacaciones

export interface EmployeeVacation {
  id: string;
  employeeId: string;
  year: number;
  openingBalance: string | null;
  taken: string;
  closingBalance: string | null;
  supportActivityDays: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVacationPayload {
  year: number;
  openingBalance?: number;
  taken?: number;
  supportActivityDays?: number;
  notes?: string;
}

export type UpdateVacationPayload = Partial<CreateVacationPayload>;

export function listEmployeeVacations(employeeId: string): Promise<EmployeeVacation[]> {
  return apiFetch<EmployeeVacation[]>(`/employees/${employeeId}/vacations`);
}

export function createEmployeeVacation(employeeId: string, payload: CreateVacationPayload): Promise<EmployeeVacation> {
  return apiFetch<EmployeeVacation>(`/employees/${employeeId}/vacations`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateEmployeeVacation(vacationId: string, payload: UpdateVacationPayload): Promise<EmployeeVacation> {
  return apiFetch<EmployeeVacation>(`/employees/vacations/${vacationId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// Contactos de emergencia

export interface EmployeeEmergencyContact {
  id: string;
  employeeId: string;
  name: string;
  relationship: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateEmergencyContactPayload {
  name: string;
  relationship?: string;
  phone?: string;
}

export type UpdateEmergencyContactPayload = Partial<CreateEmergencyContactPayload>;

export function listEmployeeContacts(employeeId: string): Promise<EmployeeEmergencyContact[]> {
  return apiFetch<EmployeeEmergencyContact[]>(`/employees/${employeeId}/contacts`);
}

export function addEmployeeContact(
  employeeId: string,
  payload: CreateEmergencyContactPayload,
): Promise<EmployeeEmergencyContact> {
  return apiFetch<EmployeeEmergencyContact>(`/employees/${employeeId}/contacts`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateEmployeeContact(
  contactId: string,
  payload: UpdateEmergencyContactPayload,
): Promise<EmployeeEmergencyContact> {
  return apiFetch<EmployeeEmergencyContact>(`/employees/contacts/${contactId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function removeEmployeeContact(contactId: string): Promise<void> {
  return apiFetch<void>(`/employees/contacts/${contactId}`, {
    method: 'DELETE',
  });
}

// Baja (acceso restringido: ADMIN_RRHH, SUPER_ADMIN)

export interface EmployeeTermination {
  id: string;
  employeeId: string;
  terminationDate: string | null;
  reason: string | null;
  severancePaid: boolean;
  severanceAmount: string | null;
  references: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateTerminationPayload {
  terminationDate?: string;
  reason?: string;
  severancePaid?: boolean;
  severanceAmount?: number;
  references?: string;
  notes?: string;
}

export function getEmployeeTermination(employeeId: string): Promise<EmployeeTermination | null> {
  return apiFetch<EmployeeTermination | null>(`/employees/${employeeId}/termination`);
}

export function updateEmployeeTermination(
  employeeId: string,
  payload: UpdateTerminationPayload,
): Promise<EmployeeTermination> {
  return apiFetch<EmployeeTermination>(`/employees/${employeeId}/termination`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// Catálogos (Administración)
// ---------------------------------------------------------------------------

export type CatalogEntity =
  | 'companies'
  | 'locations'
  | 'modalities'
  | 'divisions'
  | 'areas'
  | 'contract_schemas'
  | 'contract_types'
  | 'org_levels'
  | 'blood_types'
  | 'marital_statuses'
  | 'industries'
  | 'document_types';

export interface CatalogItem {
  id: string;
  name: string;
  code?: string | null;
  country?: string | null;
  companyCode?: string | null;
  divisionName?: string | null;
  appliesTo?: string | null;
  isRequired?: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCatalogItemPayload {
  name: string;
  code?: string;
  country?: string;
  companyCode?: string;
  divisionName?: string;
  appliesTo?: string;
  isRequired?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export type UpdateCatalogItemPayload = Partial<CreateCatalogItemPayload>;

export function listCatalogItems(entity: CatalogEntity): Promise<CatalogItem[]> {
  return apiFetch<CatalogItem[]>(`/catalogs/${entity}`);
}

export function listActiveCatalogItems(entity: CatalogEntity): Promise<CatalogItem[]> {
  return apiFetch<CatalogItem[]>(`/catalogs/${entity}/active`);
}

export function createCatalogItem(entity: CatalogEntity, payload: CreateCatalogItemPayload): Promise<CatalogItem> {
  return apiFetch<CatalogItem>(`/catalogs/${entity}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateCatalogItem(
  entity: CatalogEntity,
  id: string,
  payload: UpdateCatalogItemPayload,
): Promise<CatalogItem> {
  return apiFetch<CatalogItem>(`/catalogs/${entity}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deactivateCatalogItem(entity: CatalogEntity, id: string): Promise<void> {
  return apiFetch<void>(`/catalogs/${entity}/${id}`, {
    method: 'DELETE',
  });
}
