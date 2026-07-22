'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type {
  AccountPacingRow,
  ErrorKind,
  MediaAuditEntry,
  MediaCredential,
  MediaPlatform,
  MediaSyncLog,
} from '@/lib/api';
import { NoPermissions } from '@/components/ui/no-permissions';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import { AlertIcon, CheckIcon, ChevronDownIcon, CloseIcon, PlusIcon, RobotIcon } from '@/components/icons';
import { useCurrentUser } from '@/components/user-provider';
import { AUDIT_ACTION_LABELS, formatDateTime } from '../constants';
import {
  createMediaCredentialAction,
  deactivateMediaCredentialAction,
  triggerMediaSyncAction,
  updateMediaCredentialAction,
} from './actions';

interface Props {
  platforms: MediaPlatform[];
  credentials: MediaCredential[];
  accounts: AccountPacingRow[];
  syncLogs: MediaSyncLog[];
  auditLog: MediaAuditEntry[];
  errorKind: ErrorKind | null;
  credentialsForbidden: boolean;
}

type TabKey = 'credenciales' | 'conexiones' | 'logs' | 'plataformas';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'credenciales', label: 'Credenciales de API' },
  { key: 'conexiones', label: 'Estado de conexiones' },
  { key: 'logs', label: 'Logs de sincronización' },
  { key: 'plataformas', label: 'Plataformas y sincronización' },
];

const PHASE_LABELS: Record<number, string> = {
  1: 'Fase 1 · MVP',
  2: 'Fase 2 · Secundaria',
  3: 'Fase 3 · Terciaria',
};

const CREDENTIAL_TYPE_LABELS: Record<string, string> = {
  system_token: 'System Token',
  oauth2: 'OAuth 2.0',
  oauth1a: 'OAuth 1.0a',
  developer_token: 'Developer Token',
};

const CREDENTIAL_TYPE_OPTIONS = [
  { value: 'system_token', label: 'System Token' },
  { value: 'oauth2', label: 'OAuth 2.0' },
  { value: 'oauth1a', label: 'OAuth 1.0a' },
  { value: 'developer_token', label: 'Developer Token' },
];

function relativeTime(iso: string | null): string {
  if (!iso) return 'Sin sincronizar';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diffMs = Date.now() - then;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'hace unos segundos';
  if (min < 60) return `hace ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days} d`;
}

export function MediaConfigScreen({
  platforms,
  credentials,
  accounts,
  syncLogs,
  auditLog,
  errorKind,
  credentialsForbidden,
}: Props) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const isSuperAdmin = currentUser?.roles?.some((r) => r.name === 'SUPER_ADMIN') ?? false;
  const [tab, setTab] = useState<TabKey>('credenciales');
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function triggerSync() {
    setMessage(null);
    startTransition(async () => {
      const res = await triggerMediaSyncAction();
      if (res.success) {
        setMessage({ ok: true, text: `Sincronización lanzada (${res.synced ?? 0} cuentas).` });
        router.refresh();
      } else {
        setMessage({ ok: false, text: res.error ?? 'Error al lanzar la sincronización.' });
      }
    });
  }

  if (errorKind === 'forbidden') return <NoPermissions />;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-terracota">Medios</p>
          <h1 className="mt-1 text-3xl font-bold text-navy">Configuración</h1>
          <p className="mt-1 text-sm text-slate-500">
            Credenciales, conexiones, logs de sincronización y plataformas.
          </p>
        </div>
        {isSuperAdmin && (
          <button
            type="button"
            onClick={triggerSync}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-light disabled:opacity-50"
          >
            <RobotIcon className="h-4 w-4" />
            {isPending ? 'Sincronizando...' : 'Sincronizar ahora'}
          </button>
        )}
      </header>

      {message && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-terracota text-terracota'
                : 'border-transparent text-slate-500 hover:text-navy'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'credenciales' && (
        <CredentialsTab
          platforms={platforms}
          credentials={credentials}
          forbidden={credentialsForbidden}
          onChanged={() => router.refresh()}
        />
      )}
      {tab === 'conexiones' && <ConnectionsTab platforms={platforms} accounts={accounts} />}
      {tab === 'logs' && <SyncLogsTab platforms={platforms} syncLogs={syncLogs} />}
      {tab === 'plataformas' && (
        <PlatformsTab platforms={platforms} auditLog={auditLog} />
      )}
    </div>
  );
}

// ─── Tab 1: Credenciales ────────────────────────────────────────────────────

function CredentialsTab({
  platforms,
  credentials,
  forbidden,
  onChanged,
}: {
  platforms: MediaPlatform[];
  credentials: MediaCredential[];
  forbidden: boolean;
  onChanged: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<MediaCredential | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (forbidden) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
        No tienes permiso para ver o gestionar credenciales de API (requiere{' '}
        <code>medios · configuracion · write</code>).
      </div>
    );
  }

  function openCreate() {
    setEditing(null);
    setShowModal(true);
  }
  function openEdit(c: MediaCredential) {
    setEditing(c);
    setShowModal(true);
  }
  function deactivate(c: MediaCredential) {
    startTransition(async () => {
      await deactivateMediaCredentialAction(c.id);
      onChanged();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-navy">Credenciales de API</h2>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-terracota px-4 py-2 text-sm font-medium text-white hover:bg-terracota-dark"
        >
          <PlusIcon className="h-4 w-4" />
          Nueva credencial
        </button>
      </div>

      {/* Instrucciones colapsables */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setShowHelp((s) => !s)}
          className="flex w-full items-center justify-between px-5 py-3 text-left text-sm font-medium text-navy"
        >
          ¿Cómo registrar una credencial?
          <ChevronDownIcon
            className={`h-4 w-4 text-slate-400 transition-transform ${showHelp ? 'rotate-180' : ''}`}
          />
        </button>
        {showHelp && (
          <div className="grid gap-6 border-t border-slate-100 px-5 py-4 md:grid-cols-2">
            <HelpBlock
              title="Meta Ads"
              steps={[
                'Ve a business.facebook.com → Configuración del negocio',
                'Usuarios del sistema → Crear usuario del sistema administrador',
                'Dale acceso a todas las cuentas publicitarias',
                'Genera un token con permisos: ads_read, ads_management',
                'Ve a AWS Secrets Manager → Crear secreto',
                'Guarda el token como valor del secreto',
                'Copia el ARN del secreto y regístralo aquí',
              ]}
            />
            <HelpBlock
              title="Google Ads"
              steps={[
                'Ve a ads.google.com → Centro de la API',
                'Solicita un token de desarrollador (si no tienes)',
                'Configura OAuth 2.0 en Google Cloud Console',
                'Obtén refresh_token con acceso al MCC',
                'Guarda en AWS Secrets Manager como JSON: {"client_id":"...","client_secret":"...","refresh_token":"...","developer_token":"..."}',
                'Copia el ARN y regístralo aquí con el MCC Account ID',
              ]}
            />
          </div>
        )}
      </div>

      {/* Lista de credenciales */}
      {credentials.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No hay credenciales registradas. Crea la primera con “Nueva credencial”.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {credentials.map((c) => (
            <CredentialCard
              key={c.id}
              credential={c}
              onEdit={() => openEdit(c)}
              onDeactivate={() => deactivate(c)}
              disabled={isPending}
            />
          ))}
        </div>
      )}

      {showModal && (
        <CredentialModal
          platforms={platforms}
          editing={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function HelpBlock({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-navy">{title}</p>
      <ol className="list-decimal space-y-1 pl-5 text-xs text-slate-600">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </div>
  );
}

function CredentialCard({
  credential: c,
  onEdit,
  onDeactivate,
  disabled,
}: {
  credential: MediaCredential;
  onEdit: () => void;
  onDeactivate: () => void;
  disabled: boolean;
}) {
  const statusBadge =
    c.status === 'active'
      ? 'bg-green-100 text-green-800'
      : c.status === 'expired'
        ? 'bg-red-100 text-red-800'
        : 'bg-gray-100 text-gray-500';
  const statusLabel = c.status === 'active' ? 'Activa' : c.status === 'expired' ? 'Expirada' : 'Inactiva';
  const expiringSoon = c.daysToExpire !== null && c.daysToExpire >= 0 && c.daysToExpire < 30;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: c.platform?.color ?? '#94a3b8' }}
            />
            <span className="text-xs font-medium text-slate-500">{c.platform?.name ?? '—'}</span>
          </div>
          <p className="mt-0.5 truncate font-semibold text-navy">{c.name}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge}`}>
          {statusLabel}
        </span>
      </div>

      <dl className="space-y-1 text-xs text-slate-500">
        <Row label="Tipo" value={CREDENTIAL_TYPE_LABELS[c.credentialType] ?? c.credentialType} />
        {c.mccAccountId && <Row label="MCC ID" value={c.mccAccountId} />}
        {c.businessAccountId && <Row label="Business ID" value={c.businessAccountId} />}
        <Row
          label="Expira"
          value={
            c.expiresAt ? (
              <span className={expiringSoon || c.isExpired ? 'font-semibold text-red-600' : ''}>
                {new Date(c.expiresAt).toLocaleDateString('es-MX', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
                {expiringSoon && !c.isExpired && ` · en ${c.daysToExpire} d`}
              </span>
            ) : (
              'Sin expiración'
            )
          }
        />
        <Row label="Última verificación" value={c.lastVerifiedAt ? formatDateTime(c.lastVerifiedAt) : 'Nunca'} />
        <Row
          label="Secret ARN"
          value={<span className="break-all font-mono text-[11px] text-slate-400">{c.secretArn}</span>}
        />
      </dl>

      <div className="mt-3 flex justify-end gap-2">
        {c.isActive && (
          <button
            type="button"
            onClick={onDeactivate}
            disabled={disabled}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
          >
            Desactivar
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-navy hover:bg-slate-50"
        >
          Editar
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0">{label}</dt>
      <dd className="min-w-0 text-right text-slate-700">{value}</dd>
    </div>
  );
}

function CredentialModal({
  platforms,
  editing,
  onClose,
  onSaved,
}: {
  platforms: MediaPlatform[];
  editing: MediaCredential | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [platformId, setPlatformId] = useState(editing?.platformId ?? platforms[0]?.id ?? '');
  const [name, setName] = useState(editing?.name ?? '');
  const [credentialType, setCredentialType] = useState(editing?.credentialType ?? 'system_token');
  const [secretArn, setSecretArn] = useState(editing?.secretArn ?? '');
  const [mccAccountId, setMccAccountId] = useState(editing?.mccAccountId ?? '');
  const [businessAccountId, setBusinessAccountId] = useState(editing?.businessAccountId ?? '');
  const [expiresAt, setExpiresAt] = useState(editing?.expiresAt ? editing.expiresAt.slice(0, 10) : '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slug = platforms.find((p) => p.id === platformId)?.slug;

  async function handleSubmit() {
    if (!platformId || !name.trim() || !secretArn.trim()) {
      setError('Plataforma, nombre y ARN son obligatorios.');
      return;
    }
    setSubmitting(true);
    setError(null);

    const optional: {
      mccAccountId?: string;
      businessAccountId?: string;
      expiresAt?: string;
      notes?: string;
    } = {};
    if (mccAccountId.trim()) optional.mccAccountId = mccAccountId.trim();
    if (businessAccountId.trim()) optional.businessAccountId = businessAccountId.trim();
    if (expiresAt) optional.expiresAt = expiresAt;
    if (notes.trim()) optional.notes = notes.trim();

    if (editing) {
      const res = await updateMediaCredentialAction(editing.id, {
        name: name.trim(),
        secretArn: secretArn.trim(),
        credentialType: credentialType as MediaCredential['credentialType'],
        ...optional,
      });
      setSubmitting(false);
      if (res.success) onSaved();
      else setError(res.error ?? 'Error al guardar.');
      return;
    }

    const res = await createMediaCredentialAction({
      platformId,
      name: name.trim(),
      secretArn: secretArn.trim(),
      credentialType: credentialType as MediaCredential['credentialType'],
      ...optional,
    });
    setSubmitting(false);
    if (res.success) onSaved();
    else setError(res.error ?? 'Error al guardar.');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-navy">
          {editing ? 'Editar credencial' : 'Nueva credencial'}
        </h2>
        <div className="space-y-3">
          <ModalField label="Plataforma">
            <select
              value={platformId}
              onChange={(e) => setPlatformId(e.target.value)}
              disabled={!!editing}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
            >
              {platforms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </ModalField>

          <ModalField label="Nombre descriptivo">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Meta Lievant Agency Token"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </ModalField>

          <ModalField label="Tipo de credencial">
            <select
              value={credentialType}
              onChange={(e) => setCredentialType(e.target.value as MediaCredential['credentialType'])}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {CREDENTIAL_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </ModalField>

          <ModalField label="ARN en AWS Secrets Manager">
            <input
              value={secretArn}
              onChange={(e) => setSecretArn(e.target.value)}
              placeholder="arn:aws:secretsmanager:us-east-1:...:secret:media/meta-token-XXXX"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
            />
            <p className="mt-1 text-xs text-amber-600">
              El token debe guardarse en AWS Secrets Manager antes de registrarlo aquí. Nunca ingreses
              el token directamente.
            </p>
          </ModalField>

          {slug === 'google' && (
            <ModalField label="MCC Account ID (Google)">
              <input
                value={mccAccountId}
                onChange={(e) => setMccAccountId(e.target.value)}
                placeholder="123-456-7890"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </ModalField>
          )}

          {slug === 'meta' && (
            <ModalField label="Business Account ID (Meta)">
              <input
                value={businessAccountId}
                onChange={(e) => setBusinessAccountId(e.target.value)}
                placeholder="1234567890"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </ModalField>
          )}

          <div className="grid grid-cols-2 gap-3">
            <ModalField label="Expiración (opcional)">
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </ModalField>
          </div>

          <ModalField label="Notas (opcional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </ModalField>

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
            className="rounded-lg bg-terracota px-4 py-2 text-sm font-medium text-white hover:bg-terracota-dark disabled:opacity-50"
          >
            {submitting ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear credencial'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

// ─── Tab 2: Estado de conexiones ────────────────────────────────────────────

function ConnectionsTab({
  platforms,
  accounts,
}: {
  platforms: MediaPlatform[];
  accounts: AccountPacingRow[];
}) {
  const activePlatforms = useMemo(
    () => platforms.filter((p) => p.isActive).sort((a, b) => a.phase - b.phase || a.name.localeCompare(b.name)),
    [platforms],
  );

  return (
    <div className="space-y-6">
      {activePlatforms.map((platform) => {
        const platformAccounts = accounts.filter((a) => a.platform.slug === platform.slug);
        return (
          <section key={platform.id}>
            <div className="mb-2 flex items-center gap-2">
              <span
                className="inline-block h-4 w-4 rounded-full"
                style={{ backgroundColor: platform.color ?? '#94a3b8' }}
              />
              <h3 className="text-base font-semibold text-navy">{platform.name}</h3>
              <span className="text-xs text-slate-400">{PHASE_LABELS[platform.phase] ?? ''}</span>
            </div>

            {platformAccounts.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">
                Sin cuentas registradas para esta plataforma.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {platformAccounts.map((a) => (
                  <ConnectionCard key={a.accountId} account={a} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function ConnectionCard({ account: a }: { account: AccountPacingRow }) {
  const syncState: { icon: string; label: string; className: string } = a.lastSyncError
    ? { icon: '❌', label: 'Error', className: 'text-red-600' }
    : a.lastSyncedAt
      ? { icon: '✅', label: 'OK', className: 'text-emerald-600' }
      : { icon: '⚪', label: 'Sin sincronizar', className: 'text-slate-400' };

  return (
    <Link
      href={`/medios/cuentas/${a.accountId}`}
      className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-navy">
            {a.nativeAccountName ?? a.nativeAccountId}
          </p>
          <p className="truncate text-xs text-slate-400">{a.nativeAccountId}</p>
        </div>
        <span className={`shrink-0 text-xs font-medium ${syncState.className}`}>
          {syncState.icon} {syncState.label}
        </span>
      </div>
      <p className="text-xs text-slate-500">{a.client?.name ?? 'Sin cliente'}</p>
      <p className="mt-1 text-xs text-slate-400">Sync: {relativeTime(a.lastSyncedAt)}</p>
      {a.lastSyncError && (
        <p className="mt-1 truncate text-xs text-red-500" title={a.lastSyncError}>
          {a.lastSyncError}
        </p>
      )}
      {a.budgetAmount === null && (
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
          <AlertIcon className="h-3 w-3" />
          Sin presupuesto
        </span>
      )}
    </Link>
  );
}

// ─── Tab 3: Logs de sincronización ──────────────────────────────────────────

function SyncLogsTab({
  platforms,
  syncLogs,
}: {
  platforms: MediaPlatform[];
  syncLogs: MediaSyncLog[];
}) {
  const [platformSlug, setPlatformSlug] = useState('');
  const [status, setStatus] = useState('');

  const filtered = syncLogs.filter(
    (l) =>
      (!platformSlug || l.platformSlug === platformSlug) && (!status || l.status === status),
  );
  const errorCount = syncLogs.filter((l) => l.status === 'error').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={platformSlug}
            onChange={(e) => setPlatformSlug(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-terracota focus:outline-none"
          >
            <option value="">Plataforma: Todas</option>
            {platforms.map((p) => (
              <option key={p.id} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-terracota focus:outline-none"
          >
            <option value="">Estado: Todos</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
            <option value="running">Running</option>
            <option value="partial">Partial</option>
          </select>
        </div>
        {errorCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
            {errorCount} error{errorCount === 1 ? '' : 'es'} reciente{errorCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <ScrollableTable>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Plataforma</th>
                <th className="px-4 py-3">Cuenta</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Inicio</th>
                <th className="px-4 py-3 text-right">Duración</th>
                <th className="px-4 py-3 text-right">Registros</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Error</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    Sin logs de sincronización.
                  </td>
                </tr>
              ) : (
                filtered.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 text-slate-600">{l.platform ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{l.accountName ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{l.syncType}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{formatDateTime(l.startedAt)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {l.durationMs !== null ? `${(l.durationMs / 1000).toFixed(1)}s` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">{l.recordsFetched}</td>
                    <td className="px-4 py-3">
                      <SyncStatusBadge status={l.status} />
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate text-xs text-red-500" title={l.errorMessage ?? ''}>
                      {l.errorMessage ?? ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollableTable>
      </div>
    </div>
  );
}

function SyncStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    success: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
    running: 'bg-blue-100 text-blue-800',
    partial: 'bg-yellow-100 text-yellow-800',
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

// ─── Tab 4: Plataformas y sincronización ────────────────────────────────────

function PlatformsTab({
  platforms,
  auditLog,
}: {
  platforms: MediaPlatform[];
  auditLog: MediaAuditEntry[];
}) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-navy">Plataformas publicitarias</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {platforms.map((p) => (
            <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold text-navy">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: p.color ?? '#94a3b8' }}
                  />
                  {p.name}
                </span>
                {p.isActive ? (
                  <CheckIcon className="h-4 w-4 text-emerald-500" />
                ) : (
                  <CloseIcon className="h-4 w-4 text-slate-300" />
                )}
              </div>
              <p className="text-xs text-slate-400">{PHASE_LABELS[p.phase] ?? `Fase ${p.phase}`}</p>
              <dl className="mt-2 space-y-0.5 text-xs text-slate-500">
                <div className="flex justify-between">
                  <dt>Latencia</dt>
                  <dd>{p.dataLatencyHours} h</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Pausa vía API</dt>
                  <dd>{p.supportsPause ? 'Sí' : 'No'}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-navy">Bitácora de acciones</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <ScrollableTable>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Acción</th>
                  <th className="px-4 py-3">Motivo</th>
                  <th className="px-4 py-3 text-center">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                      Sin registros en la bitácora.
                    </td>
                  </tr>
                ) : (
                  auditLog.map((l) => (
                    <tr key={l.id} className="border-b border-slate-100">
                      <td className="px-4 py-3 text-xs text-slate-400">{formatDateTime(l.createdAt)}</td>
                      <td className="px-4 py-3 font-medium text-navy">
                        {AUDIT_ACTION_LABELS[l.actionType] ?? l.actionType}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{l.reason ?? '—'}</td>
                      <td className="px-4 py-3 text-center">
                        {l.success === false ? (
                          <span className="text-red-500" title={l.errorMessage ?? ''}>
                            Error
                          </span>
                        ) : l.success === true ? (
                          <span className="text-emerald-500">OK</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollableTable>
        </div>
      </section>
    </div>
  );
}
