'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import type { EquipmentDetail, WarrantyStatus } from '@/lib/api';

interface WarrantyCardProps {
  equipment: EquipmentDetail;
  canWrite: boolean;
  onUpdated: (equipment: EquipmentDetail) => void;
}

const STATUS_LABEL: Record<WarrantyStatus, string> = {
  vigente: 'Vigente',
  por_vencer: 'Por vencer',
  vencida: 'Vencida',
  sin_garantia: 'Sin garantía',
};

const STATUS_STYLE: Record<WarrantyStatus, string> = {
  vigente: 'bg-emerald-100 text-emerald-700',
  por_vencer: 'bg-amber-100 text-amber-700',
  vencida: 'bg-red-100 text-red-700',
  sin_garantia: 'bg-slate-100 text-slate-600',
};

/** Días que faltan para el vencimiento; negativo si ya pasó. */
function daysUntil(value: string | null): number | null {
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86_400_000);
}

/** 'YYYY-MM-DD' partido a mano: new Date() lo leería en UTC y correría el día. */
function formatDate(value: string | null): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '—';
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-navy">{value || '—'}</dd>
    </div>
  );
}

export function WarrantyCard({ equipment, canWrite, onUpdated }: WarrantyCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = equipment.warrantyStatus ?? 'sin_garantia';
  const days = daysUntil(equipment.warrantyExpiryDate);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`/api/inventory/equipment/${equipment.id}/warranty-invoice`, {
        method: 'POST',
        body,
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(detail?.message ?? 'No se pudo subir la factura.');
      }
      // El endpoint devuelve el equipo ya enriquecido, con la URL firmada nueva.
      // Se levanta al padre en vez de router.refresh(): la pantalla guarda el
      // equipo en useState y un refresh del server component no reinicializa
      // ese estado, así que la factura no aparecía hasta recargar a mano.
      onUpdated((await res.json()) as EquipmentDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la factura.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-navy">Garantía</h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}
        >
          {STATUS_LABEL[status]}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
        <Field
          label="Proveedor"
          value={
            equipment.warrantyProviderId && equipment.warrantyProviderName ? (
              <Link
                href={`/finanzas/proveedores/${equipment.warrantyProviderId}`}
                className="text-navy underline hover:opacity-80"
              >
                {equipment.warrantyProviderName}
              </Link>
            ) : null
          }
        />
        <Field
          label="Vencimiento"
          value={
            equipment.warrantyExpiryDate ? (
              <>
                {formatDate(equipment.warrantyExpiryDate)}
                {days !== null && (
                  <span className="ml-2 text-xs text-slate-400">
                    {days < 0 ? `hace ${Math.abs(days)} días` : `en ${days} días`}
                  </span>
                )}
              </>
            ) : null
          }
        />
        <Field label="No. de OC" value={equipment.warrantyPurchaseOrder} />
        <div className="col-span-2 sm:col-span-3">
          <Field label="Notas" value={equipment.warrantyNotes} />
        </div>
      </dl>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Factura</p>
        {equipment.warrantyInvoiceUrl ? (
          <a
            href={equipment.warrantyInvoiceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-sm font-medium text-navy underline hover:opacity-80"
          >
            {equipment.warrantyInvoiceOriginalName ?? 'Descargar factura'}
          </a>
        ) : (
          <p className="mt-1 text-sm text-slate-400">Sin factura adjunta.</p>
        )}

        {canWrite && (
          <div className="mt-3">
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
              }}
              className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-navy hover:file:bg-slate-200"
            />
            <p className="mt-1 text-xs text-slate-400">
              PDF, JPG o PNG, máximo 10 MB.{' '}
              {equipment.warrantyInvoiceUrl && 'Subir una nueva reemplaza la actual.'}
            </p>
          </div>
        )}

        {uploading && <p className="mt-2 text-xs text-slate-400">Subiendo…</p>}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
