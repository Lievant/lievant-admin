'use client';

import { Fragment, useState, useTransition } from 'react';
import { cn } from '@/lib/utils';
import type { POStatus, PurchaseOrder, VendorDetail } from '@/lib/api';
import { ChevronDownIcon, PlusIcon } from '@/components/icons';
import {
  INVOICE_STATUS_BADGE_STYLES,
  INVOICE_STATUS_LABELS,
  PO_STATUSES,
  PO_STATUS_BADGE_STYLES,
  PO_STATUS_LABELS,
  formatCurrency,
} from '../constants';
import { getPurchaseOrderDetailAction, updatePOStatusAction } from './actions';
import { CreatePoDialog } from './create-po-dialog';

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
}

const NEXT_STATUS: Record<POStatus, POStatus | null> = {
  borrador: 'aprobada',
  aprobada: 'cerrada',
  cerrada: null,
};

export function PurchaseOrdersTab({ vendor }: { vendor: VendorDetail }) {
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<POStatus | ''>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, PurchaseOrder | null>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const purchaseOrders = vendor.purchaseOrders;
  const totalCount = purchaseOrders.length;
  const openCount = purchaseOrders.filter((po) => po.status === 'borrador' || po.status === 'aprobada').length;
  const closedCount = purchaseOrders.filter((po) => po.status === 'cerrada').length;

  const filtered = statusFilter ? purchaseOrders.filter((po) => po.status === statusFilter) : purchaseOrders;

  function toggleExpand(po: PurchaseOrder) {
    if (expandedId === po.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(po.id);
    if (!(po.id in details)) {
      setLoadingId(po.id);
      void getPurchaseOrderDetailAction(po.id).then((detail) => {
        setDetails((prev) => ({ ...prev, [po.id]: detail }));
        setLoadingId(null);
      });
    }
  }

  function handleChangeStatus(po: PurchaseOrder) {
    const next = NEXT_STATUS[po.status];
    if (!next) return;
    setError(null);
    startTransition(async () => {
      const result = await updatePOStatusAction(vendor.id, po.id, next);
      if (!result.success) {
        setError(result.error ?? 'No se pudo actualizar el status de la OC.');
      } else {
        setDetails((prev) => {
          const current = prev[po.id];
          if (!current) return prev;
          return { ...prev, [po.id]: { ...current, status: next } };
        });
      }
    });
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total OCs</p>
          <p className="mt-2 text-2xl font-bold text-navy">{totalCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">OCs abiertas</p>
          <p className="mt-2 text-2xl font-bold text-navy">{openCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">OCs cerradas</p>
          <p className="mt-2 text-2xl font-bold text-navy">{closedCount}</p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as POStatus | '')}
          className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
        >
          <option value="">Todas</option>
          {PO_STATUSES.map((status) => (
            <option key={status} value={status}>
              {PO_STATUS_LABELS[status]}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          <PlusIcon className="h-4 w-4" />
          Nueva OC
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Número OC</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                  No hay órdenes de compra registradas.
                </td>
              </tr>
            )}
            {filtered.map((po) => {
              const isExpanded = expandedId === po.id;
              const detail = details[po.id];
              const linkedInvoices = vendor.invoices.filter((inv) => inv.poId === po.id);
              const nextStatus = NEXT_STATUS[po.status];

              return (
                <Fragment key={po.id}>
                  <tr
                    onClick={() => toggleExpand(po)}
                    className="cursor-pointer border-b border-slate-100 last:border-none hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-mono text-navy">{po.poNumber}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(po.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn('rounded-full px-2 py-1 text-xs font-semibold', PO_STATUS_BADGE_STYLES[po.status])}
                      >
                        {PO_STATUS_LABELS[po.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatCurrency(po.total)}</td>
                    <td className="px-4 py-3">
                      <ChevronDownIcon
                        className={cn('h-4 w-4 text-slate-400 transition-transform', isExpanded && 'rotate-180')}
                      />
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-b border-slate-100 last:border-none bg-slate-50/60">
                      <td colSpan={5} className="px-4 py-4">
                        {loadingId === po.id || !detail ? (
                          <p className="text-sm text-slate-400">Cargando detalle…</p>
                        ) : (
                          <div className="space-y-4">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Líneas de la OC
                              </p>
                              <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
                                <table className="w-full text-left text-sm">
                                  <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      <th className="px-3 py-2">Descripción</th>
                                      <th className="px-3 py-2">Cantidad</th>
                                      <th className="px-3 py-2">Precio unitario</th>
                                      <th className="px-3 py-2">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(detail.lineItems ?? []).map((line) => (
                                      <tr key={line.id} className="border-b border-slate-100 last:border-none">
                                        <td className="px-3 py-2 text-navy">{line.description}</td>
                                        <td className="px-3 py-2 text-slate-600">{line.quantity}</td>
                                        <td className="px-3 py-2 text-slate-600">{formatCurrency(line.unitPrice)}</td>
                                        <td className="px-3 py-2 text-slate-600">{formatCurrency(line.total)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <p className="mt-2 text-right text-sm font-semibold text-navy">
                                Total OC: {formatCurrency(detail.total)}
                              </p>
                            </div>

                            {linkedInvoices.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                  Facturas vinculadas
                                </p>
                                <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
                                  <table className="w-full text-left text-sm">
                                    <thead>
                                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        <th className="px-3 py-2">Número</th>
                                        <th className="px-3 py-2">Monto</th>
                                        <th className="px-3 py-2">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {linkedInvoices.map((inv) => (
                                        <tr key={inv.id} className="border-b border-slate-100 last:border-none">
                                          <td className="px-3 py-2 font-mono text-navy">{inv.invoiceNumber}</td>
                                          <td className="px-3 py-2 text-slate-600">{formatCurrency(inv.total)}</td>
                                          <td className="px-3 py-2">
                                            <span
                                              className={cn(
                                                'rounded-full px-2 py-1 text-xs font-semibold',
                                                INVOICE_STATUS_BADGE_STYLES[inv.status],
                                              )}
                                            >
                                              {INVOICE_STATUS_LABELS[inv.status]}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {nextStatus && (
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  disabled={isPending}
                                  onClick={() => handleChangeStatus(detail)}
                                  className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300 disabled:opacity-60"
                                >
                                  Cambiar estado
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {isCreateOpen && (
        <CreatePoDialog vendorId={vendor.id} products={vendor.products} onClose={() => setCreateOpen(false)} />
      )}
    </div>
  );
}
