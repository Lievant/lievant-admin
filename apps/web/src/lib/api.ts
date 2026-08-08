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

export type ErrorKind = 'forbidden' | 'unavailable';

// 403 (permisos) se muestra distinto a un error de red/servidor (5xx) — ver
// componente <NoPermissions />. Usado por el helper `safe()` de cada page.tsx.
export function errorKindOf(error: unknown): ErrorKind {
  return error instanceof ApiError && error.status === 403 ? 'forbidden' : 'unavailable';
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

export async function apiFetchWithRetry<T>(
  path: string,
  options?: RequestInit,
  retries = 3,
  delay = 1000,
): Promise<T> {
  try {
    return await apiFetch<T>(path, options);
  } catch (error) {
    const isNetworkError =
      error instanceof TypeError && error.message.toLowerCase().includes('fetch');

    if (retries > 0 && isNetworkError) {
      await new Promise<void>((r) => setTimeout(r, delay));
      return apiFetchWithRetry<T>(path, options, retries - 1, delay * 2);
    }
    throw error;
  }
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
  return apiFetchWithRetry<CurrentUser>('/auth/me');
}

export function listUsers(): Promise<UserSummary[]> {
  return apiFetchWithRetry<UserSummary[]>('/users');
}

export function listRoles(): Promise<RoleSummary[]> {
  return apiFetchWithRetry<RoleSummary[]>('/roles');
}

export function createUser(payload: CreateUserPayload): Promise<UserSummary> {
  return apiFetchWithRetry<UserSummary>('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateUser(id: string, payload: UpdateUserPayload): Promise<UserSummary> {
  return apiFetchWithRetry<UserSummary>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteUser(id: string): Promise<void> {
  return apiFetchWithRetry<void>(`/users/${id}`, {
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

export type DocStatus = 'complete' | 'incomplete' | 'no_required';

export interface ClientListItem {
  id: string;
  displayId: string;
  status: ClientStatus;
  group: ClientGroupSummary | null;
  primaryCompany: ClientCompanySummary;
  accountManager: ClientAccountManagerSummary | null;
  companiesCount: number;
  brandsCount: number;
  docStatus: DocStatus;
  country: string | null;
  city: string | null;
  createdAt: string;
}

export interface ClientsPage {
  data: ClientListItem[];
  nextCursor: string | null;
  total: number;
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
  docStatus?: DocStatus;
}

export function listClients(params: ListClientsParams = {}): Promise<ClientsPage> {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.status) query.set('status', params.status);
  if (params.accountManagerId) query.set('accountManagerId', params.accountManagerId);
  if (params.industry) query.set('industry', params.industry);
  if (params.search) query.set('search', params.search);
  if (params.docStatus) query.set('docStatus', params.docStatus);

  const qs = query.toString();
  return apiFetchWithRetry<ClientsPage>(`/clients${qs ? `?${qs}` : ''}`);
}

export function getClient(id: string): Promise<ClientDetail> {
  return apiFetchWithRetry<ClientDetail>(`/clients/${id}`);
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
  return apiFetchWithRetry<ClientDetail>('/clients', {
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
  return apiFetchWithRetry<ClientDetail>(`/clients/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteClient(id: string): Promise<void> {
  return apiFetchWithRetry<void>(`/clients/${id}`, {
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
  return apiFetchWithRetry<Company>(`/clients/${clientId}/companies`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateCompany(companyId: string, payload: CompanyPayload): Promise<Company> {
  return apiFetchWithRetry<Company>(`/clients/companies/${companyId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function addBrand(companyId: string, payload: { name: string }): Promise<Brand> {
  return apiFetchWithRetry<Brand>(`/clients/companies/${companyId}/brands`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateBrand(brandId: string, payload: { name?: string }): Promise<Brand> {
  return apiFetchWithRetry<Brand>(`/clients/brands/${brandId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function getClientFinancial(clientId: string): Promise<FinancialData | null> {
  return apiFetchWithRetry<FinancialData | null>(`/clients/${clientId}/financial`);
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
  return apiFetchWithRetry<FinancialData>(`/clients/${clientId}/financial`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function listClientDocuments(clientId: string): Promise<ClientDocumentSummary[]> {
  return apiFetchWithRetry<ClientDocumentSummary[]>(`/clients/${clientId}/documents`);
}

export function listClientDocumentTypes(): Promise<CatalogItem[]> {
  return apiFetchWithRetry<CatalogItem[]>('/catalogs/document_types/active?appliesTo=client');
}

export interface MissingDocumentReportItem {
  clientId: string;
  displayId: string;
  companyName: string;
  requiredDocs: string[];
  uploadedDocs: string[];
  missingDocs: string[];
  completionPct: number;
}

export function getMissingDocumentsReport(): Promise<MissingDocumentReportItem[]> {
  return apiFetchWithRetry<MissingDocumentReportItem[]>('/clients/reports/missing-documents');
}

export function removeClientDocument(docId: string): Promise<void> {
  return apiFetchWithRetry<void>(`/clients/documents/${docId}`, {
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
  return apiFetchWithRetry<Contact[]>(`/clients/${clientId}/contacts`);
}

export function addClientContact(clientId: string, payload: CreateContactPayload): Promise<Contact> {
  return apiFetchWithRetry<Contact>(`/clients/${clientId}/contacts`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateClientContact(contactId: string, payload: UpdateContactPayload): Promise<Contact> {
  return apiFetchWithRetry<Contact>(`/clients/contacts/${contactId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function removeClientContact(contactId: string): Promise<void> {
  return apiFetchWithRetry<void>(`/clients/contacts/${contactId}`, {
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
  docStatus: DocStatus;
  createdAt: string;
}

export interface ExpiringContractItem {
  id: string;
  displayId: string;
  fullName: string;
  position: string;
  area: string | null;
  division: string | null;
  companyName: string;
  contractType: string | null;
  contractEndDate: string;
  daysUntilExpiry: number;
}

export interface EmployeeStats {
  total: number;
  active: number;
  inactive: number;
  companies: number;
  expiringContracts: number;
  newHires: number;
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
  directReportToId: string | null;
  corporateEmail: string | null;
  gender: string | null;
  nationality: string | null;
  seniorityDate: string | null;
  contractType: string | null;
  contractEndDate: string | null;
  schedule: string | null;
  workDays: number[] | null;
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
  directReportToId?: string;
  corporateEmail?: string;
  gender?: string;
  nationality?: string;
  seniorityDate?: string;
  contractType?: string;
  contractEndDate?: string;
  schedule?: string;
  workDays?: number[];
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
  docStatus?: DocStatus;
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
  if (params.docStatus) query.set('docStatus', params.docStatus);

  const qs = query.toString();
  return apiFetchWithRetry<EmployeesPage>(`/employees${qs ? `?${qs}` : ''}`);
}

export function getExpiringContracts(days = 30): Promise<ExpiringContractItem[]> {
  return apiFetchWithRetry<ExpiringContractItem[]>(`/employees/reports/expiring-contracts?days=${days}`);
}

export function getEmployee(id: string): Promise<EmployeeDetail> {
  return apiFetchWithRetry<EmployeeDetail>(`/employees/${id}`);
}

export function createEmployee(payload: CreateEmployeePayload): Promise<EmployeeDetail> {
  return apiFetchWithRetry<EmployeeDetail>('/employees', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateEmployee(id: string, payload: UpdateEmployeePayload): Promise<EmployeeDetail> {
  return apiFetchWithRetry<EmployeeDetail>(`/employees/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteEmployee(id: string): Promise<void> {
  return apiFetchWithRetry<void>(`/employees/${id}`, {
    method: 'DELETE',
  });
}

// Datos personales (acceso restringido: permiso rrhh.empleados.personal, SUPER_ADMIN)

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
  return apiFetchWithRetry<EmployeePersonalData | null>(`/employees/${employeeId}/personal`);
}

export function updateEmployeePersonalData(
  employeeId: string,
  payload: UpdatePersonalDataPayload,
): Promise<EmployeePersonalData> {
  return apiFetchWithRetry<EmployeePersonalData>(`/employees/${employeeId}/personal`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// Compensación (acceso restringido: permiso rrhh.empleados.nomina, SUPER_ADMIN)

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
  return apiFetchWithRetry<EmployeeCompensation | null>(`/employees/${employeeId}/compensation`);
}

export function updateEmployeeCompensation(
  employeeId: string,
  payload: UpdateCompensationPayload,
): Promise<EmployeeCompensation> {
  return apiFetchWithRetry<EmployeeCompensation>(`/employees/${employeeId}/compensation`, {
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
  return apiFetchWithRetry<EmployeeEmergencyContact[]>(`/employees/${employeeId}/contacts`);
}

export function addEmployeeContact(
  employeeId: string,
  payload: CreateEmergencyContactPayload,
): Promise<EmployeeEmergencyContact> {
  return apiFetchWithRetry<EmployeeEmergencyContact>(`/employees/${employeeId}/contacts`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateEmployeeContact(
  contactId: string,
  payload: UpdateEmergencyContactPayload,
): Promise<EmployeeEmergencyContact> {
  return apiFetchWithRetry<EmployeeEmergencyContact>(`/employees/contacts/${contactId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function removeEmployeeContact(contactId: string): Promise<void> {
  return apiFetchWithRetry<void>(`/employees/contacts/${contactId}`, {
    method: 'DELETE',
  });
}

// Baja (acceso restringido: permiso rrhh.empleados.personal, SUPER_ADMIN)

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
  return apiFetchWithRetry<EmployeeTermination | null>(`/employees/${employeeId}/termination`);
}

export function updateEmployeeTermination(
  employeeId: string,
  payload: UpdateTerminationPayload,
): Promise<EmployeeTermination> {
  return apiFetchWithRetry<EmployeeTermination>(`/employees/${employeeId}/termination`, {
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
  | 'document_types_client'
  | 'document_types_vendor'
  | 'document_types_employee'
  | 'vendor_categories'
  | 'employee_document_types'
  | 'ticket_assignees'
  | 'holidays'
  | 'equipment_brands';

// Virtual entities that map to document_types filtered by applies_to
const DOCUMENT_TYPE_FILTERS: Partial<Record<CatalogEntity, string>> = {
  document_types_client: 'client',
  document_types_vendor: 'vendor',
  document_types_employee: 'employee',
};

function backendEntity(entity: CatalogEntity): string {
  return entity in DOCUMENT_TYPE_FILTERS ? 'document_types' : entity;
}

export interface CatalogItem {
  id: string;
  name: string;
  description?: string | null;
  code?: string | null;
  country?: string | null;
  companyCode?: string | null;
  divisionName?: string | null;
  email?: string | null;
  role?: string | null;
  appliesTo?: string | null;
  isRequired?: boolean;
  date?: string | null;
  isRecurring?: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCatalogItemPayload {
  name: string;
  description?: string;
  code?: string;
  country?: string;
  companyCode?: string;
  divisionName?: string;
  email?: string;
  role?: string;
  appliesTo?: string;
  isRequired?: boolean;
  date?: string;
  isRecurring?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export type UpdateCatalogItemPayload = Partial<CreateCatalogItemPayload>;

export function listCatalogItems(entity: CatalogEntity): Promise<CatalogItem[]> {
  const filter = DOCUMENT_TYPE_FILTERS[entity];
  if (filter) return apiFetchWithRetry<CatalogItem[]>(`/catalogs/document_types?appliesTo=${filter}`);
  return apiFetchWithRetry<CatalogItem[]>(`/catalogs/${entity}`);
}

export function listActiveCatalogItems(entity: CatalogEntity): Promise<CatalogItem[]> {
  const filter = DOCUMENT_TYPE_FILTERS[entity];
  if (filter) return apiFetchWithRetry<CatalogItem[]>(`/catalogs/document_types/active?appliesTo=${filter}`);
  return apiFetchWithRetry<CatalogItem[]>(`/catalogs/${entity}/active`);
}

export function createCatalogItem(entity: CatalogEntity, payload: CreateCatalogItemPayload): Promise<CatalogItem> {
  return apiFetchWithRetry<CatalogItem>(`/catalogs/${backendEntity(entity)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateCatalogItem(
  entity: CatalogEntity,
  id: string,
  payload: UpdateCatalogItemPayload,
): Promise<CatalogItem> {
  return apiFetchWithRetry<CatalogItem>(`/catalogs/${backendEntity(entity)}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deactivateCatalogItem(entity: CatalogEntity, id: string): Promise<void> {
  return apiFetchWithRetry<void>(`/catalogs/${backendEntity(entity)}/${id}`, {
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
  return apiFetchWithRetry<Vendor[]>(`/vendors${qs ? `?${qs}` : ''}`);
}

export function getVendor(id: string): Promise<VendorDetail> {
  return apiFetchWithRetry<VendorDetail>(`/vendors/${id}`);
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
  return apiFetchWithRetry<VendorDetail>('/vendors', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type UpdateVendorPayload = Partial<CreateVendorPayload>;

export function updateVendor(id: string, payload: UpdateVendorPayload): Promise<VendorDetail> {
  return apiFetchWithRetry<VendorDetail>(`/vendors/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function listVendorProducts(vendorId: string): Promise<VendorProduct[]> {
  return apiFetchWithRetry<VendorProduct[]>(`/vendors/${vendorId}/products`);
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
  return apiFetchWithRetry<VendorProduct>(`/vendors/${vendorId}/products`, {
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
  return apiFetchWithRetry<PurchaseOrder[]>(`/vendors/${vendorId}/purchase-orders${qs ? `?${qs}` : ''}`);
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
  return apiFetchWithRetry<PurchaseOrder>('/purchase-orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getPurchaseOrder(poId: string): Promise<PurchaseOrder> {
  return apiFetchWithRetry<PurchaseOrder>(`/purchase-orders/${poId}`);
}

export function updatePOStatus(poId: string, status: POStatus): Promise<PurchaseOrder> {
  return apiFetchWithRetry<PurchaseOrder>(`/purchase-orders/${poId}/status`, {
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
  return apiFetchWithRetry<Invoice[]>(`/vendors/${vendorId}/invoices${qs ? `?${qs}` : ''}`);
}

export function getVendorStatement(vendorId: string): Promise<VendorStatement> {
  return apiFetchWithRetry<VendorStatement>(`/vendors/${vendorId}/statement`);
}

export function deleteVendor(id: string): Promise<void> {
  return apiFetchWithRetry<void>(`/vendors/${id}`, { method: 'DELETE' });
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
  return apiFetchWithRetry<Invoice>('/invoices', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listVendorDocuments(vendorId: string): Promise<VendorDocument[]> {
  return apiFetchWithRetry<VendorDocument[]>(`/vendors/${vendorId}/documents`);
}

export function removeVendorDocument(docId: string): Promise<void> {
  return apiFetchWithRetry<void>(`/vendors/documents/${docId}`, {
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
  /** Nombre en auth.users de quien subió el documento; null si el usuario ya no existe. */
  uploadedByName: string | null;
  downloadUrl?: string;
}

export function listEmployeeDocuments(employeeId: string): Promise<EmployeeDocument[]> {
  return apiFetchWithRetry<EmployeeDocument[]>(`/employees/${employeeId}/documents`);
}

export function removeEmployeeDocument(docId: string): Promise<void> {
  return apiFetchWithRetry<void>(`/employees/documents/${docId}`, { method: 'DELETE' });
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
  attendees: BookingAttendee[];
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  cancelledBy: string | null;
  room?: Room;
  user?: BookingUserSummary;
}

export interface BookingAttendee {
  email: string;
  name?: string;
}

export interface AdminScopeInfo {
  isGlobalAdmin: boolean;
  officeIds: string[];
}

export function getLocationsTree(): Promise<CountryWithCities[]> {
  return apiFetchWithRetry<CountryWithCities[]>('/rooms/locations');
}

export function listRoomCountries(): Promise<Country[]> {
  return apiFetchWithRetry<Country[]>('/rooms/locations/countries');
}

export function listRoomCitiesByCountry(countryId: string): Promise<City[]> {
  return apiFetchWithRetry<City[]>(`/rooms/locations/countries/${countryId}/cities`);
}

export function listRoomOfficesByCity(cityId: string): Promise<Office[]> {
  return apiFetchWithRetry<Office[]>(`/rooms/locations/cities/${cityId}/offices`);
}

export function getRoomAdminScope(): Promise<AdminScopeInfo> {
  return apiFetchWithRetry<AdminScopeInfo>('/rooms/locations/admin-scope');
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

  return apiFetchWithRetry<RoomAvailability[]>(`/rooms?${query.toString()}`);
}

export function getRoom(id: string): Promise<Room> {
  return apiFetchWithRetry<Room>(`/rooms/${id}`);
}

export function listRoomsByOffice(officeId: string): Promise<Room[]> {
  return apiFetchWithRetry<Room[]>(`/rooms/admin?office_id=${officeId}`);
}

/**
 * Salas activas de una oficina para cualquier usuario autenticado (no requiere
 * permisos de admin, a diferencia de listRoomsByOffice). Alimenta la vista de
 * calendario, que es de solo lectura.
 */
export function listActiveRoomsByOffice(officeId: string): Promise<Room[]> {
  return apiFetchWithRetry<Room[]>(`/rooms/by-office?office_id=${officeId}`);
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
  return apiFetchWithRetry<Room>('/rooms', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateRoom(id: string, payload: UpdateRoomPayload): Promise<Room> {
  return apiFetchWithRetry<Room>(`/rooms/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function toggleRoomActive(id: string): Promise<Room> {
  return apiFetchWithRetry<Room>(`/rooms/${id}/toggle-active`, {
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
  attendees?: BookingAttendee[];
}

export function createBooking(payload: CreateBookingPayload): Promise<Booking[]> {
  return apiFetchWithRetry<Booking[]>('/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface UpdateBookingPayload {
  title?: string;
  start_time?: string;
  end_time?: string;
  notes?: string;
  attendees?: BookingAttendee[];
}

export function updateBooking(id: string, payload: UpdateBookingPayload): Promise<Booking> {
  return apiFetchWithRetry<Booking>(`/bookings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export interface CancelBookingPayload {
  cancel_series?: boolean;
}

export function cancelBooking(id: string, payload: CancelBookingPayload = {}): Promise<Booking[]> {
  return apiFetchWithRetry<Booking[]>(`/bookings/${id}`, {
    method: 'DELETE',
    body: JSON.stringify(payload),
  });
}

export function approveBooking(id: string): Promise<Booking> {
  return apiFetchWithRetry<Booking>(`/bookings/${id}/approve`, {
    method: 'PATCH',
  });
}

export function rejectBooking(id: string): Promise<Booking> {
  return apiFetchWithRetry<Booking>(`/bookings/${id}/reject`, {
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
  return apiFetchWithRetry<Booking[]>(`/bookings/my${qs ? `?${qs}` : ''}`);
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
  return apiFetchWithRetry<Booking[]>(`/bookings/admin${qs ? `?${qs}` : ''}`);
}

export function listPendingApprovals(): Promise<Booking[]> {
  return apiFetchWithRetry<Booking[]>('/bookings/pending-approval');
}

/**
 * Reservas de todas las salas de una oficina para un día, accesible a cualquier
 * usuario autenticado (no requiere permisos de admin). Alimenta la vista de calendario.
 */
export function listCalendarBookings(officeId: string, date: string): Promise<Booking[]> {
  const query = new URLSearchParams();
  query.set('office_id', officeId);
  query.set('date', date);
  return apiFetchWithRetry<Booking[]>(`/bookings/calendar?${query.toString()}`);
}

export interface CreateRoomCountryPayload {
  name: string;
  code: string;
  sort_order?: number;
}

export function createRoomCountry(payload: CreateRoomCountryPayload): Promise<Country> {
  return apiFetchWithRetry<Country>('/rooms/locations/countries', {
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
  return apiFetchWithRetry<City>('/rooms/locations/cities', {
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
  return apiFetchWithRetry<Office>('/rooms/locations/offices', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type UpdateRoomOfficePayload = Partial<CreateRoomOfficePayload> & { is_active?: boolean };

export function updateRoomOffice(id: string, payload: UpdateRoomOfficePayload): Promise<Office> {
  return apiFetchWithRetry<Office>(`/rooms/locations/offices/${id}`, {
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
  return apiFetchWithRetry<RoleWithPermissions[]>('/auth/roles');
}

export function listAllPermissions(): Promise<PermissionDef[]> {
  return apiFetchWithRetry<PermissionDef[]>('/auth/permissions');
}

export function getUserPermissionOverrides(userId: string): Promise<UserPermissionOverride[]> {
  return apiFetchWithRetry<UserPermissionOverride[]>(`/auth/users/${userId}/permissions`);
}

export function setUserPermission(
  userId: string,
  permissionId: string,
  granted: boolean,
): Promise<UserPermissionOverride> {
  return apiFetchWithRetry<UserPermissionOverride>(`/auth/users/${userId}/permissions`, {
    method: 'POST',
    body: JSON.stringify({ permissionId, granted }),
  });
}

export function removeUserPermissionOverride(userId: string, permissionId: string): Promise<void> {
  return apiFetchWithRetry<void>(`/auth/users/${userId}/permissions/${permissionId}`, {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------------------
// HelpDesk / Soporte TI
// ---------------------------------------------------------------------------

export type TicketStatus = 'abierto' | 'en_atencion' | 'en_revision' | 'resuelto' | 'cerrado' | 'cancelado';
export type TicketPriority = 'P1' | 'P2' | 'P3' | 'P4';
export type TicketImpact = 'alto' | 'medio' | 'bajo';

export interface HelpdeskCategorySummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface HelpdeskSubcategorySummary {
  id: string;
  categorySlug: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

export interface TicketHistoryEntry {
  id: string;
  ticketId: string;
  userId: string | null;
  userName: string | null;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  notes: string | null;
  createdAt: string;
}

export interface TicketSummary {
  id: string;
  displayId: string;
  requesterId: string | null;
  requesterName: string;
  requesterArea: string | null;
  category: string;
  subcategory: string | null;
  description: string;
  impact: string;
  priority: TicketPriority | null;
  assignedTo: string | null;
  status: TicketStatus;
  requestedAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  resolutionHours: string | null;
  slaResponseMet: boolean | null;
  slaResolutionMet: boolean | null;
  equipmentId: string | null;
  isHistorical: boolean;
  assigneeName: string | null;
}

export interface TicketDetail extends TicketSummary {
  openedByTd: boolean;
  openedOnBehalfOf: string | null;
  behalfReason: string | null;
  diagnosis: string | null;
  solution: string | null;
  internalNotes: string | null;
  problemStatus: string | null;
  collaboratorConfirmation: boolean | null;
  escalatedTo: string | null;
  escalationReason: string | null;
  timesReopened: number;
  estimatedDelivery: string | null;
  assigneeName: string | null;
  history: TicketHistoryEntry[];
  attachments: TicketAttachmentItem[];
}

export interface TicketAttachmentItem {
  id: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  uploadedAt: string;
  downloadUrl: string;
}

export interface TicketPage {
  data: TicketSummary[];
  nextCursor: string | null;
  total: number;
}

export interface HelpdeskStats {
  total: number;
  openTickets: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byCategory: Record<string, number>;
  byMonth: { month: string; count: number }[];
  top10Requesters: { name: string; count: number }[];
  slaResolutionRate: number | null;
  avgResolutionHours: number | null;
  prev: {
    total: number;
    slaResolutionRate: number | null;
    avgResolutionHours: number | null;
  } | null;
}

export interface TicketAssignee {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  isActive: boolean;
}

export interface ListTicketsParams {
  status?: string;
  priority?: string;
  category?: string;
  area?: string;
  assignedTo?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  slaStatus?: 'ok' | 'warning' | 'overdue';
  cursor?: string;
  limit?: number;
}

export interface CreateTicketPayload {
  category: string;
  subcategory?: string | undefined;
  equipmentId?: string | undefined;
  description: string;
  impact: TicketImpact;
  openedByTd?: boolean | undefined;
  openedOnBehalfOf?: string | undefined;
  behalfReason?: string | undefined;
  estimatedDelivery?: string | undefined;
  assignedTo?: string | undefined;
}

export interface UpdateTicketStatusPayload {
  status: TicketStatus;
  notes?: string | undefined;
}

export interface UpdateTicketPayload {
  priority?: TicketPriority | undefined;
  assignedTo?: string | undefined;
  diagnosis?: string | undefined;
  solution?: string | undefined;
  internalNotes?: string | undefined;
  problemStatus?: string | undefined;
  subcategory?: string | undefined;
  collaboratorConfirmation?: boolean | undefined;
  estimatedDelivery?: string | undefined;
}

export interface EscalateTicketPayload {
  escalateTo: string;
  reason: string;
}

export function getHelpdeskStats(): Promise<HelpdeskStats> {
  return apiFetchWithRetry<HelpdeskStats>('/helpdesk/tickets/stats');
}

export function listTickets(params?: ListTicketsParams): Promise<TicketPage> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set('status', params.status);
  if (params?.priority) sp.set('priority', params.priority);
  if (params?.category) sp.set('category', params.category);
  if (params?.area) sp.set('area', params.area);
  if (params?.assignedTo) sp.set('assignedTo', params.assignedTo);
  if (params?.search) sp.set('search', params.search);
  if (params?.dateFrom) sp.set('dateFrom', params.dateFrom);
  if (params?.dateTo) sp.set('dateTo', params.dateTo);
  if (params?.slaStatus) sp.set('slaStatus', params.slaStatus);
  if (params?.cursor) sp.set('cursor', params.cursor);
  if (params?.limit != null) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  return apiFetchWithRetry<TicketPage>(`/helpdesk/tickets${qs ? `?${qs}` : ''}`);
}

export function getMyTickets(params?: ListTicketsParams): Promise<TicketPage> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set('status', params.status);
  if (params?.cursor) sp.set('cursor', params.cursor);
  if (params?.search) sp.set('search', params.search);
  const qs = sp.toString();
  return apiFetchWithRetry<TicketPage>(`/helpdesk/tickets/my${qs ? `?${qs}` : ''}`);
}

export function getTicket(id: string): Promise<TicketDetail> {
  return apiFetchWithRetry<TicketDetail>(`/helpdesk/tickets/${id}`);
}

export function createTicket(payload: CreateTicketPayload): Promise<TicketSummary> {
  return apiFetchWithRetry<TicketSummary>('/helpdesk/tickets', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateTicketStatus(id: string, payload: UpdateTicketStatusPayload): Promise<TicketSummary> {
  return apiFetchWithRetry<TicketSummary>(`/helpdesk/tickets/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function updateTicket(id: string, payload: UpdateTicketPayload): Promise<TicketSummary> {
  return apiFetchWithRetry<TicketSummary>(`/helpdesk/tickets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function escalateTicket(id: string, payload: EscalateTicketPayload): Promise<TicketSummary> {
  return apiFetchWithRetry<TicketSummary>(`/helpdesk/tickets/${id}/escalate`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function getHelpdeskCategories(): Promise<HelpdeskCategorySummary[]> {
  return apiFetchWithRetry<HelpdeskCategorySummary[]>('/helpdesk/categories');
}

export function getHelpdeskSubcategories(slug: string): Promise<HelpdeskSubcategorySummary[]> {
  return apiFetchWithRetry<HelpdeskSubcategorySummary[]>(`/helpdesk/categories/${slug}/subcategories`);
}

export function deleteTicket(id: string): Promise<void> {
  return apiFetchWithRetry<void>(`/helpdesk/tickets/${id}`, { method: 'DELETE' });
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
  return apiFetchWithRetry<BirthdayReportItem[]>(`/employees/reports/birthdays?month=${month}&orderBy=${orderBy}`);
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardBooking {
  id: string;
  title: string;
  roomName: string;
  startTime: string;
  endTime: string;
}

export interface DashboardBirthday {
  id: string;
  fullName: string;
  area: string | null;
  division: string | null;
}

export interface DashboardUpcomingBirthday extends DashboardBirthday {
  birthDate: string;
  daysUntil: number;
}

export interface DashboardData {
  todayBookings: DashboardBooking[];
  todayBirthdays: DashboardBirthday[];
  upcomingBirthdays: DashboardUpcomingBirthday[];
}

export function getEmployeeDashboard(): Promise<DashboardData> {
  return apiFetchWithRetry<DashboardData>('/employees/dashboard');
}

// ---------------------------------------------------------------------------
// Comunicados
// ---------------------------------------------------------------------------

export interface Announcement {
  id: string;
  title: string;
  body: string;
  authorId: string;
  author: { id: string; name: string; email: string };
  isActive: boolean;
  createdAt: string;
  eventDate?: string | null;
}

export function listAnnouncements(): Promise<Announcement[]> {
  return apiFetchWithRetry<Announcement[]>('/auth/announcements');
}

export function createAnnouncement(payload: { title: string; body: string; eventDate?: string }): Promise<Announcement> {
  return apiFetchWithRetry<Announcement>('/auth/announcements', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteAnnouncement(id: string): Promise<void> {
  return apiFetchWithRetry<void>(`/auth/announcements/${id}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Inventario Tecnológico
// ---------------------------------------------------------------------------

export interface EquipmentTypeCatalog {
  id: string;
  name: string;
  icon: string;
  isActive: boolean;
  sortOrder: number;
}

export interface EquipmentBrandCatalog {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

export interface EquipmentStatusCatalog {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  sortOrder: number;
}

export interface EquipmentHistoryEntry {
  id: string;
  equipmentId: string;
  changedById: string | null;
  changedByName: string;
  action: string;
  fieldChanged: string | null;
  oldValue: string | null;
  newValue: string | null;
  notes: string | null;
  createdAt: string;
}

export interface EquipmentSummary {
  id: string;
  displayId: string;
  legacyId: string | null;
  equipmentType: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  operatingSystem: string | null;
  adName: string | null;
  specifications: string | null;
  assignedToEmployeeId: string | null;
  assignedEmployeeName: string | null;
  assignedEmployeeEmail: string | null;
  assignedEmployeePosition: string | null;
  assignmentDate: string | null;
  responsiva: string | null;
  chargerIncluded: boolean;
  status: string;
  location: string | null;
  area: string | null;
  purchaseDate: string | null;
  purchaseValue: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentDetail extends EquipmentSummary {
  history: EquipmentHistoryEntry[];
  assignedEmployee: {
    id: string;
    fullName: string;
    corporateEmail: string | null;
    position: string;
    area: string | null;
    location: string | null;
  } | null;
}

export interface EquipmentPage {
  data: EquipmentSummary[];
  nextCursor: string | null;
  total: number;
}

export interface EmployeeEquipmentItem {
  id: string;
  displayId: string;
  legacyId: string | null;
  equipmentType: string;
  brand: string | null;
  model: string | null;
  status: string;
}

export function getEquipmentByEmployee(employeeId: string): Promise<EmployeeEquipmentItem[]> {
  return apiFetchWithRetry<EmployeeEquipmentItem[]>(`/inventory/equipment/by-employee/${employeeId}`);
}

export interface EquipmentStats {
  total: number;
  assigned: number;
  available: number;
  assignedPercent: number;
  byType: { type: string; count: number }[];
  byStatus: { status: string; count: number }[];
}

export interface ListEquipmentParams {
  cursor?: string;
  limit?: number;
  equipmentType?: string;
  brand?: string;
  status?: string;
  location?: string;
  area?: string;
  assignedToEmployeeId?: string;
  search?: string;
}

export interface CreateEquipmentPayload {
  equipmentType: string;
  legacyId?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  operatingSystem?: string;
  adName?: string;
  specifications?: string;
  assignedToEmployeeId?: string;
  assignmentDate?: string;
  responsiva?: string;
  chargerIncluded?: boolean;
  status?: string;
  location?: string;
  area?: string;
  purchaseDate?: string;
  purchaseValue?: number;
  notes?: string;
}

export type UpdateEquipmentPayload = Partial<CreateEquipmentPayload>;

export interface AssignEmployeePayload {
  employeeId: string;
  assignmentDate?: string;
  responsiva?: string;
  notes?: string;
}

export interface InventoryReportEquipment {
  displayId: string;
  legacyId: string | null;
  equipmentType: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  status: string;
  chargerIncluded: boolean;
}

export interface InventoryReportEmployee {
  employeeId: string;
  fullName: string;
  area: string;
  division: string;
  location: string;
  equipment: InventoryReportEquipment[];
}

export interface InventoryReportArea {
  area: string;
  employees: InventoryReportEmployee[];
}

export interface InventoryAreaReport {
  areas: InventoryReportArea[];
}

export function getInventoryReportByArea(): Promise<InventoryAreaReport> {
  return apiFetchWithRetry<InventoryAreaReport>('/inventory/equipment/report/by-area');
}

export function listEquipment(params: ListEquipmentParams = {}): Promise<EquipmentPage> {
  const q = new URLSearchParams();
  if (params.cursor) q.set('cursor', params.cursor);
  if (params.limit) q.set('limit', String(params.limit));
  if (params.equipmentType) q.set('equipmentType', params.equipmentType);
  if (params.brand) q.set('brand', params.brand);
  if (params.status) q.set('status', params.status);
  if (params.location) q.set('location', params.location);
  if (params.area) q.set('area', params.area);
  if (params.assignedToEmployeeId) q.set('assignedToEmployeeId', params.assignedToEmployeeId);
  if (params.search) q.set('search', params.search);
  const qs = q.toString();
  return apiFetchWithRetry<EquipmentPage>(`/inventory/equipment${qs ? `?${qs}` : ''}`);
}

export function getEquipment(id: string): Promise<EquipmentDetail> {
  return apiFetchWithRetry<EquipmentDetail>(`/inventory/equipment/${id}`);
}

export function getEquipmentStats(): Promise<EquipmentStats> {
  return apiFetchWithRetry<EquipmentStats>('/inventory/equipment/stats');
}

export function createEquipment(payload: CreateEquipmentPayload): Promise<EquipmentDetail> {
  return apiFetchWithRetry<EquipmentDetail>('/inventory/equipment', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateEquipment(id: string, payload: UpdateEquipmentPayload): Promise<EquipmentDetail> {
  return apiFetchWithRetry<EquipmentDetail>(`/inventory/equipment/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function assignEquipmentEmployee(id: string, payload: AssignEmployeePayload): Promise<EquipmentDetail> {
  return apiFetchWithRetry<EquipmentDetail>(`/inventory/equipment/${id}/assign`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function unassignEquipmentEmployee(id: string, notes?: string): Promise<EquipmentDetail> {
  return apiFetchWithRetry<EquipmentDetail>(`/inventory/equipment/${id}/unassign`, {
    method: 'PATCH',
    body: JSON.stringify({ notes }),
  });
}

export function listEquipmentTypes(): Promise<EquipmentTypeCatalog[]> {
  return apiFetchWithRetry<EquipmentTypeCatalog[]>('/inventory/equipment-types');
}

export function listEquipmentBrands(): Promise<EquipmentBrandCatalog[]> {
  return apiFetchWithRetry<EquipmentBrandCatalog[]>('/inventory/equipment-brands');
}

export function listEquipmentStatuses(): Promise<EquipmentStatusCatalog[]> {
  return apiFetchWithRetry<EquipmentStatusCatalog[]>('/inventory/equipment-statuses');
}

export interface MyEquipmentItem {
  id: string;
  displayId: string;
  legacyId: string | null;
  equipmentType: string;
  brand: string | null;
  model: string | null;
  status: string;
}

export function getMyEquipment(): Promise<MyEquipmentItem[]> {
  return apiFetchWithRetry<MyEquipmentItem[]>('/inventory/equipment/my');
}

// ---------------------------------------------------------------------------
// Proyectos
// ---------------------------------------------------------------------------

export interface ProjectMemberSummary {
  id: string;
  projectId: string;
  employeeId: string;
  employeeName: string | null;
  employeeEmail: string | null;
  role: string | null;
  estimatedHoursMonthly: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
}

export interface ProjectBusinessUnit {
  id: string;
  businessUnit: string;
  percentage: string;
}

export interface ProjectFinancials {
  id: string;
  billingType: string;
  currency: string;
  totalValue: string | null;
  monthlyFee: string | null;
  overheadPercentage: string;
  hasCommission: boolean;
  commissionPercentage: string | null;
  commissionEmployeeId: string | null;
  billingDay: number;
  billingNotes: string | null;
  updatedAt: string;
}

export interface ProjectBillingMilestone {
  id: string;
  projectId: string;
  name: string;
  amount: string;
  dueDate: string | null;
  invoicedAt: string | null;
  paidAt: string | null;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface ProjectDocument {
  id: string;
  type: string;
  name: string;
  s3Key: string;
  fileSize: number | null;
  uploadedAt: string;
  downloadUrl?: string;
}

export interface ProjectHistoryEntry {
  id: string;
  changedByName: string;
  action: string;
  fieldChanged: string | null;
  oldValue: string | null;
  newValue: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ProjectSummary {
  id: string;
  displayId: string;
  name: string;
  projectType: string;
  status: string;
  primaryBusinessUnit: string | null;
  projectManagerId: string | null;
  projectManagerName: string | null;
  projectManagerEmail: string | null;
  clientRecordId: string | null;
  clientName: string | null;
  brandId: string | null;
  brandName: string | null;
  pmCode: string | null;
  corProjectId: string | null;
  corSyncStatus: string;
  startDate: string | null;
  endDate: string | null;
  monthlyFee: string | null;
  totalValue: string | null;
  currency: string;
  createdAt: string;
}

export interface ProjectDetail extends ProjectSummary {
  description: string | null;
  members: ProjectMemberSummary[];
  businessUnits: ProjectBusinessUnit[];
  financials: ProjectFinancials | null;
  milestones: ProjectBillingMilestone[];
  documents: ProjectDocument[];
  history: ProjectHistoryEntry[];
}

export interface ProjectsPage {
  data: ProjectSummary[];
  nextCursor: string | null;
  total: number;
}

export interface ProjectStats {
  total: number;
  active: number;
  recurring: number;
  oneTime: number;
  totalMonthlyFee: number;
  totalPortfolioValue: number;
}

export interface CreateProjectPayload {
  name: string;
  projectType: string;
  description?: string;
  status?: string;
  clientRecordId?: string;
  brandId?: string;
  primaryBusinessUnit?: string;
  projectManagerId?: string;
  startDate?: string;
  endDate?: string;
  pmCode?: string;
  corProjectId?: string;
  businessUnits?: { businessUnit: string; percentage: string }[];
}

export type UpdateProjectPayload = Partial<CreateProjectPayload>;

export interface AddProjectMemberPayload {
  employeeId: string;
  role?: string;
  estimatedHoursMonthly?: string;
  startDate?: string;
  endDate?: string;
}

export interface UpdateProjectFinancialsPayload {
  billingType?: string;
  currency?: string;
  totalValue?: string;
  monthlyFee?: string;
  overheadPercentage?: string;
  hasCommission?: boolean;
  commissionPercentage?: string;
  commissionEmployeeId?: string;
  billingDay?: number;
  billingNotes?: string;
}

export interface AddProjectMilestonePayload {
  name: string;
  amount: string;
  dueDate?: string;
  notes?: string;
  sortOrder?: number;
}

export interface ListProjectsParams {
  status?: string;
  projectType?: string;
  businessUnit?: string;
  clientRecordId?: string;
  projectManagerId?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}

export function listProjects(params: ListProjectsParams = {}): Promise<ProjectsPage> {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.projectType) q.set('projectType', params.projectType);
  if (params.businessUnit) q.set('businessUnit', params.businessUnit);
  if (params.clientRecordId) q.set('clientRecordId', params.clientRecordId);
  if (params.projectManagerId) q.set('projectManagerId', params.projectManagerId);
  if (params.search) q.set('search', params.search);
  if (params.cursor) q.set('cursor', params.cursor);
  if (params.limit) q.set('limit', String(params.limit));
  const qs = q.toString();
  return apiFetchWithRetry<ProjectsPage>(`/projects${qs ? `?${qs}` : ''}`);
}

export function getProject(id: string): Promise<ProjectDetail> {
  return apiFetchWithRetry<ProjectDetail>(`/projects/${id}`);
}

export function getProjectStats(): Promise<ProjectStats> {
  return apiFetchWithRetry<ProjectStats>('/projects/stats');
}

export function createProject(payload: CreateProjectPayload): Promise<ProjectSummary> {
  return apiFetchWithRetry<ProjectSummary>('/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateProject(id: string, payload: UpdateProjectPayload): Promise<ProjectSummary> {
  return apiFetchWithRetry<ProjectSummary>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteProject(id: string): Promise<void> {
  return apiFetchWithRetry<void>(`/projects/${id}`, { method: 'DELETE' });
}

export function addProjectMember(id: string, payload: AddProjectMemberPayload): Promise<ProjectMemberSummary> {
  return apiFetchWithRetry<ProjectMemberSummary>(`/projects/${id}/members`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function removeProjectMember(id: string, employeeId: string): Promise<void> {
  return apiFetchWithRetry<void>(`/projects/${id}/members/${employeeId}`, { method: 'DELETE' });
}

export function updateProjectFinancials(id: string, payload: UpdateProjectFinancialsPayload): Promise<ProjectFinancials> {
  return apiFetchWithRetry<ProjectFinancials>(`/projects/${id}/financials`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function addProjectMilestone(id: string, payload: AddProjectMilestonePayload): Promise<ProjectBillingMilestone> {
  return apiFetchWithRetry<ProjectBillingMilestone>(`/projects/${id}/milestones`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listProjectDocuments(id: string): Promise<ProjectDocument[]> {
  return apiFetchWithRetry<ProjectDocument[]>(`/projects/${id}/documents`);
}

// ---------------------------------------------------------------------------
// Licenciamientos
// ---------------------------------------------------------------------------

export interface LicenseToolSummary {
  toolId: string;
  toolName: string;
  hasAccess: boolean;
  isAdmin: boolean;
}

export interface LicenseEmployeeRow {
  employeeId: string;
  displayId: string;
  fullName: string;
  corporateEmail: string | null;
  area: string | null;
  division: string | null;
  location: string | null;
  photoUrl: string | null;
  activeDirectoryName: string | null;
  responsiva: string | null;
  tools: LicenseToolSummary[];
}

export interface ListLicensesParams {
  search?: string;
  tool?: string;
  hasAccess?: boolean;
  department?: string;
  division?: string;
  location?: string;
}

export function listLicenses(params: ListLicensesParams = {}): Promise<LicenseEmployeeRow[]> {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.tool) q.set('tool', params.tool);
  if (params.hasAccess !== undefined) q.set('hasAccess', String(params.hasAccess));
  if (params.department) q.set('department', params.department);
  if (params.division) q.set('division', params.division);
  if (params.location) q.set('location', params.location);
  const qs = q.toString();
  return apiFetchWithRetry<LicenseEmployeeRow[]>(`/licenses/employees${qs ? `?${qs}` : ''}`);
}

export interface LicenseStatsByTool {
  toolId: string;
  toolName: string;
  count: number;
}

export interface LicenseStats {
  totalEmployeesWithLicenses: number;
  byTool: LicenseStatsByTool[];
}

export function getLicenseStats(): Promise<LicenseStats> {
  return apiFetchWithRetry<LicenseStats>('/licenses/employees/stats');
}

export interface LicenseToolDetail {
  toolId: string;
  toolName: string;
  category: string;
  icon: string;
  color: string;
  hasAccess: boolean;
  isAdmin: boolean;
  grantedAt: string | null;
  revokedAt: string | null;
}

export interface EmployeeLicenseDetail {
  employeeId: string;
  displayId: string;
  fullName: string;
  corporateEmail: string | null;
  position: string;
  area: string | null;
  division: string | null;
  location: string | null;
  photoUrl: string | null;
  activeDirectoryName: string | null;
  responsiva: string | null;
  notes: string | null;
  tools: LicenseToolDetail[];
}

export function getEmployeeLicense(employeeId: string): Promise<EmployeeLicenseDetail> {
  return apiFetchWithRetry<EmployeeLicenseDetail>(`/licenses/employees/${employeeId}`);
}

export function getLicensesByEmployee(employeeId: string): Promise<EmployeeLicenseDetail> {
  return apiFetchWithRetry<EmployeeLicenseDetail>(`/licenses/employees/by-employee/${employeeId}`);
}

export interface UpsertLicensesToolPayload {
  toolId: string;
  hasAccess: boolean;
  isAdmin?: boolean;
  notes?: string;
}

export interface UpsertLicensesPayload {
  activeDirectoryName?: string;
  responsiva?: string;
  notes?: string;
  tools: UpsertLicensesToolPayload[];
}

export function upsertEmployeeLicenses(
  employeeId: string,
  payload: UpsertLicensesPayload,
): Promise<EmployeeLicenseDetail> {
  return apiFetchWithRetry<EmployeeLicenseDetail>(`/licenses/employees/${employeeId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export interface ToolCatalogItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  icon: string;
  color: string;
  isActive: boolean;
  sortOrder: number;
}

export function listLicenseTools(): Promise<ToolCatalogItem[]> {
  return apiFetchWithRetry<ToolCatalogItem[]>('/licenses/tools');
}

export interface CreateToolPayload {
  name: string;
  description?: string;
  category?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
}

export function createTool(payload: CreateToolPayload): Promise<ToolCatalogItem> {
  return apiFetchWithRetry<ToolCatalogItem>('/licenses/tools', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// Vacaciones (Módulo)
// ---------------------------------------------------------------------------

export type VacationRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface VacationBalanceSummary {
  id: string;
  periodStart: string;
  periodEnd: string;
  yearsOfService: number;
  entitledDays: number;
  usedDays: number;
  expiredDays: number;
  availableDays: number;
  isCurrent: boolean;
}

export interface MyVacationBalance {
  employeeId: string;
  fullName: string;
  seniorityDate: string | null;
  workDays: number[];
  balance: VacationBalanceSummary | null;
  firstAnniversary: string | null;
}

export interface VacationRequestItem {
  id: string;
  displayId: string;
  startDate: string;
  endDate: string;
  workingDaysTaken: number;
  status: VacationRequestStatus;
  notes: string | null;
  rejectionReason: string | null;
  approvedAt: string | null;
  createdAt: string;
  /** true si la levantó RRHH en nombre del colaborador. */
  createdByAdmin: boolean;
  substitute: { id: string; fullName: string; corporateEmail: string | null } | null;
  period: { periodStart: string; periodEnd: string } | null;
}

export interface VacationHoliday {
  id: string;
  name: string;
  date: string;
  isRecurring: boolean;
  country: string;
}

export interface PendingApprovalItem {
  id: string;
  displayId: string;
  startDate: string;
  endDate: string;
  workingDaysTaken: number;
  notes: string | null;
  createdAt: string;
  employee: {
    id: string;
    fullName: string;
    position: string;
    corporateEmail: string | null;
    photoUrl: string | null;
  };
  substitute: { id: string; fullName: string; photoUrl: string | null } | null;
}

export interface VacationMovementItem {
  id: string;
  movementType:
    | 'PERIOD_START'
    | 'PERIOD_EXPIRY'
    | 'REQUEST_APPROVED'
    | 'REQUEST_CANCELLED'
    | 'ADMIN_CANCELLED'
    | 'MANUAL_ADJUSTMENT';
  daysDelta: number;
  description: string | null;
  createdAt: string;
}

export interface EmployeeVacationSummary {
  employeeId: string;
  fullName: string;
  seniorityDate: string | null;
  balance: VacationBalanceSummary | null;
  compensation: {
    monthlySalary: number | null;
    dailySalary: number | null;
    estimatedPrima: number | null;
  };
  movements: VacationMovementItem[];
  requests: VacationRequestItem[];
}

export interface VacationReportRow {
  requestId: string;
  displayId: string;
  employeeId: string;
  fullName: string;
  area: string | null;
  startDate: string;
  endDate: string;
  workingDaysTaken: number;
  daysInRange: number;
  daysOutsideRange: number;
  monthlySalary: number | null;
  dailySalary: number | null;
  primaVacacional: number | null;
}

export function getMyVacationBalance(): Promise<MyVacationBalance> {
  return apiFetchWithRetry<MyVacationBalance>('/vacations/my-balance');
}

export function getMyVacationRequests(): Promise<VacationRequestItem[]> {
  return apiFetchWithRetry<VacationRequestItem[]>('/vacations/my-requests');
}

export function getVacationHolidays(year?: number): Promise<VacationHoliday[]> {
  return apiFetchWithRetry<VacationHoliday[]>(`/vacations/holidays${year ? `?year=${year}` : ''}`);
}

export function getEmployeeVacationSummary(employeeId: string): Promise<EmployeeVacationSummary> {
  return apiFetchWithRetry<EmployeeVacationSummary>(`/vacations/employees/${employeeId}/summary`);
}

export function getVacationReport(startDate: string, endDate: string): Promise<VacationReportRow[]> {
  const qs = new URLSearchParams({ startDate, endDate }).toString();
  return apiFetchWithRetry<VacationReportRow[]>(`/vacations/report?${qs}`);
}

// --- Maestro de vacaciones ---

export type AnniversaryWindow = 'week' | 'month' | 'quarter';

export interface VacationMasterRow {
  employeeId: string;
  displayId: string;
  fullName: string;
  area: string | null;
  photoUrl: string | null;
  seniorityDate: string;
  yearsOfService: number;
  /** Meses cumplidos por encima de los años completos (0-11). */
  monthsOfService: number;
  totalMonthsOfService: number;
  anniversaryDate: string;
  daysUntilAnniversary: number;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  entitledDays: number;
  /** Cupo del período: entitled menos expirados, antes de restar solicitudes. */
  availableDays: number;
  requestedDays: number;
  takenDays: number;
  /** availableDays - requestedDays - takenDays. */
  remainingDays: number;
}

export function getVacationMasterReport(params: {
  search?: string;
  anniversaryWithin?: AnniversaryWindow;
} = {}): Promise<VacationMasterRow[]> {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.anniversaryWithin) q.set('anniversary_within', params.anniversaryWithin);
  const qs = q.toString();
  return apiFetchWithRetry<VacationMasterRow[]>(`/vacations/report/master${qs ? `?${qs}` : ''}`);
}

// --- Gestión manual de vacaciones (rrhh.vacaciones.manage) ---

export interface AdminCreateVacationRequestPayload {
  employeeId: string;
  startDate: string;
  endDate: string;
  notes?: string;
  autoApprove?: boolean;
}

export function adminCreateVacationRequest(
  payload: AdminCreateVacationRequestPayload,
): Promise<VacationRequestItem> {
  return apiFetch<VacationRequestItem>('/vacations/requests/admin', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function adminApproveVacationRequest(requestId: string): Promise<VacationRequestItem> {
  return apiFetch<VacationRequestItem>(`/vacations/requests/${requestId}/admin-approve`, {
    method: 'PATCH',
  });
}

/**
 * La usa tanto RRHH como el propio colaborador: el backend decide qué puede
 * borrar cada uno según el estado de la solicitud.
 */
export function deleteVacationRequest(
  requestId: string,
): Promise<{ deleted: true; daysReturned: number }> {
  return apiFetch<{ deleted: true; daysReturned: number }>(`/vacations/requests/${requestId}`, {
    method: 'DELETE',
  });
}

// --- Medios (Control de Pauta) ---

export type PacingStatus = 'green' | 'yellow' | 'red' | 'gray';

export interface MediaPlatform {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  phase: number;
  isActive: boolean;
  dataLatencyHours: number;
  supportsPause: boolean;
}

export interface AccountPacingRow {
  accountId: string;
  nativeAccountId: string;
  nativeAccountName: string | null;
  platform: { id: string; slug: string; name: string; color: string | null; icon: string | null };
  client: { id: string; name: string } | null;
  accountManager: { id: string; name: string } | null;
  currency: string;
  budgetAmount: number | null;
  spendAccumulated: number;
  spendExpected: number | null;
  pctConsumed: number | null;
  pacingPct: number | null;
  spendDailyAvg: number;
  spendDailyIdeal: number | null;
  spendDailyRemaining: number | null;
  projectedClose: number | null;
  daysRemaining: number;
  daysToExhaustion: number | null;
  projectedExhaustionDate: string | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  status: PacingStatus;
}

export interface MediaStats {
  totalBudget: number;
  totalSpend: number;
  pctConsumed: number;
  accountsAtRisk: number;
  totalAccounts: number;
  accountsWithoutBudget: number;
  month: string;
}

export interface MediaSummary {
  stats: MediaStats;
  needsAttention: AccountPacingRow[];
  byClient: Array<{
    clientId: string | null;
    clientName: string;
    accounts: AccountPacingRow[];
    worstStatus: PacingStatus;
  }>;
  platformFreshness: Array<{ slug: string; name: string; lastSyncedAt: string | null }>;
  accountsWithoutBudget: number;
}

export interface MediaBudgetItem {
  id: string;
  adAccountId: string;
  budgetMonth: string;
  amount: number;
  currency: string;
  amountMxn: number | null;
  version: number;
  isCurrent: boolean;
  notes: string | null;
  source: string;
  createdAt: string;
  account?: {
    id: string;
    nativeAccountName: string | null;
    nativeAccountId: string;
    platform: string | null;
    client: string | null;
  };
}

export interface MediaAlertItem {
  id: string;
  adAccountId: string;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: Record<string, unknown> | null;
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  account?: {
    id: string;
    nativeAccountName: string | null;
    platform: string | null;
    platformSlug: string | null;
    client: string | null;
  };
}

export interface MediaDailySpend {
  date: string;
  spendMxn: number;
  spendNative: number;
  currency: string;
  source: string;
}

export interface MediaAccountDetail {
  account: AccountPacingRow;
  raw: {
    id: string;
    platformId: string;
    credentialId: string | null;
    clientRecordId: string | null;
    timezone: string;
    syncEnabled: boolean;
    lastSyncError: string | null;
    createdAt: string;
  };
  dailySpend: MediaDailySpend[];
  budgetHistory: MediaBudgetItem[];
  alerts: MediaAlertItem[];
}

export interface MediaAuditEntry {
  id: string;
  adAccountId: string | null;
  actionType: string;
  reason: string | null;
  success: boolean | null;
  errorMessage: string | null;
  nativeCampaignName: string | null;
  performedBy: string | null;
  createdAt: string;
}

export interface ListMediaAccountsParams {
  platform?: string;
  clientRecordId?: string;
  status?: string;
  month?: string;
  search?: string;
}

export interface CreateMediaAccountPayload {
  platformId: string;
  credentialId?: string;
  clientRecordId?: string;
  nativeAccountId: string;
  nativeAccountName?: string;
  currency?: string;
  timezone?: string;
  accountManagerId?: string;
  isActive?: boolean;
  syncEnabled?: boolean;
}

export interface UpsertMediaBudgetPayload {
  adAccountId: string;
  budgetMonth: string;
  amount: number;
  currency?: string;
  amountMxn?: number;
  approvedBy?: string;
  notes?: string;
  source?: string;
}

export function getMediaSummary(): Promise<MediaSummary> {
  return apiFetchWithRetry<MediaSummary>('/media/summary');
}

export function getMediaStats(): Promise<MediaStats> {
  return apiFetchWithRetry<MediaStats>('/media/stats');
}

export function listMediaPlatforms(): Promise<MediaPlatform[]> {
  return apiFetchWithRetry<MediaPlatform[]>('/media/platforms');
}

export function listMediaAccounts(params: ListMediaAccountsParams = {}): Promise<AccountPacingRow[]> {
  const query = new URLSearchParams();
  if (params.platform) query.set('platform', params.platform);
  if (params.clientRecordId) query.set('clientRecordId', params.clientRecordId);
  if (params.status) query.set('status', params.status);
  if (params.month) query.set('month', params.month);
  if (params.search) query.set('search', params.search);
  const qs = query.toString();
  return apiFetchWithRetry<AccountPacingRow[]>(`/media/accounts${qs ? `?${qs}` : ''}`);
}

export function getMediaAccount(id: string): Promise<MediaAccountDetail> {
  return apiFetchWithRetry<MediaAccountDetail>(`/media/accounts/${id}`);
}

export function createMediaAccount(payload: CreateMediaAccountPayload): Promise<unknown> {
  return apiFetchWithRetry('/media/accounts', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateMediaAccount(
  id: string,
  payload: Partial<CreateMediaAccountPayload>,
): Promise<unknown> {
  return apiFetchWithRetry(`/media/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function getMediaAccountSpend(id: string, days = 30): Promise<MediaDailySpend[]> {
  return apiFetchWithRetry<MediaDailySpend[]>(`/media/accounts/${id}/spend?days=${days}`);
}

export function listMediaBudgets(params: { adAccountId?: string; month?: string } = {}): Promise<
  MediaBudgetItem[]
> {
  const query = new URLSearchParams();
  if (params.adAccountId) query.set('adAccountId', params.adAccountId);
  if (params.month) query.set('month', params.month);
  const qs = query.toString();
  return apiFetchWithRetry<MediaBudgetItem[]>(`/media/budgets${qs ? `?${qs}` : ''}`);
}

export function upsertMediaBudget(payload: UpsertMediaBudgetPayload): Promise<MediaBudgetItem> {
  return apiFetchWithRetry<MediaBudgetItem>('/media/budgets', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateMediaBudget(
  id: string,
  payload: { amount?: number; currency?: string; notes?: string },
): Promise<MediaBudgetItem> {
  return apiFetchWithRetry<MediaBudgetItem>(`/media/budgets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function listMediaAlerts(
  params: { status?: string; severity?: string; adAccountId?: string; alertType?: string } = {},
): Promise<MediaAlertItem[]> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.severity) query.set('severity', params.severity);
  if (params.adAccountId) query.set('adAccountId', params.adAccountId);
  if (params.alertType) query.set('alertType', params.alertType);
  const qs = query.toString();
  return apiFetchWithRetry<MediaAlertItem[]>(`/media/alerts${qs ? `?${qs}` : ''}`);
}

export function getMediaAlertsCount(): Promise<{ count: number }> {
  return apiFetchWithRetry<{ count: number }>('/media/alerts/count');
}

export function acknowledgeMediaAlert(id: string): Promise<MediaAlertItem> {
  return apiFetchWithRetry<MediaAlertItem>(`/media/alerts/${id}/acknowledge`, { method: 'PATCH' });
}

export function getMediaAuditLog(
  params: { adAccountId?: string; actionType?: string; limit?: number } = {},
): Promise<MediaAuditEntry[]> {
  const query = new URLSearchParams();
  if (params.adAccountId) query.set('adAccountId', params.adAccountId);
  if (params.actionType) query.set('actionType', params.actionType);
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiFetchWithRetry<MediaAuditEntry[]>(`/media/audit-log${qs ? `?${qs}` : ''}`);
}

export function triggerMediaSync(): Promise<{ synced: number }> {
  return apiFetchWithRetry<{ synced: number }>('/media/sync/trigger', { method: 'POST' });
}

// --- Medios: credenciales de API ---

export type MediaCredentialType = 'system_token' | 'oauth2' | 'oauth1a' | 'developer_token';
export type MediaCredentialStatus = 'active' | 'expired' | 'inactive';

export interface MediaCredential {
  id: string;
  platformId: string;
  platform: { id: string; name: string; slug: string; color: string | null } | null;
  name: string;
  secretArn: string;
  credentialType: MediaCredentialType;
  mccAccountId: string | null;
  businessAccountId: string | null;
  expiresAt: string | null;
  daysToExpire: number | null;
  isExpired: boolean;
  lastVerifiedAt: string | null;
  notes: string | null;
  isActive: boolean;
  status: MediaCredentialStatus;
  createdAt: string;
}

export interface CreateMediaCredentialPayload {
  platformId: string;
  name: string;
  secretArn: string;
  credentialType: MediaCredentialType;
  mccAccountId?: string;
  businessAccountId?: string;
  expiresAt?: string;
  notes?: string;
}

export interface UpdateMediaCredentialPayload {
  name?: string;
  secretArn?: string;
  credentialType?: MediaCredentialType;
  mccAccountId?: string;
  businessAccountId?: string;
  expiresAt?: string;
  notes?: string;
  isActive?: boolean;
}

export function listMediaCredentials(
  params: { platformId?: string; includeInactive?: boolean } = {},
): Promise<MediaCredential[]> {
  const query = new URLSearchParams();
  if (params.platformId) query.set('platformId', params.platformId);
  if (params.includeInactive) query.set('includeInactive', 'true');
  const qs = query.toString();
  return apiFetchWithRetry<MediaCredential[]>(`/media/credentials${qs ? `?${qs}` : ''}`);
}

export function createMediaCredential(payload: CreateMediaCredentialPayload): Promise<MediaCredential> {
  return apiFetchWithRetry<MediaCredential>('/media/credentials', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateMediaCredential(
  id: string,
  payload: UpdateMediaCredentialPayload,
): Promise<MediaCredential> {
  return apiFetchWithRetry<MediaCredential>(`/media/credentials/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deactivateMediaCredential(id: string): Promise<{ id: string; isActive: boolean }> {
  return apiFetchWithRetry<{ id: string; isActive: boolean }>(`/media/credentials/${id}`, {
    method: 'DELETE',
  });
}

// --- Medios: logs de sincronización ---

export interface MediaSyncLog {
  id: string;
  platform: string | null;
  platformSlug: string | null;
  accountName: string | null;
  syncType: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  status: 'running' | 'success' | 'error' | 'partial';
  recordsFetched: number;
  recordsSaved: number;
  errorMessage: string | null;
  httpStatus: number | null;
}

export function getMediaSyncLogs(
  params: { platformId?: string; accountId?: string; status?: string; limit?: number } = {},
): Promise<MediaSyncLog[]> {
  const query = new URLSearchParams();
  if (params.platformId) query.set('platformId', params.platformId);
  if (params.accountId) query.set('accountId', params.accountId);
  if (params.status) query.set('status', params.status);
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiFetchWithRetry<MediaSyncLog[]>(`/media/sync-logs${qs ? `?${qs}` : ''}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Reportes de gastos por reembolso (FIN-RE-07)
// ═══════════════════════════════════════════════════════════════════════════

export type ExpenseReportStatus =
  | 'draft'
  | 'submitted'
  | 'authorized'
  | 'rejected'
  | 'processed';

export interface ExpenseCatalogItem {
  id: string;
  name: string;
  sortOrder: number;
}

export interface ExpenseCatalogs {
  concepts: ExpenseCatalogItem[];
  types: ExpenseCatalogItem[];
  departments: string[];
}

export interface ExpenseLineItem {
  id: string;
  lineDate: string;
  vendor: string;
  conceptId: string | null;
  conceptName: string | null;
  expenseTypeId: string | null;
  expenseTypeName: string | null;
  subtotal: string;
  tip: string;
  extras: string;
  total: string;
  hasInvoice: boolean;
  invoiceOriginalName: string | null;
  /** Prefirmada, válida 1 hora. Solo viene en el detalle, no en los listados. */
  invoiceUrl?: string | null;
  notes: string | null;
  sortOrder: number;
}

export interface ExpenseReportItem {
  id: string;
  documentCode: string;
  documentVersion: string;
  documentClassification: string;
  reportNumber: string | null;
  requesterId: string;
  requester?: { id: string; name: string | null; email: string } | null;
  requesterEmployee?: { id: string; fullName: string } | null;
  authorizerId: string | null;
  authorizerEmployee?: { id: string; fullName: string } | null;
  department: string | null;
  motive: string;
  periodStart: string;
  periodEnd: string;
  totalSubtotal: string;
  totalTip: string;
  totalExtras: string;
  totalAmount: string;
  status: ExpenseReportStatus;
  authorizedAt: string | null;
  authorizationNote: string | null;
  processedAt: string | null;
  paymentDate: string | null;
  paymentNote: string | null;
  submittedAt: string | null;
  createdAt: string;
  lines?: ExpenseLineItem[];
}

export interface PaginatedExpenseReports {
  items: ExpenseReportItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ExpenseLinePayload {
  lineDate: string;
  vendor: string;
  conceptId?: string;
  expenseTypeId?: string;
  subtotal?: number;
  tip?: number;
  extras?: number;
  notes?: string;
  sortOrder?: number;
}

export interface ExpenseReportPayload {
  authorizerEmployeeId?: string;
  department?: string;
  motive: string;
  periodStart: string;
  periodEnd: string;
  lines?: ExpenseLinePayload[];
}

export interface ExpenseReportFilters {
  status?: string;
  requester?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

function expenseQuery(filters: ExpenseReportFilters): string {
  const qs = new URLSearchParams();
  if (filters.status) qs.set('status', filters.status);
  if (filters.requester) qs.set('requester', filters.requester);
  if (filters.dateFrom) qs.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) qs.set('dateTo', filters.dateTo);
  if (filters.page) qs.set('page', String(filters.page));
  if (filters.limit) qs.set('limit', String(filters.limit));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function getExpenseCatalogs(): Promise<ExpenseCatalogs> {
  return apiFetchWithRetry<ExpenseCatalogs>('/expenses/catalogs');
}

export function getMyExpenseReports(
  filters: ExpenseReportFilters = {},
): Promise<PaginatedExpenseReports> {
  return apiFetchWithRetry<PaginatedExpenseReports>(`/expenses${expenseQuery(filters)}`);
}

export function getAllExpenseReports(
  filters: ExpenseReportFilters = {},
): Promise<PaginatedExpenseReports> {
  return apiFetchWithRetry<PaginatedExpenseReports>(`/expenses/all${expenseQuery(filters)}`);
}

export function getExpenseReport(id: string): Promise<ExpenseReportItem> {
  return apiFetchWithRetry<ExpenseReportItem>(`/expenses/${id}`);
}

export function createExpenseReport(payload: ExpenseReportPayload): Promise<ExpenseReportItem> {
  return apiFetch<ExpenseReportItem>('/expenses', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateExpenseReport(
  id: string,
  payload: ExpenseReportPayload,
): Promise<ExpenseReportItem> {
  return apiFetch<ExpenseReportItem>(`/expenses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteExpenseReport(id: string): Promise<{ deleted: true }> {
  return apiFetch<{ deleted: true }>(`/expenses/${id}`, { method: 'DELETE' });
}

export function submitExpenseReport(id: string): Promise<ExpenseReportItem> {
  return apiFetch<ExpenseReportItem>(`/expenses/${id}/submit`, { method: 'PATCH' });
}

export function authorizeExpenseReport(
  id: string,
  payload: { action: 'authorized' | 'rejected'; note?: string },
): Promise<ExpenseReportItem> {
  return apiFetch<ExpenseReportItem>(`/expenses/${id}/authorize`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function processExpenseReport(
  id: string,
  payload: { paymentDate: string; note?: string },
): Promise<ExpenseReportItem> {
  return apiFetch<ExpenseReportItem>(`/expenses/${id}/process`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
