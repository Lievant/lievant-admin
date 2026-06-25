'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { cn } from '@/lib/utils';
import type { RoleSummary, UserSummary } from '@/lib/api';
import { avatarColor, initials } from '@/lib/avatar';
import { CheckIcon, CloseIcon, PlusIcon, SearchIcon } from '@/components/icons';
import { activateUserAction, deactivateUserAction } from './actions';
import {
  DEFAULT_ROLE_BADGE,
  LOCATIONS,
  LOCATION_LABELS,
  ROLE_BADGE_STYLES,
  STATUS_BADGE_STYLES,
  STATUS_LABELS,
  formatLastLogin,
  getUserStatus,
  type UserStatus,
} from './constants';
import { NewUserDialog } from './new-user-dialog';
import { EditRoleDialog } from './edit-role-dialog';

const PAGE_SIZE = 10;

interface UsersScreenProps {
  users: UserSummary[];
  roles: RoleSummary[];
  apiUnavailable: boolean;
}

export function UsersScreen({ users, roles, apiUnavailable }: UsersScreenProps) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');
  const [locationFilter, setLocationFilter] = useState('');
  const [page, setPage] = useState(1);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserSummary | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) => {
      const status = getUserStatus(user);
      const matchesSearch =
        !term || user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term);
      const matchesRole = !roleFilter || user.roles.some((role) => role.name === roleFilter);
      const matchesStatus = !statusFilter || status === statusFilter;
      const matchesLocation = !locationFilter || user.location === locationFilter;
      return matchesSearch && matchesRole && matchesStatus && matchesLocation;
    });
  }, [users, search, roleFilter, statusFilter, locationFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, statusFilter, locationFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageUsers = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const locationsInUse = useMemo(() => {
    const set = new Set(users.map((user) => user.location).filter((loc): loc is NonNullable<typeof loc> => !!loc));
    return set.size;
  }, [users]);

  const runAction = (id: string, action: () => Promise<{ success: boolean; error?: string }>) => {
    setActionError(null);
    setPendingActionId(id);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setActionError(result.error ?? 'No se pudo completar la acción.');
      }
      setPendingActionId(null);
    });
  };

  return (
    <div>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Usuarios</h1>
          <p className="mt-1 text-sm text-slate-500">
            {users.length} colaboradores · {locationsInUse || LOCATIONS.length} sedes
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 rounded-md bg-terracota px-4 py-2 text-sm font-semibold text-white hover:bg-terracota-dark"
        >
          <PlusIcon className="h-4 w-4" />
          Nuevo usuario
        </button>
      </header>

      {apiUnavailable && (
        <div className="mt-6 rounded-lg border border-terracota/30 bg-terracota/5 px-4 py-3 text-sm text-terracota-dark">
          No se pudo conectar con la API. Inicia sesión como administrador para ver datos en vivo.
        </div>
      )}

      {actionError && (
        <div className="mt-6 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} aria-label="Cerrar">
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
          <SearchIcon className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email…"
            className="w-full text-sm text-navy placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-terracota focus:outline-none"
        >
          <option value="">Rol: Todos</option>
          {roles.map((role) => (
            <option key={role.id} value={role.name}>
              {role.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as UserStatus | '')}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-terracota focus:outline-none"
        >
          <option value="">Estado: Todos</option>
          <option value="activo">Activo</option>
          <option value="pendiente">Pendiente</option>
          <option value="inactivo">Inactivo</option>
        </select>

        <select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-terracota focus:outline-none"
        >
          <option value="">Sede: Todas</option>
          {LOCATIONS.map((loc) => (
            <option key={loc} value={loc}>
              {LOCATION_LABELS[loc]}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Avatar</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Sede</th>
              <th className="px-4 py-3">MFA</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Último acceso</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pageUsers.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-400">
                  No se encontraron usuarios con los filtros seleccionados.
                </td>
              </tr>
            )}
            {pageUsers.map((user) => {
              const status = getUserStatus(user);
              const role = user.roles[0];
              const isRowPending = pendingActionId === user.id;

              return (
                <tr
                  key={user.id}
                  className={cn(
                    'border-b border-slate-100 last:border-none',
                    status === 'pendiente' && 'bg-amber-50/60',
                  )}
                >
                  <td className="px-4 py-3">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: avatarColor(user.name) }}
                    >
                      {initials(user.name)}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-navy">{user.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{user.email}</td>
                  <td className="px-4 py-3">
                    {role ? (
                      <span
                        className={cn(
                          'rounded-full px-2 py-1 text-xs font-semibold',
                          ROLE_BADGE_STYLES[role.name] ?? DEFAULT_ROLE_BADGE,
                        )}
                      >
                        {role.name}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Sin rol</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {user.location ? LOCATION_LABELS[user.location] : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {user.mfaEnabled ? (
                      <CheckIcon className="h-4 w-4 text-green-600" />
                    ) : (
                      <CloseIcon className="h-4 w-4 text-slate-300" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('rounded-full px-2 py-1 text-xs font-semibold', STATUS_BADGE_STYLES[status])}>
                      {STATUS_LABELS[status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatLastLogin(user.lastLoginAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {status === 'pendiente' && (
                        <>
                          <button
                            type="button"
                            disabled={isRowPending}
                            onClick={() => runAction(user.id, () => activateUserAction(user.id))}
                            className="rounded-md border border-green-200 px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50 disabled:opacity-50"
                          >
                            Aprobar
                          </button>
                          <button
                            type="button"
                            disabled={isRowPending}
                            onClick={() => runAction(user.id, () => deactivateUserAction(user.id))}
                            className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            Rechazar
                          </button>
                        </>
                      )}
                      {status === 'activo' && (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditingUser(user)}
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-slate-300"
                          >
                            Editar rol
                          </button>
                          <button
                            type="button"
                            disabled={isRowPending}
                            onClick={() => runAction(user.id, () => deactivateUserAction(user.id))}
                            className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            Desactivar
                          </button>
                        </>
                      )}
                      {status === 'inactivo' && (
                        <button
                          type="button"
                          disabled={isRowPending}
                          onClick={() => runAction(user.id, () => activateUserAction(user.id))}
                          className="rounded-md border border-green-200 px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50 disabled:opacity-50"
                        >
                          Activar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pager */}
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
          <span>
            Mostrando {pageUsers.length} de {filteredUsers.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-40"
            >
              ←
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={cn(
                  'rounded-md border px-2 py-1',
                  p === currentPage ? 'border-terracota bg-terracota text-white' : 'border-slate-200 text-slate-600',
                )}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-40"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {isCreateOpen && <NewUserDialog roles={roles} onClose={() => setCreateOpen(false)} />}
      {editingUser && <EditRoleDialog user={editingUser} roles={roles} onClose={() => setEditingUser(null)} />}
    </div>
  );
}
