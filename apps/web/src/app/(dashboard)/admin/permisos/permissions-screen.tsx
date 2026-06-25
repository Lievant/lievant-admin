'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { cn } from '@/lib/utils';
import type { PermissionDef, RoleWithPermissions, UserSummary } from '@/lib/api';
import { avatarColor, initials } from '@/lib/avatar';
import { ChevronDownIcon, SearchIcon } from '@/components/icons';
import { DEFAULT_ROLE_BADGE, ROLE_BADGE_STYLES } from '../usuarios/constants';
import {
  fetchUserOverridesAction,
  removeUserPermissionAction,
  setUserPermissionAction,
} from './actions';

const SECTION_LABELS: Record<string, string> = {
  finanzas: 'Finanzas',
  rrhh: 'RRHH',
  herramientas: 'Herramientas',
  admin: 'Administración',
};

const MODULE_LABELS: Record<string, string> = {
  'clientes': 'Clientes',
  'clientes.financiero': 'Clientes › Financiero',
  'clientes.documentos': 'Clientes › Documentos',
  'proveedores': 'Proveedores',
  'proveedores.ordenes': 'Proveedores › Órdenes',
  'proveedores.facturas': 'Proveedores › Facturas',
  'proveedores.bancario': 'Proveedores › Bancario',
  'empleados': 'Empleados',
  'empleados.personal': 'Empleados › Personal',
  'empleados.nomina': 'Empleados › Nómina',
  'empleados.documentos': 'Empleados › Documentos',
  'salas': 'Salas',
  'usuarios': 'Usuarios',
  'roles': 'Roles',
  'catalogos': 'Catálogos',
};

const ACTION_LABELS: Record<string, string> = {
  read: 'Lectura',
  write: 'Escritura',
  admin: 'Admin',
};

const ACTION_BADGE: Record<string, string> = {
  read: 'bg-slate-100 text-slate-500',
  write: 'bg-amber-50 text-amber-600',
  admin: 'bg-purple-50 text-purple-600',
};

const SECTION_ORDER = ['finanzas', 'rrhh', 'herramientas', 'admin'];

function groupBySection<T extends { section: string | null }>(items: T[]): Record<string, T[]> {
  const map: Record<string, T[]> = {};
  for (const item of items) {
    const key = item.section ?? 'otros';
    (map[key] ??= []).push(item);
  }
  return map;
}

// ─── Section 1: Role accordion card ──────────────────────────────────────────

function RoleCard({ role }: { role: RoleWithPermissions }) {
  const [open, setOpen] = useState(false);
  const bySection = useMemo(() => groupBySection(role.permissions), [role.permissions]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-slate-50"
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-semibold',
              ROLE_BADGE_STYLES[role.name] ?? DEFAULT_ROLE_BADGE,
            )}
          >
            {role.name}
          </span>
          {role.description && (
            <span className="text-sm text-slate-500">{role.description}</span>
          )}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            {role.permissions.length} permisos
          </span>
        </div>
        <ChevronDownIcon
          className={cn(
            'h-4 w-4 shrink-0 text-slate-400 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 pb-4">
          {SECTION_ORDER.filter((s) => bySection[s]?.length).map((section) => (
            <div key={section} className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {SECTION_LABELS[section] ?? section}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(bySection[section] ?? []).map((p) => (
                  <span
                    key={p.id}
                    title={p.description ?? undefined}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600"
                  >
                    {MODULE_LABELS[p.module] ?? p.module}
                    <span
                      className={cn(
                        'rounded px-1 py-0.5 text-[10px] font-medium',
                        ACTION_BADGE[p.action] ?? 'bg-slate-100 text-slate-500',
                      )}
                    >
                      {ACTION_LABELS[p.action] ?? p.action}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ))}
          {role.permissions.length === 0 && (
            <p className="mt-4 text-sm text-slate-400">Sin permisos asignados.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Override 3-state control ─────────────────────────────────────────────────

type OverrideState = 'inherited' | 'granted' | 'revoked';

function OverrideControl({
  state,
  disabled,
  onChange,
}: {
  state: OverrideState;
  disabled: boolean;
  onChange: (s: OverrideState) => void;
}) {
  const options: { value: OverrideState; label: string }[] = [
    { value: 'inherited', label: 'Heredar' },
    { value: 'granted', label: 'Conceder' },
    { value: 'revoked', label: 'Revocar' },
  ];

  return (
    <div className="inline-flex overflow-hidden rounded-md border border-slate-200 text-xs">
      {options.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          disabled={disabled}
          onClick={() => state !== value && onChange(value)}
          className={cn(
            'border-r px-2.5 py-1 last:border-r-0 transition-colors',
            state === value
              ? value === 'granted'
                ? 'bg-emerald-500 text-white font-medium'
                : value === 'revoked'
                  ? 'bg-red-500 text-white font-medium'
                  : 'bg-slate-100 text-slate-600 font-medium'
              : 'border-slate-200 text-slate-400 hover:text-slate-600',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

interface PermissionsScreenProps {
  roles: RoleWithPermissions[];
  permissions: PermissionDef[];
  users: UserSummary[];
}

export function PermissionsScreen({ roles, permissions, users }: PermissionsScreenProps) {
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [overrideMap, setOverrideMap] = useState<Map<string, boolean>>(new Map());
  const [loadingOverrides, setLoadingOverrides] = useState(false);
  const [pendingPermId, setPendingPermId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (u) => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term),
    );
  }, [users, search]);

  // Load overrides when selected user changes
  useEffect(() => {
    if (!selectedUser) {
      setOverrideMap(new Map());
      return;
    }
    setLoadingOverrides(true);
    setActionError(null);
    fetchUserOverridesAction(selectedUser.id)
      .then((overrides) => {
        const map = new Map<string, boolean>();
        for (const o of overrides) map.set(o.permissionId, o.granted);
        setOverrideMap(map);
      })
      .catch(() => setActionError('No se pudieron cargar los permisos del usuario.'))
      .finally(() => setLoadingOverrides(false));
  }, [selectedUser]);

  // Permissions inherited by the selected user via their roles
  const inheritedPermIds = useMemo(() => {
    if (!selectedUser) return new Set<string>();
    const userRoleIds = new Set(selectedUser.roles.map((r) => r.id));
    const ids = new Set<string>();
    for (const role of roles) {
      if (userRoleIds.has(role.id)) {
        for (const p of role.permissions) ids.add(p.id);
      }
    }
    return ids;
  }, [selectedUser, roles]);

  const handleOverrideChange = (permId: string, newState: OverrideState) => {
    if (!selectedUser) return;
    setPendingPermId(permId);
    setActionError(null);
    startTransition(async () => {
      if (newState === 'inherited') {
        const result = await removeUserPermissionAction(selectedUser.id, permId);
        if (result.success) {
          setOverrideMap((prev) => {
            const next = new Map(prev);
            next.delete(permId);
            return next;
          });
        } else {
          setActionError(result.error ?? 'Error al actualizar permiso.');
        }
      } else {
        const granted = newState === 'granted';
        const result = await setUserPermissionAction(selectedUser.id, permId, granted);
        if (result.success) {
          setOverrideMap((prev) => new Map(prev).set(permId, granted));
        } else {
          setActionError(result.error ?? 'Error al actualizar permiso.');
        }
      }
      setPendingPermId(null);
    });
  };

  const permsBySection = useMemo(() => groupBySection(permissions), [permissions]);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold text-navy">Permisos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Gestión de permisos por rol y overrides individuales por usuario.
        </p>
      </header>

      {/* ── Sección 1: Permisos por rol ── */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-navy">Permisos por rol</h2>
          <p className="text-sm text-slate-500">
            Solo lectura — los permisos de cada rol se definen en el seed de la base de datos.
          </p>
        </div>
        <div className="space-y-2">
          {roles.map((role) => (
            <RoleCard key={role.id} role={role} />
          ))}
          {roles.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
              No se cargaron los roles. Verifica que la API esté disponible.
            </div>
          )}
        </div>
      </section>

      {/* ── Sección 2: Permisos por usuario ── */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-navy">Permisos por usuario</h2>
          <p className="text-sm text-slate-500">
            Selecciona un usuario para ver sus permisos heredados y agregar overrides individuales.
          </p>
        </div>

        {/* Search */}
        <div className="flex max-w-sm items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
          <SearchIcon className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email…"
            className="w-full text-sm text-navy placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        {/* User list */}
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {filteredUsers.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-slate-400">
              No se encontraron usuarios.
            </p>
          )}
          {filteredUsers.slice(0, 20).map((user) => {
            const role = user.roles[0];
            const isSelected = selectedUser?.id === user.id;
            return (
              <button
                key={user.id}
                type="button"
                onClick={() => setSelectedUser(isSelected ? null : user)}
                className={cn(
                  'flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-slate-50',
                  isSelected && 'border-l-2 border-l-terracota bg-terracota/5',
                )}
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: avatarColor(user.name) }}
                >
                  {initials(user.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-navy">{user.name}</p>
                  <p className="truncate text-xs text-slate-500">{user.email}</p>
                </div>
                {role && (
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
                      ROLE_BADGE_STYLES[role.name] ?? DEFAULT_ROLE_BADGE,
                    )}
                  >
                    {role.name}
                  </span>
                )}
              </button>
            );
          })}
          {filteredUsers.length > 20 && (
            <p className="px-4 py-2 text-center text-xs text-slate-400">
              Mostrando 20 de {filteredUsers.length}. Refina la búsqueda.
            </p>
          )}
        </div>

        {/* Permission matrix */}
        {selectedUser && (
          <div className="mt-6">
            {/* User header */}
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: avatarColor(selectedUser.name) }}
                >
                  {initials(selectedUser.name)}
                </div>
                <div>
                  <p className="font-semibold text-navy">{selectedUser.name}</p>
                  <p className="text-xs text-slate-500">{selectedUser.email}</p>
                </div>
                {selectedUser.roles.map((r) => (
                  <span
                    key={r.id}
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                      ROLE_BADGE_STYLES[r.name] ?? DEFAULT_ROLE_BADGE,
                    )}
                  >
                    {r.name}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Limpiar selección
              </button>
            </div>

            {actionError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
                {actionError}
              </div>
            )}

            {loadingOverrides ? (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400">
                Cargando permisos…
              </div>
            ) : (
              <div className="space-y-4">
                {SECTION_ORDER.filter((s) => permsBySection[s]?.length).map((section) => (
                  <div
                    key={section}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {SECTION_LABELS[section] ?? section}
                      </p>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs text-slate-400">
                          <th className="px-4 py-2 text-left font-medium">Permiso</th>
                          <th className="hidden px-4 py-2 text-left font-medium sm:table-cell">
                            Descripción
                          </th>
                          <th className="px-4 py-2 text-center font-medium">Del rol</th>
                          <th className="px-4 py-2 text-left font-medium">Override</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(permsBySection[section] ?? []).map((perm) => {
                          const fromRole = inheritedPermIds.has(perm.id);
                          const overrideVal = overrideMap.has(perm.id)
                            ? (overrideMap.get(perm.id)! ? 'granted' : 'revoked')
                            : 'inherited';
                          const isPending = pendingPermId === perm.id;

                          return (
                            <tr
                              key={perm.id}
                              className="border-b border-slate-100 last:border-none"
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-slate-700">
                                    {MODULE_LABELS[perm.module] ?? perm.module}
                                  </span>
                                  <span
                                    className={cn(
                                      'rounded px-1.5 py-0.5 text-[10px] font-medium',
                                      ACTION_BADGE[perm.action] ?? 'bg-slate-100 text-slate-500',
                                    )}
                                  >
                                    {ACTION_LABELS[perm.action] ?? perm.action}
                                  </span>
                                </div>
                              </td>
                              <td className="hidden px-4 py-3 text-xs text-slate-500 sm:table-cell">
                                {perm.description}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {fromRole ? (
                                  <span className="text-emerald-500">✓</span>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <OverrideControl
                                  state={overrideVal as OverrideState}
                                  disabled={isPending}
                                  onChange={(s) => handleOverrideChange(perm.id, s)}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
