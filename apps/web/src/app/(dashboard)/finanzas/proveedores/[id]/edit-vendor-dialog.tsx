'use client';

import { useState, useTransition } from 'react';
import type { CatalogItem, UpdateVendorPayload, VendorDetail, VendorStatus } from '@/lib/api';
import { CloseIcon } from '@/components/icons';
import { VENDOR_STATUSES, VENDOR_STATUS_LABELS } from '../constants';
import { TextField } from '../form-field';
import { updateVendorAction } from './actions';

interface EditVendorDialogProps {
  vendor: VendorDetail;
  categories: CatalogItem[];
  onClose: () => void;
}

export function EditVendorDialog({ vendor, categories, onClose }: EditVendorDialogProps) {
  const [name, setName] = useState(vendor.name);
  const [tradeName, setTradeName] = useState(vendor.tradeName ?? '');
  const [rfc, setRfc] = useState(vendor.rfc);
  const [categoryId, setCategoryId] = useState(vendor.categoryId ?? '');
  const [status, setStatus] = useState<VendorStatus>(vendor.status);
  const [paymentTermsDays, setPaymentTermsDays] = useState(
    vendor.paymentTermsDays != null ? String(vendor.paymentTermsDays) : '',
  );
  const [clabe, setClabe] = useState(vendor.clabe ?? '');
  const [bankName, setBankName] = useState(vendor.bankName ?? '');
  const [bankAccount, setBankAccount] = useState(vendor.bankAccount ?? '');
  const [notes, setNotes] = useState(vendor.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('La razón social es obligatoria.');
      return;
    }
    if (!rfc.trim()) {
      setError('El RFC es obligatorio.');
      return;
    }

    startTransition(async () => {
      const payload: UpdateVendorPayload = {
        name: name.trim(),
        rfc: rfc.trim().toUpperCase(),
        status,
      };
      if (tradeName.trim()) payload.trade_name = tradeName.trim();
      if (categoryId) payload.category_id = categoryId;
      if (paymentTermsDays !== '') payload.payment_terms_days = Number(paymentTermsDays);
      if (clabe.trim()) payload.clabe = clabe.trim();
      if (bankName.trim()) payload.bank_name = bankName.trim();
      if (bankAccount.trim()) payload.bank_account = bankAccount.trim();
      if (notes.trim()) payload.notes = notes.trim();

      const result = await updateVendorAction(vendor.id, payload);
      if (result.success) {
        onClose();
      } else {
        setError(result.error ?? 'No se pudo actualizar el proveedor.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-navy">Editar proveedor</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
          <TextField id="edit-vendor-name" label="Razón social" value={name} onChange={setName} />
          <TextField id="edit-vendor-trade-name" label="Nombre comercial" value={tradeName} onChange={setTradeName} />

          <div className="grid grid-cols-2 gap-4">
            <TextField id="edit-vendor-rfc" label="RFC" value={rfc} onChange={(v) => setRfc(v.slice(0, 13))} mono />

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="edit-vendor-category">
                Categoría
              </label>
              <select
                id="edit-vendor-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
              >
                <option value="">Sin categoría</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="edit-vendor-status">
                Status
              </label>
              <select
                id="edit-vendor-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as VendorStatus)}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
              >
                {VENDOR_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {VENDOR_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <TextField
              id="edit-vendor-terms"
              label="Días de crédito"
              type="number"
              value={paymentTermsDays}
              onChange={setPaymentTermsDays}
            />
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm font-semibold text-navy">Datos bancarios</p>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <TextField id="edit-vendor-clabe" label="CLABE" value={clabe} onChange={setClabe} mono />
              <TextField id="edit-vendor-bank" label="Banco" value={bankName} onChange={setBankName} />
            </div>
            <div className="mt-4">
              <TextField id="edit-vendor-account" label="Cuenta bancaria" value={bankAccount} onChange={setBankAccount} mono />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="edit-vendor-notes">
              Notas
            </label>
            <textarea
              id="edit-vendor-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
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
              className="rounded-md bg-terracota px-4 py-2 text-sm font-semibold text-white hover:bg-terracota-dark disabled:opacity-60"
            >
              {isPending ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
