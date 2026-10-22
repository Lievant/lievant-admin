'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn, formatDateLocal } from '@/lib/utils';
import { statusBadgeStyle, typeIcon } from '@/app/(dashboard)/transformacion/inventario/constants';
import { EmployeeSimCards } from '@/app/(dashboard)/transformacion/sim-cards/employee-sim-cards';
import {
  EMPLOYEE_STATUS_LABELS,
  MODALITY_LABELS,
  calculateAge,
  calculateSeniority,
  companyBadgeStyle,
} from '@/app/(dashboard)/rrhh/empleados/constants';

type Laboral = {
  displayId: string; codNom: string | null; status: 'active' | 'inactive'; position: string; level: string | null;
  project: string | null; companyName: string; companyCode: string; division: string | null; area: string | null;
  directReportTo: string | null; location: string | null; modality: 'presencial' | 'hibrido' | 'remoto' | null;
  contractSchema: string | null; corporateEmail: string | null; emailSignature: string | null;
  seniorityDate: string | null; contractType: string | null; contractEndDate: string | null;
  schedule: string | null; lunchTime: string | null; gender: string | null; nationality: string | null;
  studies: string | null;
};
type Personal = {
  rfc: string | null; curp: string | null; imssNumber: string | null; bloodType: string | null;
  birthDate: string | null; maritalStatus: string | null; children: number | null; phone: string | null;
  mainTransport: string | null; commuteTime: string | null; street: string | null; extNumber: string | null;
  intNumber: string | null; neighborhood: string | null; postalCode: string | null; city: string | null;
  state: string | null;
};
interface MyProfile { fullName: string; laboral: Laboral; personal: Personal | null }
interface MyDocument { id: string; type: string; name: string; uploadedAt: string }
interface MyEquipment { id: string; displayId: string; equipmentType: string; brand: string | null; model: string | null; status: string }
interface MyTool { id: string; assignmentCode: string; status: string; toolName: string }

const HR_EMAIL = 'rrhh@lievant.com';
const NOT_LINKED_TEXT = 'Tu usuario no está vinculado a un expediente de empleado. Escríbele a RRHH:';

/** Pestañas de Mi Información. Agregar una nueva es agregar una entrada aquí y su contenido abajo. */
const TABS = [
  { id: 'personal', label: 'Información Personal' },
  { id: 'laboral', label: 'Información Laboral' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'equipos', label: 'Equipos y Licencias' },
  { id: 'lineas', label: 'Línea Telefónica' },
] as const;
type TabId = (typeof TABS)[number]['id'];

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn('mt-1 break-words text-sm text-navy', mono && 'font-mono')}>{value}</p>
    </div>
  );
}

function Section({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white p-5 shadow-sm', wide && 'md:col-span-2')}>
      <h2 className="text-sm font-semibold text-navy">{title}</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function HrLink() {
  return (
    <a href={`mailto:${HR_EMAIL}`} className="font-semibold underline">
      {HR_EMAIL}
    </a>
  );
}

function PersonalPanel({ personal }: { personal: Personal | null }) {
  const age = calculateAge(personal?.birthDate ?? null);
  const address = [
    personal?.street,
    personal?.extNumber ? `#${personal.extNumber}` : null,
    personal?.intNumber ? `Int. ${personal.intNumber}` : null,
  ].filter(Boolean);
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Section title="Identificación">
        <Field label="RFC" value={personal?.rfc ?? '—'} mono />
        <Field label="CURP" value={personal?.curp ?? '—'} mono />
        <Field label="Número IMSS" value={personal?.imssNumber ?? '—'} mono />
        <Field label="Tipo de Sangre" value={personal?.bloodType ?? '—'} />
      </Section>
      <Section title="Datos Personales">
        <Field label="Fecha de Nacimiento" value={formatDateLocal(personal?.birthDate)} />
        <Field label="Edad" value={age != null ? `${age} años` : '—'} />
        <Field label="Estado Civil" value={personal?.maritalStatus ?? '—'} />
        <Field label="Hijos" value={personal?.children != null ? String(personal.children) : '—'} />
      </Section>
      <Section title="Contacto">
        <Field label="Teléfono" value={personal?.phone ?? '—'} />
        <Field label="Medio de Transporte" value={personal?.mainTransport ?? '—'} />
        <Field label="Tiempo de Traslado" value={personal?.commuteTime ?? '—'} />
      </Section>
      <Section title="Domicilio" wide>
        <div className="sm:col-span-2">
          <Field label="Calle y Número" value={address.length ? address.join(' ') : '—'} />
        </div>
        <Field label="Colonia" value={personal?.neighborhood ?? '—'} />
        <Field label="Código Postal" value={personal?.postalCode ?? '—'} mono />
        <Field label="Ciudad" value={personal?.city ?? '—'} />
        <Field label="Estado" value={personal?.state ?? '—'} />
      </Section>
    </div>
  );
}

function LaboralPanel({ l }: { l: Laboral }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Section title="Información General">
        <Field label="ID" value={l.displayId} mono />
        <Field label="Código de Nómina" value={l.codNom ?? '—'} mono />
        <Field label="Estado" value={EMPLOYEE_STATUS_LABELS[l.status]} />
        <Field label="Puesto" value={l.position} />
        <Field label="Nivel" value={l.level ?? '—'} />
        <Field label="Proyecto" value={l.project ?? '—'} />
      </Section>
      <Section title="Organización">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Empresa</p>
          <span className={cn('mt-1 inline-flex rounded-full px-2 py-1 text-xs font-semibold', companyBadgeStyle(l.companyName))}>
            {l.companyName}
          </span>
        </div>
        <Field label="Código de Empresa" value={l.companyCode} mono />
        <Field label="División" value={l.division ?? '—'} />
        <Field label="Área" value={l.area ?? '—'} />
        <Field label="Reporta A" value={l.directReportTo ?? '—'} />
        <Field label="Ubicación" value={l.location ?? '—'} />
        <Field label="Modalidad" value={l.modality ? MODALITY_LABELS[l.modality] : '—'} />
        <Field label="Esquema de Contrato" value={l.contractSchema ?? '—'} />
      </Section>
      <Section title="Contacto">
        <Field label="Email Corporativo" value={l.corporateEmail ?? '—'} mono />
        <Field label="Firma de Email" value={l.emailSignature ?? '—'} />
      </Section>
      <Section title="Datos Laborales">
        <Field label="Fecha de Antigüedad" value={formatDateLocal(l.seniorityDate)} />
        <Field label="Antigüedad" value={calculateSeniority(l.seniorityDate)} />
        <Field label="Tipo de Contrato" value={l.contractType ?? '—'} />
        <Field label="Fin de Contrato" value={formatDateLocal(l.contractEndDate)} />
        <Field label="Horario" value={l.schedule ?? '—'} />
        <Field label="Horario de Comida" value={l.lunchTime ?? '—'} />
        <Field label="Género" value={l.gender ?? '—'} />
        <Field label="Nacionalidad" value={l.nationality ?? '—'} />
        <div className="sm:col-span-2">
          <Field label="Estudios" value={l.studies ?? '—'} />
        </div>
      </Section>
    </div>
  );
}

function DocumentsPanel({ docs }: { docs: MyDocument[] | null }) {
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // La URL de descarga se pide al momento y solo para documentos propios.
  const download = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/employees/my-profile/documents/${id}/download-url`);
      if (!res.ok) throw new Error();
      const { url } = (await res.json()) as { url: string };
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setError('No se pudo abrir el documento. Intenta de nuevo.');
    } finally {
      setBusyId(null);
    }
  };

  if (docs === null) return <p className="text-sm text-slate-400">Cargando…</p>;
  if (docs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-500">
        Aún no hay documentos en tu expediente.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {docs.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-navy">{d.name}</p>
              <p className="text-xs text-slate-500">
                {d.type} · {formatDateLocal(d.uploadedAt.slice(0, 10))}
              </p>
            </div>
            <button
              type="button"
              onClick={() => download(d.id)}
              disabled={busyId === d.id}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 disabled:opacity-50"
            >
              {busyId === d.id ? 'Abriendo…' : 'Ver Documento'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EquipmentPanel({ data }: { data: { equipment: MyEquipment[]; tools: MyTool[] } | null }) {
  if (data === null) return <p className="text-sm text-slate-400">Cargando…</p>;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-700">Equipos Tecnológicos</h3>
        {data.equipment.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">Sin equipos asignados.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {data.equipment.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <i className={`ti ${typeIcon(e.equipmentType)} text-slate-400`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy">{e.displayId}</p>
                    <p className="truncate text-xs text-slate-500">
                      {[e.brand, e.model].filter(Boolean).join(' ') || e.equipmentType}
                    </p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeStyle(e.status)}`}>
                  {e.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-700">Herramientas y Licencias</h3>
        {data.tools.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">Sin herramientas asignadas.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.tools.map((t) => {
              const active = t.status === 'activo';
              return (
                <div key={t.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2">
                  <span
                    title={active ? 'Activa' : 'Revocada'}
                    className={cn(
                      'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                      active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400',
                    )}
                  >
                    {active ? '✓' : '✕'}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-700">{t.toolName}</p>
                    <p className="font-mono text-[11px] text-slate-400">{t.assignmentCode}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function MiInformacionScreen() {
  const [tab, setTab] = useState<TabId>('personal');
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'not-linked' | 'error'>('loading');
  const [docs, setDocs] = useState<MyDocument[] | null>(null);
  const [equipment, setEquipment] = useState<{ equipment: MyEquipment[]; tools: MyTool[] } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/employees/my-profile');
      if (res.status === 404) {
        const body = (await res.json().catch(() => ({}))) as { code?: string };
        setState(body.code === 'EMPLOYEE_NOT_LINKED' ? 'not-linked' : 'error');
        return;
      }
      if (!res.ok) throw new Error();
      setProfile((await res.json()) as MyProfile);
      setState('ok');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Las pestañas con datos propios cargan al abrirse por primera vez.
  useEffect(() => {
    if (state !== 'ok') return;
    if (tab === 'documentos' && docs === null) {
      fetch('/api/employees/my-profile/documents')
        .then((r) => (r.ok ? (r.json() as Promise<MyDocument[]>) : []))
        .then(setDocs)
        .catch(() => setDocs([]));
    }
    if (tab === 'equipos' && equipment === null) {
      fetch('/api/employees/my-profile/equipment')
        .then((r) =>
          r.ok ? (r.json() as Promise<{ equipment: MyEquipment[]; tools: MyTool[] }>) : { equipment: [], tools: [] },
        )
        .then(setEquipment)
        .catch(() => setEquipment({ equipment: [], tools: [] }));
    }
  }, [tab, state, docs, equipment]);

  if (state === 'loading') return <p className="text-sm text-slate-400">Cargando…</p>;

  if (state === 'not-linked') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-navy">Mi Información</h1>
        <div className="rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-500">
          {NOT_LINKED_TEXT} <HrLink />
        </div>
      </div>
    );
  }

  if (state === 'error' || !profile) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-navy">Mi Información</h1>
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-6 text-sm text-red-700">
          No se pudo cargar tu información.{' '}
          <button
            type="button"
            onClick={() => {
              setState('loading');
              void load();
            }}
            className="font-semibold underline"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy">Mi Información</h1>
        <p className="mt-1 text-sm text-slate-500">
          {profile.fullName} · {profile.laboral.position}
        </p>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        ¿Algún dato incorrecto o desactualizado? Escríbele a RRHH: <HrLink />
      </div>

      <div role="tablist" className="-mx-1 flex gap-1 overflow-x-auto border-b border-slate-200 px-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium',
              tab === t.id ? 'border-black text-black' : 'border-transparent text-slate-500 hover:text-slate-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'personal' && <PersonalPanel personal={profile.personal} />}
        {tab === 'laboral' && <LaboralPanel l={profile.laboral} />}
        {tab === 'documentos' && <DocumentsPanel docs={docs} />}
        {tab === 'equipos' && <EquipmentPanel data={equipment} />}
        {tab === 'lineas' && (
          <EmployeeSimCards source="mine" title="Mis Líneas Telefónicas" showHistory={false} showCost={false} />
        )}
      </div>
    </div>
  );
}
