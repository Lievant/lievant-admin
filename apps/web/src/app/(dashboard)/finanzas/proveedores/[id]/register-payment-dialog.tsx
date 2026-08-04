'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Invoice, VendorDetail } from '@/lib/api';
import { CloseIcon } from '@/components/icons';
import { PAYMENT_METHODS, formatCurrency, vendorDisplayName } from '../constants';
import { TextField } from '../form-field';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RegisterPaymentDialog({
  vendor,
  invoice,
  onClose,
}: {
  vendor: VendorDetail;
  invoice: Invoice;
  onClose: () => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(invoice.total);
  const [paymentDate, setPaymentDate] = useState(today());
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]?.value ?? 'transferencia');
  const [reference, setReference] = useState('');
  const [voucher, setVoucher] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!amount || Number.isNaN(Number(amount))) {
      setError('El monto del pago es obligatorio.');
      return;
    }
    if (!paymentDate) {
      setError('La fecha de pago es obligatoria.');
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append('amount', amount);
      formData.append('payment_date', paymentDate);
      if (paymentMethod) formData.append('payment_method', paymentMethod);
      if (reference.trim()) formData.append('reference', reference.trim());
      if (notes.trim()) formData.append('notes', notes.trim());
      if (voucher) formData.append('voucher', voucher);

      try {
        const res = await fetch(`/api/invoices/${invoice.id}/payment`, {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
          const message = body?.message
            ? Array.isArray(body.message)
              ? body.message.join(', ')
              : body.message
            : 'No se pudo registrar el pago.';
          setError(message);
          return;
        }

        router.refresh();
        onClose();
      } catch {
        setError('No se pudo registrar el pago.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-navy">Registrar pago</h2>
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
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
            <p className="text-navy">
              Factura <span className="font-mono">{invoice.invoiceNumber}</span>
            </p>
            <p className="mt-1 text-slate-500">Monto total: {formatCurrency(invoice.total)}</p>
            <p className="mt-1 text-slate-500">Proveedor: {vendorDisplayName(vendor)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextField id="payment-amount" label="Monto del pago" type="number" value={amount} onChange={setAmount} />
            <TextField id="payment-date" label="Fecha de pago" type="date" value={paymentDate} onChange={setPaymentDate} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="payment-method">
                Método de pago
              </label>
              <select
                id="payment-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </div>
            <TextField id="payment-reference" label="Referencia" value={reference} onChange={setReference} mono />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="payment-voucher">
              Comprobante PDF
            </label>
            <input
              id="payment-voucher"
              type="file"
              accept="application/pdf"
              onChange={(e) => setVoucher(e.target.files?.[0] ?? null)}
              className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-600 hover:file:bg-slate-200"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="payment-notes">
              Notas
            </label>
            <textarea
              id="payment-notes"
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
              {isPending ? 'Guardando…' : 'Confirmar pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
