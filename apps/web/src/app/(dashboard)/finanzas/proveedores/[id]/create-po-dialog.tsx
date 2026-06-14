'use client';

import { useState, useTransition } from 'react';
import type { CreatePOLineItemPayload, CreatePurchaseOrderPayload, VendorProduct } from '@/lib/api';
import { CloseIcon, PlusIcon } from '@/components/icons';
import { formatCurrency } from '../constants';
import { createPurchaseOrderAction } from './actions';

interface DraftLine {
  key: string;
  productId: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

function emptyLine(): DraftLine {
  return { key: crypto.randomUUID(), productId: '', description: '', quantity: '1', unitPrice: '' };
}

function lineTotal(line: DraftLine): number {
  const qty = Number(line.quantity);
  const price = Number(line.unitPrice);
  if (Number.isNaN(qty) || Number.isNaN(price)) return 0;
  return qty * price;
}

export function CreatePoDialog({
  vendorId,
  products,
  onClose,
}: {
  vendorId: string;
  products: VendorProduct[];
  onClose: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const grandTotal = lines.reduce((sum, line) => sum + lineTotal(line), 0);

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function handleProductChange(key: string, productId: string) {
    const product = products.find((p) => p.id === productId);
    setLines((prev) =>
      prev.map((line) =>
        line.key === key
          ? {
              ...line,
              productId,
              description: product ? product.name : line.description,
              unitPrice: product?.unitPrice != null ? String(product.unitPrice) : line.unitPrice,
            }
          : line,
      ),
    );
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length > 1 ? prev.filter((line) => line.key !== key) : prev));
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (lines.some((line) => !line.description.trim() || line.quantity === '' || line.unitPrice === '')) {
      setError('Completa descripción, cantidad y precio unitario en todas las líneas.');
      return;
    }

    startTransition(async () => {
      const lineItems: CreatePOLineItemPayload[] = lines.map((line) => ({
        ...(line.productId ? { product_id: line.productId } : {}),
        description: line.description.trim(),
        quantity: Number(line.quantity),
        unit_price: Number(line.unitPrice),
      }));

      const payload: CreatePurchaseOrderPayload = {
        vendor_id: vendorId,
        line_items: lineItems,
      };
      if (notes.trim()) payload.notes = notes.trim();

      const result = await createPurchaseOrderAction(vendorId, payload);
      if (result.success) {
        onClose();
      } else {
        setError(result.error ?? 'No se pudo crear la orden de compra.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-navy">Nueva orden de compra</h2>
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
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="po-notes">
              Notas
            </label>
            <textarea
              id="po-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-navy">Líneas de la OC</p>
              <button
                type="button"
                onClick={addLine}
                className="flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Agregar línea
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {lines.map((line) => (
                <div key={line.key} className="rounded-lg border border-slate-200 p-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Producto</label>
                      <select
                        value={line.productId}
                        onChange={(e) => handleProductChange(line.key, e.target.value)}
                        className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
                      >
                        <option value="">Sin producto</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Descripción</label>
                      <input
                        type="text"
                        value={line.description}
                        onChange={(e) => updateLine(line.key, { description: e.target.value })}
                        className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
                      />
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cantidad</label>
                      <input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                        className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Precio unitario
                      </label>
                      <input
                        type="number"
                        value={line.unitPrice}
                        onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })}
                        className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</label>
                      <div className="flex h-[38px] items-center rounded-md border border-slate-100 bg-slate-50 px-3 text-sm text-slate-600">
                        {formatCurrency(lineTotal(line))}
                      </div>
                    </div>
                  </div>

                  {lines.length > 1 && (
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Eliminar línea
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <p className="mt-3 text-right text-sm font-semibold text-navy">Total: {formatCurrency(grandTotal)}</p>
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
              {isPending ? 'Creando…' : 'Crear OC'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
