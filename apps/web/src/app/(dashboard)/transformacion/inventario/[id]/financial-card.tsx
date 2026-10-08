'use client';

import Link from 'next/link';
import type { EquipmentDetail } from '@/lib/api';

interface FinancialCardProps {
  equipment: EquipmentDetail;
}

type DepreciationBadge = 'verde' | 'amarillo' | 'naranja' | 'rojo';

const BADGE_STYLE: Record<DepreciationBadge, string> = {
  verde: 'bg-emerald-100 text-emerald-700',
  amarillo: 'bg-amber-100 text-amber-700',
  naranja: 'bg-orange-100 text-orange-700',
  rojo: 'bg-red-100 text-red-700',
};

const money = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMoney(value: number | null): string | null {
  return value === null ? null : money.format(value);
}

/** 'YYYY-MM-DD' partido a mano: new Date() lo leería en UTC y correría el día. */
function parseLocal(value: string): Date | null {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDate(value: string | null): string | null {
  const date = value ? parseLocal(value) : null;
  if (!date) return null;
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Color del vencimiento de la depreciación según lo que falta:
 * > 12 meses verde · 6–12 amarillo · hasta 6 naranja · ya vencida rojo.
 * Los umbrales se comparan contra hoy + N meses de calendario, no días/30.
 */
function depreciationBadge(endDate: string): { tone: DepreciationBadge; label: string } | null {
  const end = parseLocal(endDate);
  if (!end) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const plusMonths = (n: number) => new Date(today.getFullYear(), today.getMonth() + n, today.getDate());

  if (end < today) return { tone: 'rojo', label: 'Vencida' };
  if (end <= plusMonths(6)) return { tone: 'naranja', label: 'Menos de 6 meses' };
  if (end <= plusMonths(12)) return { tone: 'amarillo', label: '6 a 12 meses' };
  return { tone: 'verde', label: 'Más de 12 meses' };
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-navy">{value || '—'}</dd>
    </div>
  );
}

export function FinancialCard({ equipment }: FinancialCardProps) {
  const info = equipment.financialInfo;
  const badge = info.depreciationEndDate ? depreciationBadge(info.depreciationEndDate) : null;
  const pct = Math.min(100, Math.max(0, info.depreciationPercentage));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-navy">Información Financiera</h3>

      <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-5">
        <Field
          label="Proveedor"
          value={
            info.providerId && info.providerName ? (
              <Link
                href={`/finanzas/proveedores/${info.providerId}`}
                className="text-navy underline hover:opacity-80"
              >
                {info.providerName}
              </Link>
            ) : null
          }
        />
        <Field label="No. de factura" value={info.invoiceNumber} />
        <Field label="Fecha de factura" value={formatDate(info.invoiceDate)} />
        <Field label="Valor de compra" value={formatMoney(info.purchaseValue)} />
        <Field
          label="Vencimiento depreciación"
          value={
            info.depreciationEndDate ? (
              <span className="flex flex-wrap items-center gap-2">
                {formatDate(info.depreciationEndDate)}
                {badge && (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE_STYLE[badge.tone]}`}
                  >
                    {badge.label}
                  </span>
                )}
              </span>
            ) : null
          }
        />
        <Field
          label="Depreciación mensual"
          value={info.monthlyDepreciation !== null ? `${formatMoney(info.monthlyDepreciation)} / mes` : null}
        />
      </dl>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Valor actual</p>
        {info.invoiceDate ? (
          <>
            <div
              className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Avance de depreciación"
            >
              <div
                className={`h-full rounded-full ${info.isFullyDepreciated ? 'bg-slate-400' : 'bg-navy'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-navy">
              {info.isFullyDepreciated ? 'Totalmente depreciado' : `${Math.round(pct)}% depreciado`}
              {info.currentValue !== null && (
                <>
                  {' · '}Valor actual: <span className="font-semibold">{formatMoney(info.currentValue)}</span>
                </>
              )}
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-slate-400">
            Captura la fecha de factura para calcular la depreciación.
          </p>
        )}
      </div>
    </div>
  );
}
