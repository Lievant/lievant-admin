import type { CatalogItem, VendorDetail } from '@/lib/api';
import { VENDOR_STATUS_LABELS } from '../constants';

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

interface GeneralTabProps {
  vendor: VendorDetail;
  category: CatalogItem | undefined;
  canViewBankDetails: boolean;
}

export function GeneralTab({ vendor, category, canViewBankDetails }: GeneralTabProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Section title="Datos generales" className="md:col-span-2">
        <Field label="Razón social" value={vendor.name} />
        <Field label="Nombre comercial" value={vendor.tradeName ?? '—'} />
        <Field label="RFC" value={vendor.rfc} mono />
        <Field label="Categoría" value={category?.name ?? '—'} />
        <Field label="Status" value={VENDOR_STATUS_LABELS[vendor.status]} />
        <Field
          label="Días de crédito"
          value={vendor.paymentTermsDays != null ? `${vendor.paymentTermsDays} días` : '—'}
        />
        <div className="sm:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notas</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-navy">{vendor.notes || 'Sin notas.'}</p>
        </div>
      </Section>

      <Section title="Datos bancarios">
        {canViewBankDetails ? (
          <>
            <Field label="CLABE" value={vendor.clabe ?? '—'} mono />
            <Field label="Banco" value={vendor.bankName ?? '—'} />
            <Field label="Cuenta bancaria" value={vendor.bankAccount ?? '—'} mono />
          </>
        ) : (
          <div className="sm:col-span-2">
            <p className="text-sm text-slate-400">Sin acceso</p>
          </div>
        )}
      </Section>

      <Section title="Contacto">
        <div className="sm:col-span-2">
          <p className="text-sm text-slate-400">Próximamente</p>
        </div>
      </Section>
    </div>
  );
}
