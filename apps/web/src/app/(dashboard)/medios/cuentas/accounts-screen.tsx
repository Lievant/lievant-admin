'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  AccountPacingRow,
  CreateMediaAccountPayload,
  ErrorKind,
  MediaCredential,
  MediaPlatform,
} from '@/lib/api';
import { NoPermissions } from '@/components/ui/no-permissions';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import { PlusIcon, SearchIcon } from '@/components/icons';
import { useCurrentUser } from '@/components/user-provider';
import { EmployeePicker, type EmployeePickerValue } from '@/app/(dashboard)/rrhh/empleados/employee-picker';
import { formatMoney, formatPct, STATUS_OPTIONS, StatusBadge } from '../constants';
import { createMediaAccountAction } from './actions';
import { ClientPicker, type ClientPickerValue } from './client-picker';

const CREDENTIAL_TYPE_LABELS: Record<string, string> = {
  system_token: 'System Token',
  oauth2: 'OAuth 2.0',
  oauth1a: 'OAuth 1.0a',
  developer_token: 'Developer Token',
};

interface Props {
  accounts: AccountPacingRow[];
  platforms: MediaPlatform[];
  errorKind: ErrorKind | null;
  filters: { platform: string; status: string; search: string };
}

export function AccountsScreen({ accounts, platforms, errorKind, filters }: Props) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const canWrite =
    (currentUser?.roles?.some((r) => r.name === 'SUPER_ADMIN') ?? false) ||
    (currentUser?.permissions?.some(
      (p) => p.section === 'medios' && p.module === 'cuentas' && p.action === 'write',
    ) ??
      false);
  const [search, setSearch] = useState(filters.search);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== filters.search) updateParams({ search: search || undefined });
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function updateParams(patch: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = { ...filters, ...patch };
    if (merged.platform) params.set('platform', merged.platform);
    if (merged.status) params.set('status', merged.status);
    if (merged.search) params.set('search', merged.search);
    const qs = params.toString();
    router.push(`/medios/cuentas${qs ? `?${qs}` : ''}`);
  }

  if (errorKind === 'forbidden') return <NoPermissions />;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-black">Medios</p>
          <h1 className="mt-1 text-3xl font-bold text-navy">Cuentas publicitarias</h1>
          <p className="mt-1 text-sm text-slate-500">{accounts.length} cuentas registradas</p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            <PlusIcon className="h-4 w-4" />
            Nueva cuenta
          </button>
        )}
      </header>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cuenta o cliente..."
            className="w-64 rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-black focus:outline-none"
          />
        </div>
        <select
          value={filters.platform}
          onChange={(e) => updateParams({ platform: e.target.value || undefined })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
        >
          <option value="">Plataforma: Todas</option>
          {platforms.map((p) => (
            <option key={p.id} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(e) => updateParams({ status: e.target.value || undefined })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <ScrollableTable>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Plataforma</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Cuenta</th>
                <th className="px-4 py-3 text-right">Presupuesto</th>
                <th className="px-4 py-3 text-right">Gasto</th>
                <th className="px-4 py-3 text-right">% Consumido</th>
                <th className="px-4 py-3">AM</th>
                <th className="px-4 py-3">Semáforo</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    No hay cuentas con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                accounts.map((r) => (
                  <tr
                    key={r.accountId}
                    onClick={() => router.push(`/medios/cuentas/${r.accountId}`)}
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 text-slate-700">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: r.platform.color ?? '#94a3b8' }}
                        />
                        {r.platform.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-navy">{r.client?.name ?? 'Sin cliente'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.nativeAccountName ?? r.nativeAccountId}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {formatMoney(r.budgetAmount, r.currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {formatMoney(r.spendAccumulated, r.currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatPct(r.pctConsumed)}</td>
                    <td className="px-4 py-3 text-slate-600">{r.accountManager?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollableTable>
      </div>

      {showCreate && (
        <CreateAccountModal
          platforms={platforms}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function CreateAccountModal({
  platforms,
  onClose,
  onCreated,
}: {
  platforms: MediaPlatform[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [platformId, setPlatformId] = useState(platforms[0]?.id ?? '');
  const [nativeAccountId, setNativeAccountId] = useState('');
  const [nativeAccountName, setNativeAccountName] = useState('');
  const [currency, setCurrency] = useState('MXN');
  const [client, setClient] = useState<ClientPickerValue | null>(null);
  const [manager, setManager] = useState<EmployeePickerValue | null>(null);
  const [credentialId, setCredentialId] = useState('');
  const [credentials, setCredentials] = useState<MediaCredential[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPlatform = platforms.find((p) => p.id === platformId);
  const nativeIdPlaceholder =
    selectedPlatform?.slug === 'google'
      ? '123-456-7890'
      : selectedPlatform?.slug === 'meta'
        ? 'act_1234567890'
        : 'ID de la cuenta en la plataforma';

  // Cargar credenciales de la plataforma seleccionada
  useEffect(() => {
    if (!platformId) {
      setCredentials([]);
      return;
    }
    let active = true;
    setCredentialId('');
    fetch(`/api/media/credentials?platformId=${platformId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: MediaCredential[]) => {
        if (active) setCredentials(Array.isArray(data) ? data.filter((c) => c.status === 'active') : []);
      })
      .catch(() => {
        if (active) setCredentials([]);
      });
    return () => {
      active = false;
    };
  }, [platformId]);

  async function handleSubmit() {
    if (!platformId || !nativeAccountId.trim()) {
      setError('Plataforma e ID nativo son obligatorios.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const payload: CreateMediaAccountPayload = {
      platformId,
      nativeAccountId: nativeAccountId.trim(),
      currency,
    };
    if (nativeAccountName.trim()) payload.nativeAccountName = nativeAccountName.trim();
    if (client) payload.clientRecordId = client.id;
    if (manager) payload.accountManagerId = manager.id;
    if (credentialId) payload.credentialId = credentialId;
    const res = await createMediaAccountAction(payload);
    setSubmitting(false);
    if (res.success) onCreated();
    else setError(res.error ?? 'Error al crear la cuenta.');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-navy">Nueva cuenta publicitaria</h2>
        <div className="space-y-3">
          <Field label="Plataforma">
            <select
              value={platformId}
              onChange={(e) => setPlatformId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {platforms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>

          <ClientPicker label="Cliente" value={client} onSelect={setClient} id="mc-client" />

          <EmployeePicker
            label="Account Manager"
            value={manager}
            onSelect={setManager}
            id="mc-manager"
          />

          <Field label="Credencial de API">
            <select
              value={credentialId}
              onChange={(e) => setCredentialId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— Sin credencial —</option>
              {credentials.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({CREDENTIAL_TYPE_LABELS[c.credentialType] ?? c.credentialType})
                </option>
              ))}
            </select>
            {credentials.length === 0 && (
              <p className="mt-1 text-xs text-slate-400">
                No hay credenciales activas para esta plataforma. Regístralas en Configuración → Credenciales de API.
              </p>
            )}
          </Field>

          <Field label="Cuenta publicitaria nativa (ID)">
            <input
              value={nativeAccountId}
              onChange={(e) => setNativeAccountId(e.target.value)}
              placeholder={nativeIdPlaceholder}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Nombre de la cuenta">
            <input
              value={nativeAccountName}
              onChange={(e) => setNativeAccountName(e.target.value)}
              placeholder="Lievant — Meta principal"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Moneda">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full max-w-[10rem] rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
            </select>
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {submitting ? 'Guardando...' : 'Crear cuenta'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
