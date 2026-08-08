'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  EmployeePicker,
  type EmployeePickerValue,
} from '@/app/(dashboard)/rrhh/empleados/employee-picker';

// ── tipos ────────────────────────────────────────────────────────────────────

type RecipientType = 'jefe_inmediato' | 'solicitante' | 'empleado' | 'permiso';
type NotificationType = 'informativa' | 'accion' | 'accion_con_nota';

interface FlowRecipient {
  id: string;
  flowId: string;
  recipientType: RecipientType;
  employeeId: string | null;
  employee: { id: string; fullName: string } | null;
  permissionKey: string | null;
  notificationType: NotificationType;
  sortOrder: number;
  isActive: boolean;
}

interface NotificationFlow {
  id: string;
  module: string;
  event: string;
  name: string;
  description: string | null;
  isActive: boolean;
  recipients: FlowRecipient[];
}

interface Permission {
  id: string;
  section: string;
  module: string;
  action: string;
  description: string | null;
}

// ── etiquetas ────────────────────────────────────────────────────────────────

const MODULE_LABELS: Record<string, string> = {
  vacaciones: 'Vacaciones',
  helpdesk: 'Soporte TI',
  salas: 'Reserva de salas',
};

const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  informativa: 'Informativa',
  accion: 'Acción',
  accion_con_nota: 'Acción con nota',
};

// 'solicitante' no se ofrece al agregar: ese aviso lo emite el propio módulo y
// duplicarlo aquí mandaría dos notificaciones por el mismo evento. Se mantiene
// en las etiquetas porque una regla ya existente de ese tipo debe poder leerse.
const RECIPIENT_TYPE_LABELS: Record<RecipientType, string> = {
  jefe_inmediato: 'Jefe inmediato',
  solicitante: 'Solicitante',
  empleado: 'Empleado específico',
  permiso: 'Por permiso',
};

const ADDABLE_TYPES: RecipientType[] = ['jefe_inmediato', 'empleado', 'permiso'];

function describeRecipient(recipient: FlowRecipient): string {
  switch (recipient.recipientType) {
    case 'jefe_inmediato':
      return 'Jefe inmediato del solicitante';
    case 'solicitante':
      return 'Quien generó el evento';
    case 'empleado':
      return recipient.employee?.fullName ?? 'Empleado eliminado';
    case 'permiso':
      return `Todos los usuarios con ${recipient.permissionKey}`;
    default:
      return '—';
  }
}

// ── pantalla ─────────────────────────────────────────────────────────────────

export function NotificationFlowsScreen() {
  const [flows, setFlows] = useState<NotificationFlow[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFlows = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/flows');
      if (res.status === 403) {
        setError('No tienes permiso para configurar flujos de notificación.');
        return;
      }
      if (!res.ok) {
        setError('No se pudieron cargar los flujos.');
        return;
      }
      setFlows((await res.json()) as NotificationFlow[]);
      setError(null);
    } catch {
      setError('No se pudieron cargar los flujos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFlows();
    void (async () => {
      try {
        const res = await fetch('/api/auth/permissions');
        if (res.ok) setPermissions((await res.json()) as Permission[]);
      } catch {
        /* el selector por permiso queda vacío; el resto de la pantalla sirve */
      }
    })();
  }, [loadFlows]);

  const byModule = flows.reduce<Record<string, NotificationFlow[]>>((acc, flow) => {
    (acc[flow.module] ??= []).push(flow);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <p className="text-sm text-slate-400">Cargando flujos…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-navy">Flujos de notificación</h1>
        <p className="mt-1 text-sm text-slate-500">
          Define a quién le llega cada evento de la plataforma. El aviso al solicitante y a su jefe
          inmediato es parte del flujo de aprobación y no se configura aquí.
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {Object.entries(byModule).map(([module, moduleFlows]) => (
          <section key={module}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {MODULE_LABELS[module] ?? module}
            </h2>
            <div className="space-y-2">
              {moduleFlows.map((flow) => (
                <FlowCard
                  key={flow.id}
                  flow={flow}
                  permissions={permissions}
                  expanded={expanded === flow.id}
                  onToggle={() => setExpanded(expanded === flow.id ? null : flow.id)}
                  onChanged={loadFlows}
                  onError={setError}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {!error && flows.length === 0 && (
        <p className="text-sm text-slate-400">No hay flujos configurados.</p>
      )}
    </div>
  );
}

// ── tarjeta de flujo ─────────────────────────────────────────────────────────

interface FlowCardProps {
  flow: NotificationFlow;
  permissions: Permission[];
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => Promise<void>;
  onError: (message: string | null) => void;
}

function FlowCard({ flow, permissions, expanded, onToggle, onChanged, onError }: FlowCardProps) {
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const activeCount = flow.recipients.filter((r) => r.isActive).length;

  async function call(url: string, init: RequestInit): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(url, init);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        onError(body?.message ?? 'No se pudo aplicar el cambio.');
        return false;
      }
      onError(null);
      await onChanged();
      return true;
    } catch {
      onError('No se pudo aplicar el cambio.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="text-slate-400">{expanded ? '▾' : '▸'}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-navy">{flow.name}</span>
          {flow.description && (
            <span className="block truncate text-xs text-slate-400">{flow.description}</span>
          )}
        </span>
        <span className="shrink-0 rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">
          {activeCount} destinatario{activeCount === 1 ? '' : 's'}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3">
          {flow.recipients.length === 0 ? (
            <p className="text-xs text-slate-400">
              Sin destinatarios adicionales. Este evento solo avisa a quien corresponda por código.
            </p>
          ) : (
            <ul className="mb-3 space-y-2">
              {flow.recipients.map((recipient) => (
                <li
                  key={recipient.id}
                  className="flex items-center gap-3 rounded-md border border-slate-100 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-navy">{describeRecipient(recipient)}</p>
                    <p className="text-xs text-slate-400">
                      {RECIPIENT_TYPE_LABELS[recipient.recipientType]} ·{' '}
                      {NOTIFICATION_TYPE_LABELS[recipient.notificationType]}
                    </p>
                  </div>

                  <label className="flex shrink-0 items-center gap-1.5 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={recipient.isActive}
                      disabled={busy}
                      onChange={(e) =>
                        void call(
                          `/api/notifications/flows/${flow.id}/recipients/${recipient.id}`,
                          {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ isActive: e.target.checked }),
                          },
                        )
                      }
                    />
                    Activo
                  </label>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void call(`/api/notifications/flows/recipients/${recipient.id}`, {
                        method: 'DELETE',
                      })
                    }
                    className="shrink-0 text-slate-400 hover:text-rose-600"
                    aria-label="Eliminar destinatario"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          {adding ? (
            <AddRecipientForm
              flowId={flow.id}
              permissions={permissions}
              busy={busy}
              onCancel={() => setAdding(false)}
              onSubmit={async (payload) => {
                const ok = await call(`/api/notifications/flows/${flow.id}/recipients`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload),
                });
                if (ok) setAdding(false);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="rounded-md border border-black/30 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-zinc-800 hover:text-white"
            >
              Agregar destinatario
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── formulario de alta ───────────────────────────────────────────────────────

interface AddRecipientPayload {
  recipientType: RecipientType;
  employeeId?: string;
  permissionKey?: string;
  notificationType: NotificationType;
}

interface AddRecipientFormProps {
  flowId: string;
  permissions: Permission[];
  busy: boolean;
  onCancel: () => void;
  onSubmit: (payload: AddRecipientPayload) => Promise<void>;
}

function AddRecipientForm({ permissions, busy, onCancel, onSubmit }: AddRecipientFormProps) {
  const [recipientType, setRecipientType] = useState<RecipientType>('jefe_inmediato');
  const [employee, setEmployee] = useState<EmployeePickerValue | null>(null);
  const [permissionKey, setPermissionKey] = useState('');
  const [notificationType, setNotificationType] = useState<NotificationType>('informativa');
  const [localError, setLocalError] = useState<string | null>(null);

  const selectClass =
    'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black';

  function handleSubmit() {
    if (recipientType === 'empleado' && !employee) {
      setLocalError('Selecciona un empleado.');
      return;
    }
    if (recipientType === 'permiso' && !permissionKey) {
      setLocalError('Selecciona un permiso.');
      return;
    }
    setLocalError(null);

    void onSubmit({
      recipientType,
      notificationType,
      ...(recipientType === 'empleado' && employee ? { employeeId: employee.id } : {}),
      ...(recipientType === 'permiso' ? { permissionKey } : {}),
    });
  }

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Tipo de destinatario
          </label>
          <select
            value={recipientType}
            onChange={(e) => setRecipientType(e.target.value as RecipientType)}
            className={selectClass}
          >
            {ADDABLE_TYPES.map((type) => (
              <option key={type} value={type}>
                {RECIPIENT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Tipo de notificación
          </label>
          <select
            value={notificationType}
            onChange={(e) => setNotificationType(e.target.value as NotificationType)}
            className={selectClass}
          >
            {(Object.keys(NOTIFICATION_TYPE_LABELS) as NotificationType[]).map((type) => (
              <option key={type} value={type}>
                {NOTIFICATION_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        {recipientType === 'empleado' && (
          <div className="md:col-span-2">
            <EmployeePicker label="Empleado" value={employee} onSelect={setEmployee} />
          </div>
        )}

        {recipientType === 'permiso' && (
          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Permiso
            </label>
            <select
              value={permissionKey}
              onChange={(e) => setPermissionKey(e.target.value)}
              className={selectClass}
            >
              <option value="">Selecciona un permiso…</option>
              {permissions.map((p) => {
                const key = `${p.section}.${p.module}.${p.action}`;
                return (
                  <option key={p.id} value={key}>
                    {key}
                    {p.description ? ` — ${p.description}` : ''}
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </div>

      {localError && <p className="mt-2 text-xs text-rose-600">{localError}</p>}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={handleSubmit}
          className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
        >
          Guardar
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
