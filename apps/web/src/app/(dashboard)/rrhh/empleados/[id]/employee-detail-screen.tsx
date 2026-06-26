'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type {
  EmployeeCompensation,
  EmployeeDetail,
  EmployeeDocument,
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
import type { EmployeeFormCatalogs } from '../catalog-data';
import { usePermission } from '@/hooks/use-permission';
import { GeneralTab } from './general-tab';
import { PersonalTab } from './personal-tab';
import { CompensationTab } from './compensation-tab';
import { VacationTab } from './vacation-tab';
import { FamilyTab } from './family-tab';
import { DocumentsTab } from './documents-tab';
import { EditEmployeeDialog } from './edit-employee-dialog';
import { GenerateDocumentsDialog } from './generate-documents-dialog';

const ALL_TABS = [
  { id: 'general',      label: 'General',          badge: null },
  { id: 'personal',     label: 'Datos personales',  badge: 'RRHH' },
  { id: 'compensation', label: 'Compensación',       badge: 'Nómina' },
  { id: 'vacation',     label: 'Vacaciones',         badge: null },
  { id: 'family',       label: 'Familia y baja',     badge: 'RRHH' },
  { id: 'documents',    label: 'Documentos',         badge: null },
] as const;

type TabId = (typeof ALL_TABS)[number]['id'];

interface EmployeeDetailScreenProps {
  employee: EmployeeDetail;
  personal: EmployeePersonalData | null;
  compensation: EmployeeCompensation | null;
  vacations: EmployeeVacation[];
  contacts: EmployeeEmergencyContact[];
  termination: EmployeeTermination | null;
  catalogs: EmployeeFormCatalogs;
  documents: EmployeeDocument[];
}

export function EmployeeDetailScreen({
  employee,
  personal,
  compensation,
  vacations,
  contacts,
  termination,
  catalogs,
  documents,
}: EmployeeDetailScreenProps) {
  const canViewPersonal      = usePermission('rrhh', 'empleados.personal');
  const canViewCompensation  = usePermission('rrhh', 'empleados.nomina');
  const canGenerateDocuments = usePermission('rrhh', 'empleados.documentos', 'write');
  const canViewDocuments     = usePermission('rrhh', 'empleados.documentos');

  const visibleTabs = ALL_TABS.filter((tab) => {
    if (tab.id === 'personal' || tab.id === 'vacation' || tab.id === 'family') return canViewPersonal;
    if (tab.id === 'compensation') return canViewCompensation;
    if (tab.id === 'documents') return canViewDocuments;
    return true; // general
  });

  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [isEditOpen, setEditOpen] = useState(false);
  const [isDocumentsOpen, setDocumentsOpen] = useState(false);

  const effectiveTab = visibleTabs.some((t) => t.id === activeTab) ? activeTab : visibleTabs[0]?.id ?? 'general';

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

        <div className="flex items-center gap-2">
          {canGenerateDocuments && (
            <button
              type="button"
              onClick={() => setDocumentsOpen(true)}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
            >
              Generar documentos
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
          >
            Editar
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="mt-6 border-b border-slate-200">
        <nav className="flex gap-6">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors',
                effectiveTab === tab.id
                  ? 'border-terracota text-terracota'
                  : 'border-transparent text-slate-500 hover:text-navy',
              )}
            >
              {tab.label}
              {tab.badge === 'RRHH' && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-600">
                  RRHH
                </span>
              )}
              {tab.badge === 'Nómina' && (
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
        {effectiveTab === 'general' && <GeneralTab employee={employee} />}
        {effectiveTab === 'personal' && (
          <PersonalTab employee={employee} personal={personal} canView={canViewPersonal} />
        )}
        {effectiveTab === 'compensation' && (
          <CompensationTab employee={employee} compensation={compensation} canView={canViewCompensation} />
        )}
        {effectiveTab === 'vacation' && (
          <VacationTab employee={employee} vacations={vacations} canView={canViewPersonal} />
        )}
        {effectiveTab === 'family' && (
          <FamilyTab
            employee={employee}
            contacts={contacts}
            termination={termination}
            canView={canViewPersonal}
          />
        )}
        {effectiveTab === 'documents' && (
          <DocumentsTab employee={employee} documents={documents} />
        )}
      </div>

      {isEditOpen && <EditEmployeeDialog employee={employee} catalogs={catalogs} onClose={() => setEditOpen(false)} />}
      <GenerateDocumentsDialog
        isOpen={isDocumentsOpen}
        onClose={() => setDocumentsOpen(false)}
        employeeId={employee.id}
        employeeName={employee.fullName}
        contractType={employee.contractType}
      />
    </div>
  );
}
