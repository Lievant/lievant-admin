'use client';

import { useState } from 'react';
import type { CountryWithCities } from '@/lib/api';
import { LocationDialog } from './location-dialog';

interface LocationsTabProps {
  locationsTree: CountryWithCities[];
}

interface DialogState {
  kind: 'country' | 'city' | 'office';
  parentId?: string;
}

export function LocationsTab({ locationsTree }: LocationsTabProps) {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  if (locationsTree.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400 shadow-sm">
          No hay países registrados.
        </div>
        <button
          type="button"
          onClick={() => setDialog({ kind: 'country' })}
          className="rounded-md bg-terracota px-4 py-2 text-sm font-semibold text-white hover:bg-terracota-dark"
        >
          + Nuevo país
        </button>
        {dialog &&
          (dialog.parentId ? (
            <LocationDialog kind={dialog.kind} parentId={dialog.parentId} onClose={() => setDialog(null)} />
          ) : (
            <LocationDialog kind={dialog.kind} onClose={() => setDialog(null)} />
          ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setDialog({ kind: 'country' })}
          className="rounded-md bg-terracota px-4 py-2 text-sm font-semibold text-white hover:bg-terracota-dark"
        >
          + Nuevo país
        </button>
      </div>

      <div className="space-y-4">
        {locationsTree.map((country) => (
          <div key={country.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-navy">
                {country.name} <span className="font-mono text-xs text-slate-400">{country.code}</span>
              </p>
              <button
                type="button"
                onClick={() => setDialog({ kind: 'city', parentId: country.id })}
                className="text-sm font-medium text-terracota hover:underline"
              >
                + Ciudad
              </button>
            </div>

            {country.cities.length > 0 && (
              <div className="mt-3 space-y-3 border-l border-slate-200 pl-4">
                {country.cities.map((city) => (
                  <div key={city.id}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-navy">{city.name}</p>
                      <button
                        type="button"
                        onClick={() => setDialog({ kind: 'office', parentId: city.id })}
                        className="text-sm font-medium text-terracota hover:underline"
                      >
                        + Oficina
                      </button>
                    </div>

                    {city.offices.length > 0 && (
                      <ul className="mt-1 space-y-1 border-l border-slate-100 pl-4">
                        {city.offices.map((office) => (
                          <li key={office.id} className="text-sm text-slate-500">
                            {office.name}
                            {office.address ? ` · ${office.address}` : ''}
                            {!office.isActive && ' (inactiva)'}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {dialog &&
        (dialog.parentId ? (
          <LocationDialog kind={dialog.kind} parentId={dialog.parentId} onClose={() => setDialog(null)} />
        ) : (
          <LocationDialog kind={dialog.kind} onClose={() => setDialog(null)} />
        ))}
    </div>
  );
}
