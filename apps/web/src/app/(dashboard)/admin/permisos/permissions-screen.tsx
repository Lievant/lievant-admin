'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { avatarColor, initials } from '@/lib/avatar';
import { ChevronDownIcon, SearchIcon } from '@/components/icons';
import { DEFAULT_ROLE_BADGE, ROLE_BADGE_STYLES } from '../usuarios/constants';

function UserAvatar({ name, email }: { name: string; email: string }) {
  const [failed, setFailed] = useState(false);
  if (!email || failed) {
    return (
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
        style={{ backgroundColor: avatarColor(name) }}
      >
        {initials(name)}
      </div>
    );
  }
  return (
    <img
      src={`/api/users/${encodeURIComponent(email)}/photo`}
      alt={name}
      className="h-8 w-8 shrink-0 rounded-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserRole { id: string; name: string }

interface SearchUser {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  roles: UserRole[];
}

interface EffectivePermItem {
  id: string;
  action: string;
  description: string | null;
  granted: boolean;
  fromRole: boolean;
  overrideGranted: boolean | null;
}

interface EffectivePermModule {
  module: string;
  permissions: EffectivePermItem[];
}

interface EffectivePermSection {
  section: string;
  totalPermissions: number;
  activePermissions: number;
  modules: EffectivePermModule[];
}

interface EffectivePermissionsResult {
  sections: EffectivePermSection[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTION_ORDER = ['finanzas', 'rrhh', 'herramientas', 'transformacion', 'admin'];

const SECTION_LABELS: Record<string, string> = {
  finanzas: 'Finanzas',
  rrhh: 'RRHH',
  herramientas: 'Herramientas',
  transformacion: 'Transformación Digital',
  admin: 'Administración',
};

const MODULE_LABELS: Record<string, string> = {
  'clientes':              'Clientes',
  'clientes.financiero':   'Financiero',
  'clientes.documentos':   'Documentos',
  'proveedores':           'Proveedores',
  'proveedores.ordenes':   'Órdenes',
  'proveedores.facturas':  'Facturas',
  'proveedores.bancario':  'Bancario',
  'reportes':              'Reportes',
  'empleados':             'Empleados',
  'empleados.personal':    'Personal',
  'empleados.nomina':      'Nómina',
  'empleados.documentos':  'Documentos',
  'tickets':               'Tickets',
  'salas':                 'Salas',
  'usuarios':              'Usuarios',
  'roles':                 'Roles',
  'catalogos':             'Catálogos',
  'permisos':              'Permisos',
};

const ACTION_LABELS: Record<string, string> = {
  read:  'Leer',
  write: 'Editar',
  admin: 'Admin',
};

const ACTION_COLORS: Record<string, string> = {
  read:  'text-slate-500',
  write: 'text-amber-600',
  admin: 'text-purple-600',
};

// next override state: null → true → false → null
function nextOverride(current: boolean | null): boolean | null {
  if (current === null) return true;
  if (current === true) return false;
  return null;
}

// ─── Permission Chip ──────────────────────────────────────────────────────────

function PermChip({
  perm,
  pendingOverride,
  onToggle,
}: {
  perm: EffectivePermItem;
  pendingOverride: boolean | null | undefined;
  onToggle: () => void;
}) {
  const hasPending = pendingOverride !== undefined;
  const displayOverride = hasPending ? pendingOverride : perm.overrideGranted;
  const displayGranted = displayOverride !== null ? (displayOverride ?? false) : perm.fromRole;
  const hasOverride = displayOverride !== null;

  return (
    <button
      type="button"
      title={perm.description ?? undefined}
      onClick={onToggle}
      className={cn(
        'inline-flex flex-col items-start rounded-lg px-3 py-2 text-left text-xs transition-all',
        displayGranted
          ? 'bg-emerald-50 text-emerald-800'
          : 'bg-slate-50 text-slate-400',
        hasOverride
          ? displayGranted
            ? 'ring-2 ring-emerald-400'
            : 'ring-2 ring-red-400'
          : 'border border-dashed ' + (displayGranted ? 'border-emerald-300' : 'border-slate-200'),
        hasPending && 'opacity-80',
      )}
    >
      <span className={cn('font-semibold', ACTION_COLORS[perm.action] ?? 'text-slate-500')}>
        {ACTION_LABELS[perm.action] ?? perm.action}
      </span>
    </button>
  );
}

// ─── Section Accordion ────────────────────────────────────────────────────────

function SectionAccordion({
  section,
  pendingChanges,
  onTogglePerm,
}: {
  section: EffectivePermSection;
  pendingChanges: Map<string, boolean | null>;
  onTogglePerm: (permId: string, currentOverride: boolean | null) => void;
}) {
  const [open, setOpen] = useState(true);

  const effectiveActive = section.modules.flatMap((m) => m.permissions).reduce((count, perm) => {
    const pending = pendingChanges.get(perm.id);
    const hasPending = pending !== undefined;
    const override = hasPending ? pending : perm.overrideGranted;
    const granted = override !== null ? (override ?? false) : perm.fromRole;
    return granted ? count + 1 : count;
  }, 0);

  const total = section.modules.flatMap((m) => m.permissions).length;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-slate-50"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-navy">
            {SECTION_LABELS[section.section] ?? section.section}
          </span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-semibold',
              effectiveActive === total
                ? 'bg-emerald-50 text-emerald-700'
                : effectiveActive > 0
                ? 'bg-amber-50 text-amber-700'
                : 'bg-slate-100 text-slate-500',
            )}
          >
            {effectiveActive}/{total}
          </span>
        </div>
        <ChevronDownIcon
          className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 pb-4">
          {section.modules.map((mod) => (
            <div key={mod.module} className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {MODULE_LABELS[mod.module] ?? mod.module}
              </p>
              <div className="flex flex-wrap gap-2">
                {mod.permissions.map((perm) => (
                  <PermChip
                    key={perm.id}
                    perm={perm}
                    pendingOverride={pendingChanges.get(perm.id)}
                    onToggle={() => {
                      const current = pendingChanges.has(perm.id)
                        ? pendingChanges.get(perm.id)!
                        : perm.overrideGranted;
                      onTogglePerm(perm.id, current);
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function PermissionsScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [effectivePerms, setEffectivePerms] = useState<EffectivePermissionsResult | null>(null);
  const [permsLoading, setPermsLoading] = useState(false);

  const [pendingChanges, setPendingChanges] = useState<Map<string, boolean | null>>(new Map());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Search with 300ms debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/auth/users/search?q=${encodeURIComponent(searchQuery)}&limit=10`);
        const data = (await res.json()) as SearchUser[];
        setSearchResults(data);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  // Load effective permissions when user is selected
  useEffect(() => {
    if (!selectedUser) {
      setEffectivePerms(null);
      setPendingChanges(new Map());
      setSaveError(null);
      setSaveSuccess(false);
      return;
    }
    setPermsLoading(true);
    setEffectivePerms(null);
    setPendingChanges(new Map());
    setSaveError(null);
    setSaveSuccess(false);
    fetch(`/api/auth/users/${selectedUser.id}/effective-permissions`)
      .then((r) => r.json() as Promise<EffectivePermissionsResult>)
      .then((data) => setEffectivePerms(data))
      .catch(() => setEffectivePerms({ sections: [] }))
      .finally(() => setPermsLoading(false));
  }, [selectedUser]);

  const handleSelectUser = useCallback((user: SearchUser) => {
    setSelectedUser((prev) => (prev?.id === user.id ? null : user));
  }, []);

  const handleTogglePerm = useCallback((permId: string, currentOverride: boolean | null) => {
    const next = nextOverride(currentOverride);
    setPendingChanges((prev) => {
      const updated = new Map(prev);
      // Find original override from effectivePerms
      updated.set(permId, next);
      return updated;
    });
    setSaveSuccess(false);
  }, []);

  const handleSave = async () => {
    if (!selectedUser || pendingChanges.size === 0) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const errors: string[] = [];
    for (const [permissionId, granted] of pendingChanges) {
      try {
        const res = await fetch(`/api/auth/users/${selectedUser.id}/permissions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissionId, granted }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          errors.push(body.error ?? `Error al actualizar permiso`);
        }
      } catch {
        errors.push('Error de red al guardar permiso');
      }
    }

    if (errors.length > 0) {
      setSaveError(errors[0] ?? 'Error al guardar cambios');
      setSaving(false);
      return;
    }

    // Reload effective permissions to reflect saved state
    try {
      const res = await fetch(`/api/auth/users/${selectedUser.id}/effective-permissions`);
      const data = (await res.json()) as EffectivePermissionsResult;
      setEffectivePerms(data);
    } catch {
      // keep current state
    }
    setPendingChanges(new Map());
    setSaveSuccess(true);
    setSaving(false);
  };

  const orderedSections = effectivePerms
    ? [
        ...SECTION_ORDER.filter((s) => effectivePerms.sections.some((sec) => sec.section === s)).map(
          (s) => effectivePerms.sections.find((sec) => sec.section === s)!,
        ),
        ...effectivePerms.sections.filter((sec) => !SECTION_ORDER.includes(sec.section)),
      ]
    : [];

  const displayedUsers = searchQuery.trim() ? searchResults : [];

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* ── Left panel: search + user list ── */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-4">
          <h1 className="mb-3 text-lg font-bold text-navy">Permisos</h1>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <SearchIcon className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar usuario…"
              className="w-full bg-transparent text-sm text-navy placeholder:text-slate-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {searchLoading && (
            <p className="px-4 py-6 text-center text-sm text-slate-400">Buscando…</p>
          )}
          {!searchLoading && searchQuery.trim() && displayedUsers.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-slate-400">Sin resultados</p>
          )}
          {!searchQuery.trim() && (
            <p className="px-4 py-8 text-center text-sm text-slate-400">
              Escribe para buscar un usuario
            </p>
          )}
          {displayedUsers.map((user) => {
            const isSelected = selectedUser?.id === user.id;
            const role = user.roles[0];
            return (
              <button
                key={user.id}
                type="button"
                onClick={() => handleSelectUser(user)}
                className={cn(
                  'flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-slate-50',
                  isSelected && 'border-l-2 border-l-terracota bg-terracota/5',
                )}
              >
                <UserAvatar name={user.name} email={user.email} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-navy">{user.name}</p>
                  <p className="truncate text-xs text-slate-500">{user.email}</p>
                </div>
                {role && (
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                      ROLE_BADGE_STYLES[role.name] ?? DEFAULT_ROLE_BADGE,
                    )}
                  >
                    {role.name}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Right panel: permissions ── */}
      <main className="flex flex-1 flex-col overflow-hidden bg-slate-50">
        {!selectedUser ? (
          <div className="flex flex-1 items-center justify-center text-slate-400">
            <div className="text-center">
              <p className="text-lg font-medium">Selecciona un usuario</p>
              <p className="mt-1 text-sm">Busca y selecciona un usuario para ver sus permisos</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* User header */}
            <div className="border-b border-slate-200 bg-white px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                    style={{ backgroundColor: avatarColor(selectedUser.name) }}
                  >
                    {initials(selectedUser.name)}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-navy">{selectedUser.name}</p>
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
                    <p className="text-xs text-slate-500">{selectedUser.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {saveSuccess && (
                    <span className="text-sm text-emerald-600">Cambios guardados</span>
                  )}
                  {pendingChanges.size > 0 && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                      {pendingChanges.size} cambio{pendingChanges.size !== 1 ? 's' : ''} pendiente{pendingChanges.size !== 1 ? 's' : ''}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || pendingChanges.size === 0}
                    className={cn(
                      'rounded-md px-4 py-2 text-sm font-medium transition-colors',
                      pendingChanges.size > 0 && !saving
                        ? 'bg-terracota text-white hover:bg-terracota/90'
                        : 'cursor-not-allowed bg-slate-100 text-slate-400',
                    )}
                  >
                    {saving ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
              </div>

              {saveError && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
                  {saveError}
                </div>
              )}

              {/* Legend */}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-sm border border-dashed border-emerald-300 bg-emerald-50" />
                  Activo (del rol)
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-sm bg-emerald-50 ring-2 ring-emerald-400" />
                  Activo (override)
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-sm border border-dashed border-slate-200 bg-slate-50" />
                  Inactivo (del rol)
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-sm bg-slate-50 ring-2 ring-red-400" />
                  Revocado (override)
                </div>
                <span className="text-slate-400">— Clic en chip para cambiar</span>
              </div>
            </div>

            {/* Permission sections */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {permsLoading ? (
                <div className="flex h-32 items-center justify-center text-sm text-slate-400">
                  Cargando permisos…
                </div>
              ) : (
                <div className="space-y-3">
                  {orderedSections.map((section) => (
                    <SectionAccordion
                      key={section.section}
                      section={section}
                      pendingChanges={pendingChanges}
                      onTogglePerm={handleTogglePerm}
                    />
                  ))}
                  {orderedSections.length === 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
                      No se encontraron permisos.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
