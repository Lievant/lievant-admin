'use client';

import { useState } from 'react';
import type { EquipmentBrandCatalog, EquipmentDetail, EquipmentStatusCatalog, EquipmentTypeCatalog } from '@/lib/api';
import { BrandSelect } from '../brand-select';
import { formatCurrency, formatDate } from '../constants';

interface Catalogs {
  types: EquipmentTypeCatalog[];
  brands: EquipmentBrandCatalog[];
  statuses: EquipmentStatusCatalog[];
}

interface Props {
  equipment: EquipmentDetail;
  catalogs: Catalogs;
  onUpdated: (e: EquipmentDetail) => void;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm text-navy">{value ?? <span className="text-slate-300">—</span>}</dd>
    </div>
  );
}

export function InfoTab({ equipment, catalogs, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    equipmentType: equipment.equipmentType,
    brand: equipment.brand ?? '',
    model: equipment.model ?? '',
    serialNumber: equipment.serialNumber ?? '',
    operatingSystem: equipment.operatingSystem ?? '',
    adName: equipment.adName ?? '',
    specifications: equipment.specifications ?? '',
    status: equipment.status,
    location: equipment.location ?? '',
    area: equipment.area ?? '',
    purchaseDate: equipment.purchaseDate ?? '',
    purchaseValue: equipment.purchaseValue ? String(parseFloat(equipment.purchaseValue)) : '',
    chargerIncluded: equipment.chargerIncluded,
    notes: equipment.notes ?? '',
    legacyId: equipment.legacyId ?? '',
    responsiva: equipment.responsiva ?? '',
  });

  function set(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/inventory/equipment/${equipment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentType: form.equipmentType || undefined,
          brand: form.brand || undefined,
          model: form.model || undefined,
          serialNumber: form.serialNumber || undefined,
          operatingSystem: form.operatingSystem || undefined,
          adName: form.adName || undefined,
          specifications: form.specifications || undefined,
          status: form.status || undefined,
          location: form.location || undefined,
          area: form.area || undefined,
          purchaseDate: form.purchaseDate || undefined,
          purchaseValue: form.purchaseValue ? parseFloat(form.purchaseValue) : undefined,
          chargerIncluded: form.chargerIncluded,
          notes: form.notes || undefined,
          legacyId: form.legacyId || undefined,
          responsiva: form.responsiva || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? 'Error al guardar');
      }
      const updated = (await res.json()) as EquipmentDetail;
      onUpdated({ ...equipment, ...updated });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-terracota focus:outline-none';

  if (!editing) {
    return (
      <div>
        <div className="flex justify-end">
          <button
            onClick={() => setEditing(true)}
            className="rounded-md border border-slate-200 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Editar
          </button>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
          <Field label="ID Lievant" value={equipment.displayId} />
          <Field label="ID Legado" value={equipment.legacyId} />
          <Field label="Tipo" value={equipment.equipmentType} />
          <Field label="Marca" value={equipment.brand} />
          <Field label="Modelo" value={equipment.model} />
          <Field label="No. de Serie" value={equipment.serialNumber} />
          <Field label="Sistema Operativo" value={equipment.operatingSystem} />
          <Field label="Nombre en AD" value={equipment.adName} />
          <Field label="Estatus" value={equipment.status} />
          <Field label="Ubicación" value={equipment.location} />
          <Field label="Área" value={equipment.area} />
          <Field label="No. Responsiva" value={equipment.responsiva} />
          <Field label="Fecha de compra" value={formatDate(equipment.purchaseDate)} />
          <Field label="Valor del equipo" value={formatCurrency(equipment.purchaseValue)} />
          <Field label="Cargador incluido" value={equipment.chargerIncluded ? 'Sí' : 'No'} />
        </dl>
        {equipment.specifications && (
          <div className="mt-5">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Especificaciones</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-navy">{equipment.specifications}</dd>
          </div>
        )}
        {equipment.notes && (
          <div className="mt-5">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notas TI</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{equipment.notes}</dd>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-terracota/30 bg-terracota/5 px-4 py-3 text-sm text-terracota-dark">
          {error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Tipo *</label>
          <select value={form.equipmentType} onChange={(e) => set('equipmentType', e.target.value)} className={inputClass}>
            {catalogs.types.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Marca</label>
          <BrandSelect brands={catalogs.brands} value={form.brand} onChange={(v) => set('brand', v)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Modelo</label>
          <input type="text" value={form.model} onChange={(e) => set('model', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">No. serie</label>
          <input type="text" value={form.serialNumber} onChange={(e) => set('serialNumber', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Sistema operativo</label>
          <input type="text" value={form.operatingSystem} onChange={(e) => set('operatingSystem', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Nombre AD</label>
          <input type="text" value={form.adName} onChange={(e) => set('adName', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">ID Legado</label>
          <input type="text" value={form.legacyId} onChange={(e) => set('legacyId', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">No. Responsiva</label>
          <input type="text" value={form.responsiva} onChange={(e) => set('responsiva', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Estatus</label>
          <select value={form.status} onChange={(e) => set('status', e.target.value)} className={inputClass}>
            {catalogs.statuses.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Ubicación</label>
          <select value={form.location} onChange={(e) => set('location', e.target.value)} className={inputClass}>
            <option value="">—</option>
            {['León', 'Ciudad de México', 'Guadalajara', 'Medellín', 'Charlotte'].map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Área</label>
          <input type="text" value={form.area} onChange={(e) => set('area', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Fecha compra</label>
          <input type="date" value={form.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Valor (MXN)</label>
          <input type="number" min="0" step="0.01" value={form.purchaseValue} onChange={(e) => set('purchaseValue', e.target.value)} className={inputClass} />
        </div>
        <div className="flex items-center gap-2 pt-5">
          <input type="checkbox" id="charger-edit" checked={form.chargerIncluded} onChange={(e) => set('chargerIncluded', e.target.checked)} className="h-4 w-4" />
          <label htmlFor="charger-edit" className="text-sm text-slate-700">Cargador incluido</label>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Especificaciones</label>
        <textarea value={form.specifications} onChange={(e) => set('specifications', e.target.value)} rows={2} className={inputClass} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Notas TI</label>
        <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} className={inputClass} />
      </div>
      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving} className="rounded-md bg-terracota px-5 py-2 text-sm font-semibold text-white hover:bg-terracota-dark disabled:opacity-50">
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
        <button onClick={() => setEditing(false)} className="rounded-md border border-slate-200 px-5 py-2 text-sm text-slate-600 hover:bg-slate-50">
          Cancelar
        </button>
      </div>
    </div>
  );
}
