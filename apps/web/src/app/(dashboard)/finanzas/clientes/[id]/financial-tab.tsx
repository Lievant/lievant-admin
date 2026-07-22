'use client';

import { useState } from 'react';
import type { ClientDetail, FinancialData } from '@/lib/api';
import {
  PAYMENT_METHODS,
  SAT_CFDI_USES,
  SAT_PAYMENT_FORMS,
  SAT_PAYMENT_METHODS,
  SAT_TAX_REGIMES,
} from '../constants';
import { EditFinancialDialog } from './edit-financial-dialog';

function formatCurrency(value: string, currency: string | null): string {
  const amount = Number(value);
  if (Number.isNaN(amount)) return value;
  return amount.toLocaleString('es-MX', { style: 'currency', currency: currency ?? 'MXN' });
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
}

function catalogLabel(catalog: { value: string; label: string }[], value: string | null): string {
  if (!value) return '—';
  return catalog.find((entry) => entry.value === value)?.label ?? value;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-slate-100 last:border-none">
      <td className="px-4 py-3 font-medium text-slate-500">{label}</td>
      <td className="px-4 py-3 text-navy">{value}</td>
    </tr>
  );
}

function SectionTable({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      <table className="w-full text-left text-sm">
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function FinancialTab({
  client,
  financial,
  canView,
}: {
  client: ClientDetail;
  financial: FinancialData | null;
  canView: boolean;
}) {
  const [isEditOpen, setEditOpen] = useState(false);

  if (!canView) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <p className="text-sm font-semibold text-navy">Acceso restringido</p>
        <p className="mt-1 text-sm text-slate-500">
          Esta información solo está disponible para Administración Financiera.
        </p>
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

      <SectionTable title="General">
        <Row label="Empresa" value={client.primaryCompany.name} />
        <Row label="Moneda" value={financial?.currency ?? 'MXN'} />
        <Row label="Días de pago" value={financial?.paymentDays != null ? `${financial.paymentDays} días` : '—'} />
        <Row label="Email de facturación" value={financial?.billingEmail ?? '—'} />
        <Row label="Contacto de facturación" value={financial?.billingContact ?? '—'} />
        <Row
          label="Límite de crédito"
          value={financial?.creditLimit != null ? formatCurrency(financial.creditLimit, financial.currency) : '—'}
        />
        <Row label="Método de pago" value={catalogLabel(PAYMENT_METHODS, financial?.paymentMethod ?? null)} />
      </SectionTable>

      <SectionTable title="Datos fiscales (SAT)">
        <Row label="Régimen fiscal" value={catalogLabel(SAT_TAX_REGIMES, financial?.satTaxRegime ?? null)} />
        <Row label="Uso de CFDI" value={catalogLabel(SAT_CFDI_USES, financial?.satCfdiUse ?? null)} />
        <Row label="Método de pago SAT" value={catalogLabel(SAT_PAYMENT_METHODS, financial?.satPaymentMethod ?? null)} />
        <Row label="Forma de pago SAT" value={catalogLabel(SAT_PAYMENT_FORMS, financial?.satPaymentForm ?? null)} />
      </SectionTable>

      <SectionTable title="Datos bancarios">
        <Row label="Banco" value={financial?.bankName ?? '—'} />
        <Row label="Cuenta" value={financial?.bankAccount ?? '—'} />
        <Row label="CLABE" value={financial?.bankClabe ?? '—'} />
      </SectionTable>

      <SectionTable title="Contrato">
        <Row label="Inicio de contrato" value={financial?.contractStartDate ? formatDate(financial.contractStartDate) : '—'} />
        <Row label="Fin de contrato" value={financial?.contractEndDate ? formatDate(financial.contractEndDate) : '—'} />
        <Row label="Renovación automática" value={financial?.autoRenewal ? 'Sí' : 'No'} />
        <Row label="Notas internas" value={financial?.internalNotes ?? '—'} />
      </SectionTable>

      {isEditOpen && (
        <EditFinancialDialog clientId={client.id} financial={financial} onClose={() => setEditOpen(false)} />
      )}
    </div>
  );
}
