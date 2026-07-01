'use client';

import type { EquipmentHistoryEntry } from '@/lib/api';

const ACTION_STYLES: Record<string, string> = {
  CREADO: 'bg-green-50 text-green-700',
  ASIGNADO: 'bg-blue-50 text-blue-700',
  DESASIGNADO: 'bg-slate-100 text-slate-600',
  EDITADO: 'bg-yellow-50 text-yellow-700',
  ESTATUS_CAMBIADO: 'bg-purple-50 text-purple-700',
};

const FIELD_LABELS: Record<string, string> = {
  equipmentType: 'Tipo',
  brand: 'Marca',
  model: 'Modelo',
  serialNumber: 'No. serie',
  operatingSystem: 'Sistema operativo',
  adName: 'Nombre AD',
  status: 'Estatus',
  location: 'Ubicación',
  area: 'Área',
  purchaseValue: 'Valor',
  notes: 'Notas',
  specifications: 'Especificaciones',
  assignedToEmployeeId: 'Asignado a',
};

interface Props {
  history: EquipmentHistoryEntry[];
}

export function HistoryTab({ history }: Props) {
  if (history.length === 0) {
    return <p className="text-sm text-slate-400">Sin historial de cambios.</p>;
  }

  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-0 h-full w-0.5 bg-slate-200" />
      <ul className="space-y-5">
        {[...history].reverse().map((entry) => (
          <li key={entry.id} className="relative">
            <div className="absolute -left-4 mt-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-slate-300" />
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ACTION_STYLES[entry.action] ?? 'bg-slate-100 text-slate-600'}`}>
                  {entry.action}
                </span>
                {entry.fieldChanged && (
                  <span className="text-xs text-slate-500">
                    {FIELD_LABELS[entry.fieldChanged] ?? entry.fieldChanged}
                  </span>
                )}
              </div>

              {entry.fieldChanged && (entry.oldValue || entry.newValue) && (
                <div className="mt-2 flex items-center gap-2 text-sm">
                  {entry.oldValue && (
                    <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-600 line-through">{entry.oldValue}</span>
                  )}
                  {entry.oldValue && entry.newValue && <span className="text-slate-400">→</span>}
                  {entry.newValue && (
                    <span className="rounded bg-green-50 px-2 py-0.5 text-xs text-green-700">{entry.newValue}</span>
                  )}
                </div>
              )}

              {entry.notes && (
                <p className="mt-2 text-sm text-slate-600">{entry.notes}</p>
              )}

              <p className="mt-2 text-xs text-slate-400">
                {entry.changedByName} · {new Date(entry.createdAt).toLocaleDateString('es-MX', {
                  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
