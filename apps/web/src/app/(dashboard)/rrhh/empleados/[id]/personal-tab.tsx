'use client';

import { useState } from 'react';
import type { EmployeeDetail, EmployeePersonalData } from '@/lib/api';
import { cn } from '@/lib/utils';
import { calculateAge, formatDate } from '../constants';
import { EditPersonalDialog } from './edit-personal-dialog';

const RFC_LENGTH = 13;
const CURP_LENGTH = 18;

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={mono ? 'mt-1 font-mono text-sm text-navy' : 'mt-1 text-sm text-navy'}>{value}</p>
    </div>
  );
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className ?? ''}`}>
      <h2 className="text-sm font-semibold text-navy">{title}</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function ValidatedField({ label, value, expectedLength }: { label: string; value: string | null; expectedLength: number }) {
  const length = value?.length ?? 0;
  const isValid = length === expectedLength;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <p className="font-mono text-sm text-navy">{value ?? '—'}</p>
        {value && (
          <span
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
              isValid ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', isValid ? 'bg-green-500' : 'bg-red-500')} />
            {length}/{expectedLength}
          </span>
        )}
      </div>
    </div>
  );
}

export function PersonalTab({
  employee,
  personal,
  canView,
}: {
  employee: EmployeeDetail;
  personal: EmployeePersonalData | null;
  canView: boolean;
}) {
  const [isEditOpen, setEditOpen] = useState(false);

  if (!canView) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-10 text-center shadow-sm">
        <p className="text-sm font-semibold text-amber-700">Acceso restringido</p>
        <p className="mt-1 text-sm text-amber-600">
          Esta información solo está disponible para Recursos Humanos.
        </p>
      </div>
    );
  }

  const age = calculateAge(personal?.birthDate ?? null);
  const addressParts = [
    personal?.street,
    personal?.extNumber ? `#${personal.extNumber}` : null,
    personal?.intNumber ? `Int. ${personal.intNumber}` : null,
  ].filter(Boolean);

  return (
    <div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
        >
          Editar
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
        <Section title="Identificación">
          <ValidatedField label="RFC" value={personal?.rfc ?? null} expectedLength={RFC_LENGTH} />
          <ValidatedField label="CURP" value={personal?.curp ?? null} expectedLength={CURP_LENGTH} />
          <Field label="Número IMSS" value={personal?.imssNumber ?? '—'} mono />
          <Field label="Tipo de sangre" value={personal?.bloodType ?? '—'} />
        </Section>

        <Section title="Datos personales">
          <Field label="Fecha de nacimiento" value={personal?.birthDate ? formatDate(personal.birthDate) : '—'} />
          <Field label="Edad" value={age != null ? `${age} años` : '—'} />
          <Field label="Estado civil" value={personal?.maritalStatus ?? '—'} />
          <Field label="Hijos" value={personal?.children != null ? String(personal.children) : '—'} />
        </Section>

        <Section title="Contacto">
          <Field label="Teléfono" value={personal?.phone ?? '—'} />
          <Field label="Medio de transporte" value={personal?.mainTransport ?? '—'} />
          <Field label="Tiempo de traslado" value={personal?.commuteTime ?? '—'} />
        </Section>

        <Section title="Domicilio" className="md:col-span-2">
          <div className="sm:col-span-2">
            <Field label="Calle y número" value={addressParts.length ? addressParts.join(' ') : '—'} />
          </div>
          <Field label="Colonia" value={personal?.neighborhood ?? '—'} />
          <Field label="Código postal" value={personal?.postalCode ?? '—'} mono />
          <Field label="Ciudad" value={personal?.city ?? '—'} />
          <Field label="Estado" value={personal?.state ?? '—'} />
        </Section>
      </div>

      {isEditOpen && <EditPersonalDialog employee={employee} personal={personal} onClose={() => setEditOpen(false)} />}
    </div>
  );
}
