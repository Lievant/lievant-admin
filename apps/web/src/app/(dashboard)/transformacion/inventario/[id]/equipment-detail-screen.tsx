'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { EquipmentBrandCatalog, EquipmentDetail, EquipmentStatusCatalog, EquipmentTypeCatalog } from '@/lib/api';
import { statusBadgeStyle, typeIcon } from '../constants';
import { InfoTab } from './info-tab';
import { AssignmentTab } from './assignment-tab';
import { HistoryTab } from './history-tab';

interface Catalogs {
  types: EquipmentTypeCatalog[];
  brands: EquipmentBrandCatalog[];
  statuses: EquipmentStatusCatalog[];
}

interface Props {
  equipment: EquipmentDetail;
  catalogs: Catalogs;
}

const TABS = [
  { key: 'info', label: 'Información' },
  { key: 'assignment', label: 'Asignación' },
  { key: 'history', label: 'Historial' },
];

export function EquipmentDetailScreen({ equipment: initialEquipment, catalogs }: Props) {
  const [tab, setTab] = useState<'info' | 'assignment' | 'history'>('info');
  const [equipment, setEquipment] = useState(initialEquipment);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <i className={`ti ${typeIcon(equipment.equipmentType)} text-2xl text-slate-400`} />
            <div>
              <h1 className="text-xl font-bold text-navy">
                {equipment.brand} {equipment.model ?? ''}
              </h1>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="font-mono text-sm text-terracota">{equipment.displayId}</span>
                {equipment.legacyId && (
                  <span className="text-xs text-slate-400">({equipment.legacyId})</span>
                )}
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeStyle(equipment.status)}`}>
                  {equipment.status}
                </span>
              </div>
            </div>
          </div>
        </div>
        <Link
          href="/transformacion/inventario"
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          ← Volver
        </Link>
      </div>

      {/* Tabs */}
      <div className="mt-6 border-b border-slate-200">
        <nav className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as typeof tab)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'border-b-2 border-terracota text-terracota'
                  : 'text-slate-500 hover:text-navy'
              }`}
            >
              {t.label}
              {t.key === 'history' && equipment.history.length > 0 && (
                <span className="ml-1.5 rounded-full bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600">
                  {equipment.history.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {tab === 'info' && (
          <InfoTab equipment={equipment} catalogs={catalogs} onUpdated={setEquipment} />
        )}
        {tab === 'assignment' && (
          <AssignmentTab equipment={equipment} onUpdated={setEquipment} />
        )}
        {tab === 'history' && (
          <HistoryTab history={equipment.history} />
        )}
      </div>
    </div>
  );
}
