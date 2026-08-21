'use client';

import { useState } from 'react';
import type { EmployeeCompensation, EmployeeDetail } from '@/lib/api';
import { formatDateLocal } from '@/lib/utils';
import { formatCurrency } from '../constants';
import { EditCompensationDialog } from './edit-compensation-dialog';

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={mono ? 'mt-1 font-mono text-sm text-navy' : 'mt-1 text-sm text-navy'}>{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-navy">{title}</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

export function CompensationTab({
  employee,
  compensation,
  canView,
}: {
  employee: EmployeeDetail;
  compensation: EmployeeCompensation | null;
  canView: boolean;
}) {
  const [isEditOpen, setEditOpen] = useState(false);

  if (!canView) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-10 text-center shadow-sm">
        <p className="text-sm font-semibold text-red-700">Acceso restringido</p>
        <p className="mt-1 text-sm text-red-600">RRHH no tiene acceso a este tab.</p>
      </div>
    );
  }

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
        <Section title="Sueldo">
          <Field label="Sueldo mensual bruto" value={formatCurrency(compensation?.monthlyGrossSalary ?? null)} />
          <Field label="Sueldo diario bruto" value={formatCurrency(compensation?.dailyGrossSalary ?? null)} />
          <Field label="Pago por servicios" value={formatCurrency(compensation?.servicePayment ?? null)} />
          <Field
            label="Último cambio de sueldo"
            value={formatDateLocal(compensation?.lastSalaryChange)}
          />
        </Section>

        <Section title="Prestaciones">
          <Field label="Apoyo home office" value={formatCurrency(compensation?.remoteWorkAllowance ?? null)} />
          <Field label="Vales de despensa" value={formatCurrency(compensation?.groceryVouchers ?? null)} />
          <Field label="Vales de gasolina" value={formatCurrency(compensation?.gasVouchers ?? null)} />
          <Field label="Apoyo telefónico" value={formatCurrency(compensation?.phoneAllowance ?? null)} />
          <Field label="Bono de puntualidad" value={formatCurrency(compensation?.punctualityBonus ?? null)} />
          <div className="sm:col-span-2">
            <Field label="Seguro de gastos médicos" value={compensation?.healthInsurance ?? '—'} />
          </div>
          <div className="sm:col-span-2">
            <Field label="Otros beneficios" value={compensation?.otherBenefits ?? '—'} />
          </div>
        </Section>

        <Section title="Totales">
          <Field label="Total bruto" value={formatCurrency(compensation?.totalGross ?? null)} />
          <Field label="Estimado neto" value={formatCurrency(compensation?.netEstimate ?? null)} />
        </Section>
      </div>

      {isEditOpen && (
        <EditCompensationDialog employee={employee} compensation={compensation} onClose={() => setEditOpen(false)} />
      )}
    </div>
  );
}
