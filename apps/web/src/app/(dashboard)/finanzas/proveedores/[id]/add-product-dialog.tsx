'use client';

import { useState, useTransition } from 'react';
import type { CreateProductPayload, ProductType } from '@/lib/api';
import { CloseIcon } from '@/components/icons';
import { PRODUCT_TYPES, PRODUCT_TYPE_LABELS } from '../constants';
import { TextField } from '../form-field';
import { addProductAction } from './actions';

export function AddProductDialog({ vendorId, onClose }: { vendorId: string; onClose: () => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ProductType>('producto');
  const [description, setDescription] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [currency, setCurrency] = useState('MXN');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }

    startTransition(async () => {
      const payload: CreateProductPayload = {
        name: name.trim(),
        type,
        currency,
      };
      if (description.trim()) payload.description = description.trim();
      if (unitPrice !== '') payload.unit_price = Number(unitPrice);

      const result = await addProductAction(vendorId, payload);
      if (result.success) {
        onClose();
      } else {
        setError(result.error ?? 'No se pudo agregar el producto o servicio.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-navy">Agregar producto/servicio</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <TextField id="product-name" label="Nombre" value={name} onChange={setName} />

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="product-type">
              Tipo
            </label>
            <select
              id="product-type"
              value={type}
              onChange={(e) => setType(e.target.value as ProductType)}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
            >
              {PRODUCT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PRODUCT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="product-description">
              Descripción
            </label>
            <textarea
              id="product-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextField id="product-unit-price" label="Precio unitario" type="number" value={unitPrice} onChange={setUnitPrice} />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="product-currency">
                Moneda
              </label>
              <select
                id="product-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
              >
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
            </div>
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
              {isPending ? 'Guardando…' : 'Agregar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
