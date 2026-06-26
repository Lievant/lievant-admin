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
  location: string | null;
  roles: { id: string; name: string }[];
  permissions: { section: string; module: string; action: string }[];
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

// Documentos generados (contratos, convenios)

export type EmployeeDocumentType =
  | 'contrato_determinado'
  | 'contrato_indeterminado'
  | 'convenio_practicas'
  | 'confidencialidad'
  | 'no_competencia';

export interface GeneratedDocument {
  base64: string;
  filename: string;
}

export async function generateEmployeeDocument(
  employeeId: string,
  docType: EmployeeDocumentType,
  extraParams: Record<string, string> = {},
): Promise<GeneratedDocument> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  const query = new URLSearchParams(extraParams);
  const qs = query.toString();

  const res = await fetch(`${API_URL}/employees/${employeeId}/documents/${docType}${qs ? `?${qs}` : ''}`, {
    credentials: 'include',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    cache: 'no-store',
  });

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

  const arrayBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  const disposition = res.headers.get('content-disposition');
  const match = disposition?.match(/filename="(.+)"/);
  const filename = match?.[1] ?? `${docType}.docx`;

  return { base64, filename };
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
  | 'document_types'
  | 'vendor_categories'
  | 'employee_document_types';

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

// ---------------------------------------------------------------------------
// Proveedores (Finanzas)
// ---------------------------------------------------------------------------

export type VendorStatus = 'activo' | 'inactivo';

export type ProductType = 'producto' | 'servicio';

export type POStatus = 'borrador' | 'aprobada' | 'cerrada';

export type InvoiceStatus = 'pendiente' | 'pagada';

export interface VendorProduct {
  id: string;
  vendorId: string;
  name: string;
  type: ProductType;
  description: string | null;
  unitPrice: string | null;
  currency: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface POLineItem {
  id: string;
  poId: string;
  productId: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
  total: string;
  sortOrder: number;
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorId: string;
  status: POStatus;
  notes: string | null;
  subtotal: string;
  tax: string;
  total: string;
  approvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  createdBy: string;
  updatedBy: string;
  lineItems?: POLineItem[];
  invoices?: Invoice[];
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: string;
  paymentDate: string;
  paymentMethod: string | null;
  reference: string | null;
  voucherS3Key: string | null;
  notes: string | null;
  createdAt: string;
  createdBy: string;
}

export interface Invoice {
  id: string;
  vendorId: string;
  poId: string | null;
  invoiceNumber: string;
  amount: string;
  tax: string;
  total: string;
  issueDate: string;
  dueDate: string | null;
  status: InvoiceStatus;
  pdfS3Key: string | null;
  pdfUrl?: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  createdBy: string;
  updatedBy: string;
  payments?: Payment[];
}

export interface VendorDocument {
  id: string;
  vendorId: string;
  type: string;
  name: string;
  s3Key: string;
  fileSize: number | null;
  uploadedAt: string;
  uploadedBy: string;
  downloadUrl?: string;
  deletedAt: string | null;
}

export interface Vendor {
  id: string;
  name: string;
  tradeName: string | null;
  rfc: string;
  categoryId: string | null;
  status: VendorStatus;
  paymentTermsDays: number | null;
  clabe: string | null;
  bankName: string | null;
  bankAccount: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  createdBy: string;
  updatedBy: string;
}

export interface VendorDetail extends Vendor {
  products: VendorProduct[];
  purchaseOrders: PurchaseOrder[];
  invoices: Invoice[];
  documents: VendorDocument[];
}

export interface VendorStatement {
  total_pending: number;
  total_paid: number;
  invoices: Invoice[];
}

export interface ListVendorsParams {
  category_id?: string;
  status?: VendorStatus;
  search?: string;
}

export function listVendors(params: ListVendorsParams = {}): Promise<Vendor[]> {
  const query = new URLSearchParams();
  if (params.category_id) query.set('category_id', params.category_id);
  if (params.status) query.set('status', params.status);
  if (params.search) query.set('search', params.search);

  const qs = query.toString();
  return apiFetch<Vendor[]>(`/vendors${qs ? `?${qs}` : ''}`);
}

export function getVendor(id: string): Promise<VendorDetail> {
  return apiFetch<VendorDetail>(`/vendors/${id}`);
}

export interface CreateVendorPayload {
  name: string;
  trade_name?: string;
  rfc: string;
  category_id?: string;
  status?: VendorStatus;
  payment_terms_days?: number;
  clabe?: string;
  bank_name?: string;
  bank_account?: string;
  notes?: string;
}

export function createVendor(payload: CreateVendorPayload): Promise<VendorDetail> {
  return apiFetch<VendorDetail>('/vendors', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type UpdateVendorPayload = Partial<CreateVendorPayload>;

export function updateVendor(id: string, payload: UpdateVendorPayload): Promise<VendorDetail> {
  return apiFetch<VendorDetail>(`/vendors/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function listVendorProducts(vendorId: string): Promise<VendorProduct[]> {
  return apiFetch<VendorProduct[]>(`/vendors/${vendorId}/products`);
}

export interface CreateProductPayload {
  name: string;
  type: ProductType;
  description?: string;
  unit_price?: number;
  currency?: string;
  is_active?: boolean;
}

export function addVendorProduct(vendorId: string, payload: CreateProductPayload): Promise<VendorProduct> {
  return apiFetch<VendorProduct>(`/vendors/${vendorId}/products`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface ListPurchaseOrdersParams {
  status?: POStatus;
}

export function listVendorPurchaseOrders(
  vendorId: string,
  params: ListPurchaseOrdersParams = {},
): Promise<PurchaseOrder[]> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);

  const qs = query.toString();
  return apiFetch<PurchaseOrder[]>(`/vendors/${vendorId}/purchase-orders${qs ? `?${qs}` : ''}`);
}

export interface CreatePOLineItemPayload {
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
}

export interface CreatePurchaseOrderPayload {
  vendor_id: string;
  notes?: string;
  line_items: CreatePOLineItemPayload[];
}

export function createPurchaseOrder(payload: CreatePurchaseOrderPayload): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>('/purchase-orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getPurchaseOrder(poId: string): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>(`/purchase-orders/${poId}`);
}

export function updatePOStatus(poId: string, status: POStatus): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>(`/purchase-orders/${poId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export interface ListInvoicesParams {
  status?: InvoiceStatus;
  date_from?: string;
  date_to?: string;
}

export function listVendorInvoices(vendorId: string, params: ListInvoicesParams = {}): Promise<Invoice[]> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.date_from) query.set('date_from', params.date_from);
  if (params.date_to) query.set('date_to', params.date_to);

  const qs = query.toString();
  return apiFetch<Invoice[]>(`/vendors/${vendorId}/invoices${qs ? `?${qs}` : ''}`);
}

export function getVendorStatement(vendorId: string): Promise<VendorStatement> {
  return apiFetch<VendorStatement>(`/vendors/${vendorId}/statement`);
}

export interface CreateInvoicePayload {
  vendor_id: string;
  po_id?: string;
  invoice_number: string;
  amount: number;
  tax?: number;
  total: number;
  issue_date: string;
  due_date?: string;
  notes?: string;
}

export function createInvoice(payload: CreateInvoicePayload): Promise<Invoice> {
  return apiFetch<Invoice>('/invoices', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listVendorDocuments(vendorId: string): Promise<VendorDocument[]> {
  return apiFetch<VendorDocument[]>(`/vendors/${vendorId}/documents`);
}

export function removeVendorDocument(docId: string): Promise<void> {
  return apiFetch<void>(`/vendors/documents/${docId}`, {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------------------
// Documentos adjuntos de empleados
// ---------------------------------------------------------------------------

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  type: string;
  name: string;
  s3Key: string;
  fileSize: number | null;
  uploadedAt: string;
  uploadedBy: string;
  downloadUrl?: string;
}

export function listEmployeeDocuments(employeeId: string): Promise<EmployeeDocument[]> {
  return apiFetch<EmployeeDocument[]>(`/employees/${employeeId}/documents`);
}

export function removeEmployeeDocument(docId: string): Promise<void> {
  return apiFetch<void>(`/employees/documents/${docId}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Reserva de salas (Herramientas)
// ---------------------------------------------------------------------------

export type RoomType = 'sala_reunion' | 'phone_booth';

export type BookingStatus = 'confirmada' | 'cancelada' | 'pendiente_aprobacion';

export type AdminScope = 'global' | 'office';

export interface Country {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  sortOrder: number;
}

export interface City {
  id: string;
  countryId: string;
  name: string;
  timezone: string;
  isActive: boolean;
  sortOrder: number;
}

export interface Office {
  id: string;
  cityId: string;
  name: string;
  address: string | null;
  isActive: boolean;
  sortOrder: number;
  city?: City;
}

export interface CityWithOffices extends City {
  offices: Office[];
}

export interface CountryWithCities extends Country {
  cities: CityWithOffices[];
}

export interface Room {
  id: string;
  officeId: string;
  name: string;
  type: RoomType;
  capacity: number;
  floor: string | null;
  amenities: string[];
  openTime: string;
  closeTime: string;
  maxBookingHours: number;
  requiresApprovalOverHours: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  office?: Office;
}

export interface RoomAvailability extends Room {
  is_available: boolean;
  occupied_by?: { userName: string; title: string };
}

export interface BookingUserSummary {
  id: string;
  name: string;
  email: string;
}

export interface Booking {
  id: string;
  roomId: string;
  userId: string;
  title: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  isRecurring: boolean;
  recurrenceRule: string | null;
  recurrenceEndDate: string | null;
  recurrenceGroupId: string | null;
  msEventId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  cancelledBy: string | null;
  room?: Room;
  user?: BookingUserSummary;
}

export interface AdminScopeInfo {
  isGlobalAdmin: boolean;
  officeIds: string[];
}

export function getLocationsTree(): Promise<CountryWithCities[]> {
  return apiFetch<CountryWithCities[]>('/rooms/locations');
}

export function listRoomCountries(): Promise<Country[]> {
  return apiFetch<Country[]>('/rooms/locations/countries');
}

export function listRoomCitiesByCountry(countryId: string): Promise<City[]> {
  return apiFetch<City[]>(`/rooms/locations/countries/${countryId}/cities`);
}

export function listRoomOfficesByCity(cityId: string): Promise<Office[]> {
  return apiFetch<Office[]>(`/rooms/locations/cities/${cityId}/offices`);
}

export function getRoomAdminScope(): Promise<AdminScopeInfo> {
  return apiFetch<AdminScopeInfo>('/rooms/locations/admin-scope');
}

export interface SearchRoomsParams {
  office_id: string;
  date: string;
  start_time: string;
  duration_hours: number;
  room_type?: RoomType;
}

export function searchRooms(params: SearchRoomsParams): Promise<RoomAvailability[]> {
  const query = new URLSearchParams();
  query.set('office_id', params.office_id);
  query.set('date', params.date);
  query.set('start_time', params.start_time);
  query.set('duration_hours', String(params.duration_hours));
  if (params.room_type) query.set('room_type', params.room_type);

  return apiFetch<RoomAvailability[]>(`/rooms?${query.toString()}`);
}

export function getRoom(id: string): Promise<Room> {
  return apiFetch<Room>(`/rooms/${id}`);
}

export function listRoomsByOffice(officeId: string): Promise<Room[]> {
  return apiFetch<Room[]>(`/rooms/admin?office_id=${officeId}`);
}

export interface CreateRoomPayload {
  office_id: string;
  name: string;
  type: RoomType;
  capacity: number;
  floor?: string;
  amenities?: string[];
  open_time?: string;
  close_time?: string;
  max_booking_hours?: number;
  requires_approval_over_hours?: number;
  notes?: string;
}

export type UpdateRoomPayload = Partial<Omit<CreateRoomPayload, 'office_id'>>;

export function createRoom(payload: CreateRoomPayload): Promise<Room> {
  return apiFetch<Room>('/rooms', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateRoom(id: string, payload: UpdateRoomPayload): Promise<Room> {
  return apiFetch<Room>(`/rooms/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function toggleRoomActive(id: string): Promise<Room> {
  return apiFetch<Room>(`/rooms/${id}/toggle-active`, {
    method: 'PATCH',
  });
}

export interface CreateBookingPayload {
  room_id: string;
  title: string;
  start_time: string;
  end_time: string;
  is_recurring?: boolean;
  recurrence_rule?: string;
  recurrence_end_date?: string;
  notes?: string;
}

export function createBooking(payload: CreateBookingPayload): Promise<Booking[]> {
  return apiFetch<Booking[]>('/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface CancelBookingPayload {
  cancel_series?: boolean;
}

export function cancelBooking(id: string, payload: CancelBookingPayload = {}): Promise<Booking[]> {
  return apiFetch<Booking[]>(`/bookings/${id}`, {
    method: 'DELETE',
    body: JSON.stringify(payload),
  });
}

export function approveBooking(id: string): Promise<Booking> {
  return apiFetch<Booking>(`/bookings/${id}/approve`, {
    method: 'PATCH',
  });
}

export function rejectBooking(id: string): Promise<Booking> {
  return apiFetch<Booking>(`/bookings/${id}/reject`, {
    method: 'PATCH',
  });
}

export interface ListMyBookingsParams {
  status?: BookingStatus;
  upcoming?: boolean;
}

export function listMyBookings(params: ListMyBookingsParams = {}): Promise<Booking[]> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.upcoming !== undefined) query.set('upcoming', String(params.upcoming));

  const qs = query.toString();
  return apiFetch<Booking[]>(`/bookings/my${qs ? `?${qs}` : ''}`);
}

export interface ListAdminBookingsParams {
  office_id?: string;
  room_id?: string;
  status?: BookingStatus;
  date_from?: string;
  date_to?: string;
}

export function listAdminBookings(params: ListAdminBookingsParams = {}): Promise<Booking[]> {
  const query = new URLSearchParams();
  if (params.office_id) query.set('office_id', params.office_id);
  if (params.room_id) query.set('room_id', params.room_id);
  if (params.status) query.set('status', params.status);
  if (params.date_from) query.set('date_from', params.date_from);
  if (params.date_to) query.set('date_to', params.date_to);

  const qs = query.toString();
  return apiFetch<Booking[]>(`/bookings/admin${qs ? `?${qs}` : ''}`);
}

export function listPendingApprovals(): Promise<Booking[]> {
  return apiFetch<Booking[]>('/bookings/pending-approval');
}

export interface CreateRoomCountryPayload {
  name: string;
  code: string;
  sort_order?: number;
}

export function createRoomCountry(payload: CreateRoomCountryPayload): Promise<Country> {
  return apiFetch<Country>('/rooms/locations/countries', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface CreateRoomCityPayload {
  country_id: string;
  name: string;
  timezone?: string;
  sort_order?: number;
}

export function createRoomCity(payload: CreateRoomCityPayload): Promise<City> {
  return apiFetch<City>('/rooms/locations/cities', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface CreateRoomOfficePayload {
  city_id: string;
  name: string;
  address?: string;
  sort_order?: number;
}

export function createRoomOffice(payload: CreateRoomOfficePayload): Promise<Office> {
  return apiFetch<Office>('/rooms/locations/offices', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type UpdateRoomOfficePayload = Partial<CreateRoomOfficePayload> & { is_active?: boolean };

export function updateRoomOffice(id: string, payload: UpdateRoomOfficePayload): Promise<Office> {
  return apiFetch<Office>(`/rooms/locations/offices/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// Permisos (Administración)
// ---------------------------------------------------------------------------

export interface PermissionDef {
  id: string;
  section: string | null;
  module: string;
  action: string;
  description: string | null;
}

export interface RoleWithPermissions {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  isSystem: boolean;
  permissions: PermissionDef[];
}

export interface UserPermissionOverride {
  id: string;
  permissionId: string;
  granted: boolean;
  grantedAt: string;
}

export function listRolesWithPermissions(): Promise<RoleWithPermissions[]> {
  return apiFetch<RoleWithPermissions[]>('/auth/roles');
}

export function listAllPermissions(): Promise<PermissionDef[]> {
  return apiFetch<PermissionDef[]>('/auth/permissions');
}

export function getUserPermissionOverrides(userId: string): Promise<UserPermissionOverride[]> {
  return apiFetch<UserPermissionOverride[]>(`/auth/users/${userId}/permissions`);
}

export function setUserPermission(
  userId: string,
  permissionId: string,
  granted: boolean,
): Promise<UserPermissionOverride> {
  return apiFetch<UserPermissionOverride>(`/auth/users/${userId}/permissions`, {
    method: 'POST',
    body: JSON.stringify({ permissionId, granted }),
  });
}

export function removeUserPermissionOverride(userId: string, permissionId: string): Promise<void> {
  return apiFetch<void>(`/auth/users/${userId}/permissions/${permissionId}`, {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------------------
// Reportes RRHH
// ---------------------------------------------------------------------------

export interface BirthdayReportItem {
  id: string;
  fullName: string;
  area: string | null;
  division: string | null;
  position: string;
  companyCode: string;
  companyName: string;
  seniorityDate: string | null;
  birthDate: string; // "MM-DD"
}

export function getBirthdayReport(
  month: number,
  orderBy: 'date' | 'name' | 'area' = 'date',
): Promise<BirthdayReportItem[]> {
  return apiFetch<BirthdayReportItem[]>(`/employees/reports/birthdays?month=${month}&orderBy=${orderBy}`);
}
