'use client';

import { useState, useTransition } from 'react';
import type { RoleSummary, UserLocation } from '@/lib/api';
import { CloseIcon } from '@/components/icons';
import { createUserAction } from './actions';
import { LOCATIONS, LOCATION_LABELS } from './constants';

const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@lievant\.com$/;

interface NewUserDialogProps {
  roles: RoleSummary[];
  onClose: () => void;
}

export function NewUserDialog({ roles, onClose }: NewUserDialogProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState<UserLocation>('LEON');
  const [roleId, setRoleId] = useState(roles[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }

    if (!EMAIL_PATTERN.test(email)) {
      setError('El email debe ser una cuenta corporativa @lievant.com');
      return;
    }

    if (!roleId) {
      setError('Selecciona un rol.');
      return;
    }

    startTransition(async () => {
      const result = await createUserAction({ name: name.trim(), email, location, roleId });
      if (result.success) {
        onClose();
      } else {
        setError(result.error ?? 'No se pudo crear el usuario.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-navy">Nuevo usuario</h2>
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
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="user-name">
              Nombre
            </label>
            <input
              id="user-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pedro García Méndez"
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="user-email">
              Email corporativo
            </label>
            <input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pedro.garcia@lievant.com"
              className="rounded-md border border-slate-200 px-3 py-2 font-mono text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
            />
            <p className="text-xs text-slate-400">Debe ser una cuenta @lievant.com existente en Azure AD / M365.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="user-location">
                Sede
              </label>
              <select
                id="user-location"
                value={location}
                onChange={(e) => setLocation(e.target.value as UserLocation)}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
              >
                {LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {LOCATION_LABELS[loc]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="user-role">
                Rol
              </label>
              <select
                id="user-role"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
              >
                {roles.length === 0 && <option value="">No hay roles disponibles</option>}
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-terracota/20 bg-terracota-bg px-4 py-3">
            <p className="text-xs font-semibold text-terracota-dark">¿Qué pasa al crear?</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              El usuario quedará en estado <strong>Pendiente</strong> y recibirá un correo de bienvenida. Un
              administrador deberá aprobarlo para que pueda iniciar sesión con su cuenta de Microsoft.
            </p>
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
              {isPending ? 'Creando…' : 'Crear y enviar invitación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
