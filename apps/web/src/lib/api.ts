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

export async function apiFetchUpload<T>(path: string, formData: FormData): Promise<T> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: formData,
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

export interface UploadDocumentPayload {
  file: File;
  documentType: string;
  version?: number;
}

export function addClientDocument(clientId: string, payload: UploadDocumentPayload): Promise<ClientDocumentSummary> {
  const formData = new FormData();
  formData.append('file', payload.file);
  formData.append('documentType', payload.documentType);
  if (payload.version != null) formData.append('version', String(payload.version));

  return apiFetchUpload<ClientDocumentSummary>(`/clients/${clientId}/documents`, formData);
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
