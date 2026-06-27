import { EmployeeStatus } from '../constants/employee-status.constant';
import { Modality } from '../constants/modality.constant';

export type DocStatus = 'complete' | 'incomplete' | 'no_required';

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
  createdAt: Date;
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
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
}

export interface EmployeesPaginatedResult<T> extends PaginatedResult<T> {
  stats: EmployeeStats;
}
