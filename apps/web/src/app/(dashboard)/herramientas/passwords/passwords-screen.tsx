'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type {
  AccountPasswordItem,
  PasswordApplication,
  PasswordTeamEmployee,
} from '@/lib/api';
import { CopyIcon, DownloadIcon, EyeIcon, EyeOffIcon, PlusIcon } from '@/components/icons';
import { StatCard } from '@/components/stat-card';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import { revokeAccountPasswordAction } from './actions';
import { PasswordDialog } from './password-dialog';
import { daysUntil, formatDate, todayIso } from './utils';

/** Cuánto tiempo queda visible una contraseña revelada. */
const REVEAL_SECONDS = 30;
const MASK = '••••••••';
const SOON_DAYS = 30;

type DisplayStatus = 'activa' | 'por_vencer' | 'vencida' | 'revocada';
type StatusFilter = 'todas' | DisplayStatus;

const STATUS_META: Record<DisplayStatus, { label: string; className: string }> = {
  activa: { label: 'Activa', className: 'bg-emerald-100 text-emerald-700' },
  por_vencer: { label: 'Por vencer', className: 'bg-amber-100 text-amber-700' },
  vencida: { label: 'Vencida', className: 'bg-rose-100 text-rose-700' },
  revocada: { label: 'Revocada', className: 'bg-slate-100 text-slate-500' },
};

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'activa', label: 'Activas' },
  { value: 'por_vencer', label: 'Por vencer' },
  { value: 'vencida', label: 'Vencidas' },
  { value: 'revocada', label: 'Revocadas' },
];

/** El API devuelve activa/vencida/revocada; "por vencer" es una lectura de la fecha. */
function displayStatus(account: AccountPasswordItem): DisplayStatus {
  if (account.status !== 'activa') return account.status;
  const days = daysUntil(account.expiryDate);
  return days !== null && days <= SOON_DAYS ? 'por_vencer' : 'activa';
}

interface PasswordsScreenProps {
  accounts: AccountPasswordItem[];
  applications: PasswordApplication[];
  team: PasswordTeamEmployee[];
  apiUnavailable: boolean;
}

export function PasswordsScreen({ accounts, applications, team, apiUnavailable }: PasswordsScreenProps) {
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [applicationFilter, setApplicationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todas');
  const [editing, setEditing] = useState<AccountPasswordItem | 'nueva' | null>(null);
  const [revoking, setRevoking] = useState<AccountPasswordItem | null>(null);
  const [notice, setNotice] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // No hay toasts en el proyecto: aviso fijo que se retira solo.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const withStatus = useMemo(
    () => accounts.map((a) => ({ account: a, status: displayStatus(a) })),
    [accounts],
  );

  const stats = useMemo(
    () => ({
      activas: withStatus.filter((r) => r.status === 'activa' || r.status === 'por_vencer').length,
      porVencer: withStatus.filter((r) => r.status === 'por_vencer').length,
      vencidas: withStatus.filter((r) => r.status === 'vencida').length,
    }),
    [withStatus],
  );

  const filtered = useMemo(
    () =>
      withStatus.filter(
        (r) =>
          (!employeeFilter || r.account.employee.id === employeeFilter) &&
          (!applicationFilter || r.account.application.id === applicationFilter) &&
          (statusFilter === 'todas' || r.status === statusFilter),
      ),
    [withStatus, employeeFilter, applicationFilter, statusFilter],
  );

  // El filtro de aplicación ofrece también las desactivadas que siguen en uso.
  const applicationOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const app of applications) map.set(app.id, app.name);
    for (const a of accounts) map.set(a.application.id, a.application.name);
    return [...map.entries()].sort((x, y) => x[1].localeCompare(y[1], 'es'));
  }, [applications, accounts]);

  function confirmRevoke() {
    if (!revoking) return;
    const target = revoking;
    startTransition(async () => {
      const res = await revokeAccountPasswordAction(target.id);
      if (res.success) {
        setRevoking(null);
        setNotice({ kind: 'info', text: `Cuenta de ${target.application.name} revocada.` });
      } else {
        setNotice({ kind: 'error', text: res.error ?? 'No se pudo revocar la cuenta.' });
      }
    });
  }

  async function exportExcel() {
    // SheetJS se carga solo al exportar: no tiene por qué entrar en el bundle.
    const XLSX = await import('xlsx');
    const hoy = todayIso();
    const encabezado = [
      ['TIC-RE-17 · Administración de Contraseñas'],
      ['Código', 'TIC-RE-17'],
      ['Versión', '01'],
      ['Fecha de emisión', formatDate(hoy)],
      ['Clasificación', 'C3 — Confidencial'],
      [],
      [
        'No.',
        'Aplicación',
        'Categoría',
        'Colaborador',
        'Área',
        'Puesto',
        'Usuario / Correo',
        'Fecha asignación',
        'Fecha vencimiento',
        'Estado',
        'Notas',
      ],
    ];
    const filas = filtered.map(({ account: a, status }) => [
      a.recordNumber,
      a.application.name,
      a.application.category ?? '',
      a.employee.fullName,
      a.employee.area ?? '',
      a.employee.position,
      a.username,
      formatDate(a.assignedDate),
      a.expiryDate ? formatDate(a.expiryDate) : 'Sin vencimiento',
      STATUS_META[status].label,
      a.notes ?? '',
    ]);
    const pie = [[], ['Contraseñas omitidas por clasificación C3']];

    const hoja = XLSX.utils.aoa_to_sheet([...encabezado, ...filas, ...pie]);
    hoja['!cols'] = [6, 24, 18, 30, 18, 24, 32, 16, 18, 12, 40].map((wch) => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, hoja, 'TIC-RE-17');
    XLSX.writeFile(wb, `TIC-RE-17-contrasenas-${hoy}.xlsx`);
  }

  const selectClass =
    'rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-black">Herramientas</p>
          <h1 className="text-2xl font-bold text-navy">Administración de Contraseñas</h1>
          <p className="mt-1 text-sm text-slate-500">TIC-RE-17 · Clasificación C3</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportExcel}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-navy transition hover:border-slate-300 disabled:opacity-50"
          >
            <DownloadIcon className="h-4 w-4" />
            Exportar Excel
          </button>
          <button
            type="button"
            onClick={() => setEditing('nueva')}
            disabled={team.length === 0}
            title={team.length === 0 ? 'No tienes colaboradores a cargo' : undefined}
            className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
          >
            <PlusIcon className="h-4 w-4" />
            Nueva cuenta
          </button>
        </div>
      </header>

      {apiUnavailable && (
        <div className="rounded-lg border border-black/30 bg-black/5 px-4 py-3 text-sm text-black">
          No se pudo conectar con la API. Intenta de nuevo en unos minutos.
        </div>
      )}

      {notice && (
        <div
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm ${
            notice.kind === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total cuentas activas" value={stats.activas} />
        <StatCard label="Por vencer" value={stats.porVencer} hint={`En los próximos ${SOON_DAYS} días`} />
        <StatCard label="Vencidas" value={stats.vencidas} />
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          aria-label="Colaborador"
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value)}
          className={selectClass}
        >
          <option value="">Todos los colaboradores</option>
          {team.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.fullName}
            </option>
          ))}
        </select>
        <select
          aria-label="Aplicación"
          value={applicationFilter}
          onChange={(e) => setApplicationFilter(e.target.value)}
          className={selectClass}
        >
          <option value="">Todas las aplicaciones</option>
          {applicationOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Estado"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className={selectClass}
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          {accounts.length === 0
            ? 'Aún no hay cuentas registradas para tu equipo.'
            : 'Ninguna cuenta coincide con los filtros.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <ScrollableTable>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">No.</th>
                  <th className="px-4 py-3 text-left">Aplicación</th>
                  <th className="px-4 py-3 text-left">Colaborador</th>
                  <th className="px-4 py-3 text-left">Área</th>
                  <th className="px-4 py-3 text-left">Usuario / Correo</th>
                  <th className="px-4 py-3 text-left">Contraseña</th>
                  <th className="px-4 py-3 text-left">Asignación</th>
                  <th className="px-4 py-3 text-left">Vencimiento</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(({ account: a, status }) => (
                  <tr key={a.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-mono text-slate-500">{a.recordNumber}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-navy">{a.application.name}</p>
                      {a.application.category && (
                        <p className="text-xs text-slate-400">{a.application.category}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700">{a.employee.fullName}</p>
                      <p className="text-xs text-slate-400">{a.employee.position}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{a.employee.area ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{a.username}</td>
                    <td className="px-4 py-3">
                      {status === 'revocada' ? (
                        <span className="font-mono text-slate-300">{MASK}</span>
                      ) : (
                        <PasswordCell
                          accountId={a.id}
                          onNotice={(kind, text) => setNotice({ kind, text })}
                        />
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatDate(a.assignedDate)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {a.expiryDate ? formatDate(a.expiryDate) : 'Sin vencimiento'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_META[status].className}`}
                      >
                        {STATUS_META[status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {status !== 'revocada' && (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditing(a)}
                            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-slate-300"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => setRevoking(a)}
                            className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:border-red-300"
                          >
                            Revocar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        </div>
      )}

      {editing && (
        <PasswordDialog
          account={editing === 'nueva' ? null : editing}
          applications={applications}
          team={team}
          onClose={() => setEditing(null)}
          onSaved={(text) => {
            setEditing(null);
            setNotice({ kind: 'info', text });
          }}
        />
      )}

      {revoking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-navy">¿Revocar esta cuenta?</h3>
            <p className="mt-2 text-sm text-slate-600">
              {revoking.application.name} de {revoking.employee.fullName} ({revoking.username}). La
              contraseña dejará de poder consultarse. Recuerda cambiarla también en la aplicación.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRevoking(null)}
                disabled={isPending}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmRevoke}
                disabled={isPending}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? 'Revocando…' : 'Sí, revocar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Contraseña enmascarada con ojito y copiar. Cada acción pide la contraseña al
 * API (queda en la bitácora); nada se guarda más allá de los 30 segundos de
 * visibilidad.
 */
function PasswordCell({
  accountId,
  onNotice,
}: {
  accountId: string;
  onNotice: (kind: 'info' | 'error', text: string) => void;
}) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function fetchPassword(action: 'ver' | 'copiar'): Promise<string | null> {
    setLoading(true);
    try {
      const res = await fetch(`/api/passwords/${accountId}/reveal?action=${action}`, {
        cache: 'no-store',
      });
      const body = (await res.json().catch(() => null)) as
        | { password?: string; message?: string | string[] }
        | null;
      if (!res.ok || !body?.password) {
        const msg = Array.isArray(body?.message) ? body.message[0] : body?.message;
        onNotice('error', msg ?? 'No se pudo obtener la contraseña.');
        return null;
      }
      return body.password;
    } catch {
      onNotice('error', 'No se pudo obtener la contraseña.');
      return null;
    } finally {
      setLoading(false);
    }
  }

  function hide() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setRevealed(null);
  }

  async function toggle() {
    if (revealed !== null) {
      hide();
      return;
    }
    const password = await fetchPassword('ver');
    if (password === null) return;
    setRevealed(password);
    onNotice('info', `La contraseña se ocultará en ${REVEAL_SECONDS} segundos.`);
    timer.current = setTimeout(hide, REVEAL_SECONDS * 1000);
  }

  async function copy() {
    const password = revealed ?? (await fetchPassword('copiar'));
    if (password === null) return;
    try {
      await navigator.clipboard.writeText(password);
      onNotice('info', 'Contraseña copiada al portapapeles.');
    } catch {
      onNotice('error', 'El navegador no permitió copiar al portapapeles.');
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className={`min-w-[6rem] font-mono ${revealed ? 'text-navy' : 'text-slate-500'}`}>
        {revealed ?? MASK}
      </span>
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        aria-label={revealed ? 'Ocultar contraseña' : 'Ver contraseña'}
        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
      >
        {revealed ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
      </button>
      <button
        type="button"
        onClick={copy}
        disabled={loading}
        aria-label="Copiar contraseña"
        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
      >
        <CopyIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
