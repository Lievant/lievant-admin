'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { CatalogItem, CreateVendorPayload } from '@/lib/api';
import { TextField } from '../form-field';
import { createVendorAction } from './actions';

interface NewVendorFormProps {
  categories: CatalogItem[];
}

export function NewVendorForm({ categories }: NewVendorFormProps) {
  const router = useRouter();

  const [name, setName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [rfc, setRfc] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState('30');
  const [notes, setNotes] = useState('');
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
      const payload: CreateVendorPayload = {
        name: name.trim(),
        rfc: rfc.trim().toUpperCase(),
      };
      if (tradeName.trim()) payload.trade_name = tradeName.trim();
      if (categoryId) payload.category_id = categoryId;
      if (paymentTermsDays !== '') payload.payment_terms_days = Number(paymentTermsDays);
      if (notes.trim()) payload.notes = notes.trim();

      const result = await createVendorAction(payload);
      if (result.success && result.id) {
        router.push(`/finanzas/proveedores/${result.id}`);
      } else {
        setError(result.error ?? 'No se pudo crear el proveedor.');
      }
    });
  };

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/finanzas" className="hover:text-terracota">
          Finanzas
        </Link>
        <span>/</span>
        <Link href="/finanzas/proveedores" className="hover:text-terracota">
          Proveedores
        </Link>
        <span>/</span>
        <span className="text-slate-600">Nuevo proveedor</span>
      </nav>

      <h1 className="mt-4 text-2xl font-bold text-navy">Nuevo proveedor</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <TextField
          id="vendor-name"
          label="Razón social"
          value={name}
          onChange={setName}
          placeholder="Proveedor S.A. de C.V."
        />
        <TextField
          id="vendor-trade-name"
          label="Nombre comercial"
          value={tradeName}
          onChange={setTradeName}
          placeholder="Nombre comercial"
        />

        <div className="grid grid-cols-2 gap-4">
          <TextField
            id="vendor-rfc"
            label="RFC"
            value={rfc}
            onChange={(v) => setRfc(v.slice(0, 13))}
            mono
            placeholder="XAXX010101000"
          />

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="vendor-category">
              Categoría
            </label>
            <select
              id="vendor-category"
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

        <TextField
          id="vendor-payment-terms"
          label="Días de crédito"
          type="number"
          value={paymentTermsDays}
          onChange={setPaymentTermsDays}
          placeholder="30"
        />

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="vendor-notes">
            Notas
          </label>
          <textarea
            id="vendor-notes"
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
          <Link
            href="/finanzas/proveedores"
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-terracota px-4 py-2 text-sm font-semibold text-white hover:bg-terracota-dark disabled:opacity-60"
          >
            {isPending ? 'Guardando…' : 'Guardar proveedor'}
          </button>
        </div>
      </form>
    </div>
  );
}
