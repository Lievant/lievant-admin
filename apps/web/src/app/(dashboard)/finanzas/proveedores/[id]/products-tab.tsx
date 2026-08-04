'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { VendorDetail } from '@/lib/api';
import { CheckIcon, CloseIcon, PlusIcon } from '@/components/icons';
import { PRODUCT_TYPE_BADGE_STYLES, PRODUCT_TYPE_LABELS, formatCurrency } from '../constants';
import { AddProductDialog } from './add-product-dialog';

export function ProductsTab({ vendor }: { vendor: VendorDetail }) {
  const [isAddOpen, setAddOpen] = useState(false);
  const products = vendor.products;

  return (
    <div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          <PlusIcon className="h-4 w-4" />
          Agregar producto/servicio
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Precio unitario</th>
              <th className="px-4 py-3">Moneda</th>
              <th className="px-4 py-3">Activo</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                  No hay productos o servicios registrados.
                </td>
              </tr>
            )}
            {products.map((product) => (
              <tr key={product.id} className="border-b border-slate-100 last:border-none">
                <td className="px-4 py-3">
                  <p className="font-medium text-navy">{product.name}</p>
                  {product.description && <p className="text-xs text-slate-400">{product.description}</p>}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'rounded-full px-2 py-1 text-xs font-semibold',
                      PRODUCT_TYPE_BADGE_STYLES[product.type],
                    )}
                  >
                    {PRODUCT_TYPE_LABELS[product.type]}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {product.unitPrice != null ? formatCurrency(product.unitPrice, product.currency) : '—'}
                </td>
                <td className="px-4 py-3 text-slate-600">{product.currency}</td>
                <td className="px-4 py-3">
                  {product.isActive ? (
                    <CheckIcon className="h-4 w-4 text-green-600" />
                  ) : (
                    <CloseIcon className="h-4 w-4 text-slate-300" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAddOpen && <AddProductDialog vendorId={vendor.id} onClose={() => setAddOpen(false)} />}
    </div>
  );
}
