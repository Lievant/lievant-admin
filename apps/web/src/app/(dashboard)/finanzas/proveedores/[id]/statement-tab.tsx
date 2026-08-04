'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { Invoice, InvoiceStatus, VendorDetail, VendorStatement } from '@/lib/api';
import { EyeIcon, PlusIcon } from '@/components/icons';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import { INVOICE_STATUS_BADGE_STYLES, INVOICE_STATUS_LABELS, INVOICE_STATUSES, formatCurrency } from '../constants';
import { AddInvoiceDialog } from './add-invoice-dialog';
import { RegisterPaymentDialog } from './register-payment-dialog';

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
}

function firstDayOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function lastDayOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
}

function UploadInvoicePdfButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch(`/api/invoices/${invoiceId}/pdf`, {
          method: 'PATCH',
          body: formData,
        });

        if (!res.ok) {
          setError('No se pudo subir la factura.');
          return;
        }

        router.refresh();
      } catch {
        setError('No se pudo subir la factura.');
      } finally {
        e.target.value = '';
      }
    });
  }

  return (
    <div className="flex flex-col">
      <label
        className={cn(
          'cursor-pointer rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-slate-300',
          isPending && 'opacity-60',
        )}
      >
        {isPending ? 'Subiendo…' : 'Subir factura PDF'}
        <input type="file" accept="application/pdf" className="hidden" disabled={isPending} onChange={handleFileChange} />
      </label>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function StatementTab({ vendor, statement }: { vendor: VendorDetail; statement: VendorStatement }) {
  const [isAddOpen, setAddOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | ''>('');
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth());
  const [dateTo, setDateTo] = useState(lastDayOfMonth());

  const poNumberById = useMemo(() => {
    const map = new Map<string, string>();
    for (const po of vendor.purchaseOrders) map.set(po.id, po.poNumber);
    return map;
  }, [vendor.purchaseOrders]);

  const filtered = statement.invoices.filter((inv) => {
    if (statusFilter && inv.status !== statusFilter) return false;
    const issueDate = inv.issueDate.slice(0, 10);
    if (dateFrom && issueDate < dateFrom) return false;
    if (dateTo && issueDate > dateTo) return false;
    return true;
  });

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Total pendiente</p>
          <p className="mt-2 text-2xl font-bold text-amber-700">{formatCurrency(statement.total_pending)}</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-600">Total pagado</p>
          <p className="mt-2 text-2xl font-bold text-green-700">{formatCurrency(statement.total_paid)}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | '')}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          >
            <option value="">Todas</option>
            {INVOICE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {INVOICE_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          />
          <span className="text-sm text-slate-400">a</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          />
        </div>

        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          <PlusIcon className="h-4 w-4" />
          Agregar factura
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <ScrollableTable>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Núm. factura</th>
              <th className="px-4 py-3">OC vinculada</th>
              <th className="px-4 py-3">Fecha emisión</th>
              <th className="px-4 py-3">Fecha vencimiento</th>
              <th className="px-4 py-3">Monto total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                  No hay facturas registradas en este periodo.
                </td>
              </tr>
            )}
            {filtered.map((inv) => (
              <tr key={inv.id} className="border-b border-slate-100 last:border-none">
                <td className="px-4 py-3 font-mono text-navy">{inv.invoiceNumber}</td>
                <td className="px-4 py-3 text-slate-600">{inv.poId ? poNumberById.get(inv.poId) ?? '—' : '—'}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(inv.issueDate)}</td>
                <td className="px-4 py-3 text-slate-600">{inv.dueDate ? formatDate(inv.dueDate) : '—'}</td>
                <td className="px-4 py-3 text-slate-600">{formatCurrency(inv.total)}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn('rounded-full px-2 py-1 text-xs font-semibold', INVOICE_STATUS_BADGE_STYLES[inv.status])}
                  >
                    {INVOICE_STATUS_LABELS[inv.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {inv.pdfUrl && (
                      <a
                        href={inv.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Ver factura"
                        className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:border-slate-300"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </a>
                    )}
                    {inv.status === 'pendiente' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setPaymentInvoice(inv)}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-slate-300"
                        >
                          Registrar pago
                        </button>
                        <UploadInvoicePdfButton invoiceId={inv.id} />
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </ScrollableTable>
      </div>

      {isAddOpen && (
        <AddInvoiceDialog
          vendorId={vendor.id}
          purchaseOrders={vendor.purchaseOrders}
          onClose={() => setAddOpen(false)}
        />
      )}

      {paymentInvoice && (
        <RegisterPaymentDialog
          vendor={vendor}
          invoice={paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
        />
      )}
    </div>
  );
}
