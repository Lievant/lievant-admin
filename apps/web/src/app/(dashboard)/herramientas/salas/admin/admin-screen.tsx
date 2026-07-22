'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { Booking, CountryWithCities, ErrorKind } from '@/lib/api';
import { NoPermissions } from '@/components/ui/no-permissions';
import { AllBookingsTab } from './all-bookings-tab';
import { flattenOffices } from './office-options';
import { LocationsTab } from './locations-tab';
import { PendingApprovalsTab } from './pending-approvals-tab';
import { RoomsManagementTab } from './rooms-management-tab';

type Tab = 'aprobaciones' | 'reservas' | 'salas' | 'ubicaciones';

interface AdminScreenProps {
  isGlobalAdmin: boolean;
  officeIds: string[];
  locationsTree: CountryWithCities[];
  errorKind: ErrorKind | null;
  pendingApprovals: Booking[];
}

export function AdminScreen({ isGlobalAdmin, officeIds, locationsTree, errorKind, pendingApprovals }: AdminScreenProps) {
  const [tab, setTab] = useState<Tab>('aprobaciones');

  const offices = flattenOffices(locationsTree, officeIds, isGlobalAdmin);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'aprobaciones', label: 'Aprobaciones pendientes' },
    { id: 'reservas', label: 'Todas las reservas' },
    { id: 'salas', label: 'Gestión de salas' },
  ];
  if (isGlobalAdmin) {
    tabs.push({ id: 'ubicaciones', label: 'Ubicaciones' });
  }

  if (errorKind === 'forbidden') {
    return <NoPermissions />;
  }

  return (
    <div>
      <header>
        <h1 className="text-2xl font-bold text-navy">Administración de salas</h1>
        <p className="mt-1 text-sm text-slate-500">Herramientas · Reserva de salas</p>
      </header>

      {errorKind === 'unavailable' && (
        <div className="mt-6 rounded-lg border border-terracota/30 bg-terracota/5 px-4 py-3 text-sm text-terracota-dark">
          No se pudo conectar con la API. Inicia sesión para ver datos en vivo.
        </div>
      )}

      <div className="mt-6 flex gap-2 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              tab === t.id ? 'border-terracota text-terracota' : 'border-transparent text-slate-500 hover:text-navy',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === 'aprobaciones' && <PendingApprovalsTab bookings={pendingApprovals} />}
        {tab === 'reservas' && <AllBookingsTab offices={offices} />}
        {tab === 'salas' && <RoomsManagementTab offices={offices} />}
        {tab === 'ubicaciones' && isGlobalAdmin && <LocationsTab locationsTree={locationsTree} />}
      </div>
    </div>
  );
}
