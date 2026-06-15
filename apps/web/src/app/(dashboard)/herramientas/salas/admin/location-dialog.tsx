'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CloseIcon } from '@/components/icons';
import { createRoomCityAction, createRoomCountryAction, createRoomOfficeAction } from '../actions';
import { TextField } from '../form-field';

type LocationKind = 'country' | 'city' | 'office';

interface LocationDialogProps {
  kind: LocationKind;
  parentId?: string;
  onClose: () => void;
}

const TITLES: Record<LocationKind, string> = {
  country: 'Nuevo país',
  city: 'Nueva ciudad',
  office: 'Nueva oficina',
};

export function LocationDialog({ kind, parentId, onClose }: LocationDialogProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }

    if (kind === 'country' && !code.trim()) {
      setError('El código del país es obligatorio.');
      return;
    }

    startTransition(async () => {
      let result;
      if (kind === 'country') {
        result = await createRoomCountryAction({ name: name.trim(), code: code.trim().toUpperCase() });
      } else if (kind === 'city') {
        if (!parentId) {
          setError('No se encontró el país seleccionado.');
          return;
        }
        result = await createRoomCityAction({ country_id: parentId, name: name.trim() });
      } else {
        if (!parentId) {
          setError('No se encontró la ciudad seleccionada.');
          return;
        }
        const payload: { city_id: string; name: string; address?: string } = { city_id: parentId, name: name.trim() };
        if (address.trim()) payload.address = address.trim();
        result = await createRoomOfficeAction(payload);
      }

      if (result.success) {
        router.refresh();
        onClose();
      } else {
        setError(result.error ?? 'No se pudo guardar.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-navy">{TITLES[kind]}</h2>
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
          <TextField id="location-name" label="Nombre" value={name} onChange={setName} />

          {kind === 'country' && (
            <TextField id="location-code" label="Código" value={code} onChange={(v) => setCode(v.slice(0, 5))} mono />
          )}

          {kind === 'office' && (
            <TextField id="location-address" label="Dirección (opcional)" value={address} onChange={setAddress} />
          )}

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
              {isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
