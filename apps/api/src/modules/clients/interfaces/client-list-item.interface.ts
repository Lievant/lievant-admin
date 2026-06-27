import { ClientStatus } from '../constants/client-status.constant';

export type DocStatus = 'complete' | 'incomplete' | 'no_required';

export interface ClientListItem {
  id: string;
  displayId: string;
  status: ClientStatus;
  group: { id: string; name: string } | null;
  primaryCompany: { id: string; name: string; industry: string | null };
  accountManager: { id: string; name: string } | null;
  companiesCount: number;
  brandsCount: number;
  docStatus: DocStatus;
  country: string | null;
  city: string | null;
  createdAt: Date;
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
}
