'use client';

import { useState, useTransition } from 'react';
import type { RoleSummary, UserSummary } from '@/lib/api';
import { CloseIcon } from '@/components/icons';
import { updateUserRoleAction } from './actions';

interface EditRoleDialogProps {
  user: UserSummary;
  roles: RoleSummary[];
  onClose: () => void;
}

export function EditRoleDialog({ user, roles, onClose }: EditRoleDialogProps) {
  const [roleId, setRoleId] = useState(user.roles[0]?.id ?? roles[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!roleId) {
      setError('Selecciona un rol.');
      return;
    }

    startTransition(async () => {
      const result = await updateUserRoleAction(user.id, roleId);
      if (result.success) {
        onClose();
      } else {
        setError(result.error ?? 'No se pudo actualizar el rol.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-navy">Editar rol</h2>
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
          <div>
            <p className="text-sm font-semibold text-navy">{user.name}</p>
            <p className="font-mono text-xs text-slate-400">{user.email}</p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="edit-role">
              Rol asignado
            </label>
            <select
              id="edit-role"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400">El rol define los módulos y acciones disponibles para este usuario.</p>
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
              {isPending ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
