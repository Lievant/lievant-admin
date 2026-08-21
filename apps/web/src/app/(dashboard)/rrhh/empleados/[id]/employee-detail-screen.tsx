'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import type {
  EmployeeCompensation,
  EmployeeDetail,
  EmployeeDocument,
  EmployeeEmergencyContact,
  EmployeePersonalData,
  EmployeeTermination,
  EmployeeVacationSummary,
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
import { EquipmentLicensesTab } from './equipment-licenses-tab';
import { PhotosTab } from './photos-tab';
import { EditEmployeeDialog } from './edit-employee-dialog';
import { GenerateDocumentsDialog } from './generate-documents-dialog';

const ALL_TABS = [
  { id: 'general',      label: 'General',          badge: null },
  { id: 'personal',     label: 'Datos personales',  badge: 'RRHH' },
  { id: 'compensation', label: 'Compensación',       badge: 'Nómina' },
  { id: 'vacation',     label: 'Vacaciones',         badge: null },
  { id: 'family',       label: 'Familia y baja',     badge: 'RRHH' },
  { id: 'documents',    label: 'Documentos',         badge: null },
  { id: 'photos',       label: 'Fotos',              badge: null },
  { id: 'equipos-licencias', label: 'Equipos y Licencias', badge: null },
] as const;

type TabId = (typeof ALL_TABS)[number]['id'];

/**
 * Alias en español para ?tab=. Los ids internos son en inglés, pero los enlaces
 * que se comparten usan el nombre visible del tab.
 */
const TAB_ALIASES: Record<string, TabId> = {
  vacaciones: 'vacation',
  compensacion: 'compensation',
  'datos-personales': 'personal',
  familia: 'family',
  documentos: 'documents',
  fotos: 'photos',
};

function resolveTabParam(value: string | null): TabId | null {
  if (!value) return null;
  const slug = value.toLowerCase();
  if (ALL_TABS.some((t) => t.id === slug)) return slug as TabId;
  return TAB_ALIASES[slug] ?? null;
}

interface EmployeeDetailScreenProps {
  employee: EmployeeDetail;
  personal: EmployeePersonalData | null;
  compensation: EmployeeCompensation | null;
  vacationSummary: EmployeeVacationSummary | null;
  contacts: EmployeeEmergencyContact[];
  termination: EmployeeTermination | null;
  catalogs: EmployeeFormCatalogs;
  documents: EmployeeDocument[];
}

function EmployeeHeaderPhoto({ name, corporateEmail }: { name: string; corporateEmail: string | null }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  if (!corporateEmail || photoFailed) {
    return (
      <div
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white"
        style={{ backgroundColor: avatarColor(name) }}
      >
        {initials(name)}
      </div>
    );
  }
  return (
    <img
      src={`/api/users/${encodeURIComponent(corporateEmail)}/photo`}
      alt={name}
      className="h-16 w-16 shrink-0 rounded-full object-cover"
      onError={() => setPhotoFailed(true)}
    />
  );
}

export function EmployeeDetailScreen({
  employee,
  personal,
  compensation,
  vacationSummary,
  contacts,
  termination,
  catalogs,
  documents,
}: EmployeeDetailScreenProps) {
  const canViewPersonal      = usePermission('rrhh', 'empleados.personal');
  const canViewCompensation  = usePermission('rrhh', 'empleados.nomina');
  const canGenerateDocuments = usePermission('rrhh', 'empleados.documentos', 'write');
  const canViewDocuments     = usePermission('rrhh', 'empleados.documentos');
  const canWriteEmployees    = usePermission('rrhh', 'empleados', 'write');
  const canViewEquipos       = usePermission('rrhh', 'empleados.equipos', 'read');
  const canViewLicencias     = usePermission('rrhh', 'empleados.licencias', 'read');
  const canViewVacations     = usePermission('rrhh', 'empleados.vacaciones', 'read');

  const visibleTabs = ALL_TABS.filter((tab) => {
    if (tab.id === 'personal' || tab.id === 'family') return canViewPersonal;
    if (tab.id === 'vacation') return canViewVacations;
    if (tab.id === 'compensation') return canViewCompensation;
    if (tab.id === 'documents') return canViewDocuments;
    if (tab.id === 'equipos-licencias') return canViewEquipos || canViewLicencias;
    return true; // general, photos
  });

  // ?tab= define el tab inicial para poder enlazar directo desde otras
  // pantallas (p. ej. "Ver expediente" del Maestro de Vacaciones). Va como
  // estado inicial, no como efecto, para que el primer render ya sea el
  // correcto y no haya parpadeo desde General.
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>(
    () => resolveTabParam(searchParams.get('tab')) ?? 'general',
  );
  const [isEditOpen, setEditOpen] = useState(false);
  const [isDocumentsOpen, setDocumentsOpen] = useState(false);

  // Si el tab pedido no está visible por permisos, cae al primero disponible.
  const effectiveTab = visibleTabs.some((t) => t.id === activeTab) ? activeTab : visibleTabs[0]?.id ?? 'general';

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/rrhh" className="hover:text-black">
          RRHH
        </Link>
        <span>/</span>
        <Link href="/rrhh/empleados" className="hover:text-black">
          Empleados
        </Link>
        <span>/</span>
        <span className="text-slate-600">{employee.fullName}</span>
      </nav>

      {/* Header */}
      <header className="mt-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <EmployeeHeaderPhoto name={employee.fullName} corporateEmail={employee.corporateEmail} />
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
                  ? 'border-black text-black'
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
          <VacationTab summary={vacationSummary} canView={canViewVacations} />
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
        {effectiveTab === 'photos' && (
          <PhotosTab
            employeeId={employee.id}
            employeeName={employee.fullName}
            canWrite={canWriteEmployees}
          />
        )}
        {effectiveTab === 'equipos-licencias' && (
          <EquipmentLicensesTab
            employeeId={employee.id}
            canViewEquipos={canViewEquipos}
            canViewLicencias={canViewLicencias}
          />
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
