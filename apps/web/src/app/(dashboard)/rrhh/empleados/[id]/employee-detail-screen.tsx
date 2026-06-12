'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type {
  EmployeeCompensation,
  EmployeeDetail,
  EmployeeEmergencyContact,
  EmployeePersonalData,
  EmployeeTermination,
  EmployeeVacation,
} from '@/lib/api';
import { avatarColor, initials } from '@/lib/avatar';
import {
  EMPLOYEE_STATUS_BADGE_STYLES,
  EMPLOYEE_STATUS_LABELS,
  companyBadgeStyle,
} from '../constants';
import { GeneralTab } from './general-tab';
import { PersonalTab } from './personal-tab';
import { CompensationTab } from './compensation-tab';
import { VacationTab } from './vacation-tab';
import { FamilyTab } from './family-tab';
import { EditEmployeeDialog } from './edit-employee-dialog';

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'personal', label: 'Datos personales' },
  { id: 'compensation', label: 'Compensación' },
  { id: 'vacation', label: 'Vacaciones' },
  { id: 'family', label: 'Familia y baja' },
] as const;

type TabId = (typeof TABS)[number]['id'];

interface EmployeeDetailScreenProps {
  employee: EmployeeDetail;
  personal: EmployeePersonalData | null;
  compensation: EmployeeCompensation | null;
  vacations: EmployeeVacation[];
  contacts: EmployeeEmergencyContact[];
  termination: EmployeeTermination | null;
  canViewPersonal: boolean;
  canViewCompensation: boolean;
}

export function EmployeeDetailScreen({
  employee,
  personal,
  compensation,
  vacations,
  contacts,
  termination,
  canViewPersonal,
  canViewCompensation,
}: EmployeeDetailScreenProps) {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [isEditOpen, setEditOpen] = useState(false);

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/rrhh" className="hover:text-terracota">
          RRHH
        </Link>
        <span>/</span>
        <Link href="/rrhh/empleados" className="hover:text-terracota">
          Empleados
        </Link>
        <span>/</span>
        <span className="text-slate-600">{employee.fullName}</span>
      </nav>

      {/* Header */}
      <header className="mt-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white"
            style={{ backgroundColor: avatarColor(employee.fullName) }}
          >
            {initials(employee.fullName)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-navy">{employee.fullName}</h1>
              <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">
                {employee.displayId}
              </span>
              <span
                className={cn(
                  'rounded-full px-2 py-1 text-xs font-semibold',
                  EMPLOYEE_STATUS_BADGE_STYLES[employee.status],
                )}
              >
                {EMPLOYEE_STATUS_LABELS[employee.status]}
              </span>
              <span
                className={cn('rounded-full px-2 py-1 text-xs font-semibold', companyBadgeStyle(employee.companyName))}
              >
                {employee.companyName}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{employee.position}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
        >
          Editar
        </button>
      </header>

      {/* Tabs */}
      <div className="mt-6 border-b border-slate-200">
        <nav className="flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-terracota text-terracota'
                  : 'border-transparent text-slate-500 hover:text-navy',
              )}
            >
              {tab.label}
              {(tab.id === 'personal' || tab.id === 'family') && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-600">
                  RRHH
                </span>
              )}
              {tab.id === 'compensation' && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                  Nómina
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === 'general' && <GeneralTab employee={employee} />}
        {activeTab === 'personal' && (
          <PersonalTab employee={employee} personal={personal} canView={canViewPersonal} />
        )}
        {activeTab === 'compensation' && (
          <CompensationTab employee={employee} compensation={compensation} canView={canViewCompensation} />
        )}
        {activeTab === 'vacation' && (
          <VacationTab employee={employee} vacations={vacations} canView={canViewPersonal} />
        )}
        {activeTab === 'family' && (
          <FamilyTab
            employee={employee}
            contacts={contacts}
            termination={termination}
            canView={canViewPersonal}
          />
        )}
      </div>

      {isEditOpen && <EditEmployeeDialog employee={employee} onClose={() => setEditOpen(false)} />}
    </div>
  );
}
