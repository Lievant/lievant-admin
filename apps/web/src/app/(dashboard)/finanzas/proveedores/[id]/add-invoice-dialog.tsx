'use client';

import { useState, useTransition } from 'react';
import type { CreateInvoicePayload, PurchaseOrder } from '@/lib/api';
import { CloseIcon } from '@/components/icons';
import { formatCurrency } from '../constants';
import { TextField } from '../form-field';
import { createInvoiceAction } from './actions';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AddInvoiceDialog({
  vendorId,
  purchaseOrders,
  onClose,
}: {
  vendorId: string;
  purchaseOrders: PurchaseOrder[];
  onClose: () => void;
}) {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [poId, setPoId] = useState('');
  const [amount, setAmount] = useState('');
  const [tax, setTax] = useState('0');
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const approvedPOs = purchaseOrders.filter((po) => po.status === 'aprobada');

  const amountValue = Number(amount) || 0;
  const taxValue = Number(tax) || 0;
  const total = amountValue + taxValue;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!invoiceNumber.trim()) {
      setError('El número de factura es obligatorio.');
      return;
    }
    if (!issueDate) {
      setError('La fecha de emisión es obligatoria.');
      return;
    }

    startTransition(async () => {
      const payload: CreateInvoicePayload = {
        vendor_id: vendorId,
        invoice_number: invoiceNumber.trim(),
        amount: amountValue,
        tax: taxValue,
        total,
        issue_date: issueDate,
      };
      if (poId) payload.po_id = poId;
      if (dueDate) payload.due_date = dueDate;
      if (notes.trim()) payload.notes = notes.trim();

      const result = await createInvoiceAction(vendorId, payload);
      if (result.success) {
        onClose();
      } else {
        setError(result.error ?? 'No se pudo registrar la factura.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-navy">Registrar factura</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[75vh] space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-4">
            <TextField id="invoice-number" label="Número de factura" value={invoiceNumber} onChange={setInvoiceNumber} mono />

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="invoice-po">
                OC vinculada
              </label>
              <select
                id="invoice-po"
                value={poId}
                onChange={(e) => setPoId(e.target.value)}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
              >
                <option value="">Sin OC</option>
                {approvedPOs.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.poNumber}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <TextField id="invoice-amount" label="Monto (sin IVA)" type="number" value={amount} onChange={setAmount} />
            <TextField id="invoice-tax" label="IVA" type="number" value={tax} onChange={setTax} />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</label>
              <div className="flex h-[38px] items-center rounded-md border border-slate-100 bg-slate-50 px-3 text-sm text-slate-600">
                {formatCurrency(total)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextField id="invoice-issue-date" label="Fecha de emisión" type="date" value={issueDate} onChange={setIssueDate} />
            <TextField id="invoice-due-date" label="Fecha de vencimiento" type="date" value={dueDate} onChange={setDueDate} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="invoice-notes">
              Notas
            </label>
            <textarea
              id="invoice-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {isPending ? 'Guardando…' : 'Registrar factura'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
