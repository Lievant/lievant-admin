'use client';

import { useMemo, useState, useTransition } from 'react';
import type { AccountPasswordItem, PasswordApplication, PasswordVisiblePerson } from '@/lib/api';
import { AlertIcon, EyeIcon, EyeOffIcon, KeyIcon, PlusIcon } from '@/components/icons';
import { createAccountPasswordAction, updateAccountPasswordAction } from './actions';
import { buildAccountPayload, resolveOwnerId, validateAccountForm } from './account-form';
import { PersonSelect } from './person-select';
import { generatePassword, isValidEmail, passwordStrength, todayIso, type PasswordStrength } from './utils';

const STRENGTH_META: Record<PasswordStrength, { label: string; bar: string; text: string; width: string }> = {
  debil: { label: 'Débil', bar: 'bg-rose-500', text: 'text-rose-600', width: 'w-1/3' },
  media: { label: 'Media', bar: 'bg-amber-500', text: 'text-amber-600', width: 'w-2/3' },
  fuerte: { label: 'Fuerte', bar: 'bg-emerald-500', text: 'text-emerald-600', width: 'w-full' },
};

const fieldClass =
  'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black';
const labelClass = 'text-xs font-semibold uppercase tracking-wide text-slate-500';

interface PasswordDialogProps {
  account: AccountPasswordItem | null;
  applications: PasswordApplication[];
  /** La propia persona y sus subordinados directos activos. */
  people: PasswordVisiblePerson[];
  /** Titular preseleccionado al crear: la persona elegida en el selector de la pantalla. */
  defaultEmployeeId: string;
  /** Agregar aplicaciones al catálogo exige el permiso de escritura del catálogo. */
  canAddApplication?: boolean;
  onClose: () => void;
  /** `warnings`: sugerencias sobre la contraseña guardada (reutilizada, débil); no bloquean. */
  onSaved: (message: string, warnings: string[]) => void;
}

export function PasswordDialog({
  account,
  applications,
  people,
  defaultEmployeeId,
  canAddApplication = false,
  onClose,
  onSaved,
}: PasswordDialogProps) {
  const isEdit = account !== null;
  const [apps, setApps] = useState<PasswordApplication[]>(applications);
  const [applicationId, setApplicationId] = useState(account?.application.id ?? '');
  const [employeeId, setEmployeeId] = useState(account?.employee.id ?? defaultEmployeeId);
  const [username, setUsername] = useState(account?.username ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [assignedDate, setAssignedDate] = useState(account?.assignedDate ?? todayIso());
  const [expiryDate, setExpiryDate] = useState(account?.expiryDate ?? '');
  const [notes, setNotes] = useState(account?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Solo hay que elegir titular al crear y si hay más de una persona a la vista
  // (un jefe con subordinados). Sin subordinados la cuenta es de quien la crea; al
  // editar, el titular no cambia.
  const chooseOwner = !isEdit && people.length > 1;
  // Al editar, la aplicación actual puede ya no estar en la lista (desactivada);
  // se agrega para no perderla.
  const appOptions = useMemo(() => {
    if (!account || apps.some((a) => a.id === account.application.id)) return apps;
    return [
      ...apps,
      { id: account.application.id, name: account.application.name, category: account.application.category, isActive: false, sortOrder: 999 },
    ];
  }, [apps, account]);

  const strength = password ? passwordStrength(password) : null;

  function handleSave() {
    const form = { isEdit, applicationId, employeeId, people, username, password, assignedDate, expiryDate, notes };
    const problem = validateAccountForm(form);
    if (problem) return setError(problem);
    setError(null);

    const payload = buildAccountPayload(form);

    startTransition(async () => {
      // El titular solo viaja al crear; al editar no se cambia.
      const res = isEdit
        ? await updateAccountPasswordAction(account.id, payload)
        : await createAccountPasswordAction({ ...payload, employeeId: resolveOwnerId(people, employeeId) });
      if (res.success) onSaved(isEdit ? 'Cuenta actualizada.' : 'Cuenta registrada.', res.data?.warnings ?? []);
      else setError(res.error ?? 'No se pudo guardar la cuenta.');
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-navy">{isEdit ? 'Editar cuenta' : 'Nueva cuenta'}</h3>

        <div className="mt-4 space-y-5">
          <Section title="Aplicación">
            <ApplicationCombobox
              applications={appOptions}
              value={applicationId}
              onChange={setApplicationId}
              canAdd={canAddApplication}
              onCreated={(app) => {
                setApps((prev) => [...prev, app]);
                setApplicationId(app.id);
              }}
            />
          </Section>

          {chooseOwner && (
            <Section title="Colaborador">
              <PersonSelect
                people={people}
                value={resolveOwnerId(people, employeeId)}
                onChange={setEmployeeId}
                disabled={isPending}
              />
            </Section>
          )}
          {isEdit && (
            <p className="text-xs text-slate-500">
              Titular de la cuenta: <span className="font-medium text-navy">{account.employee.fullName}</span>
            </p>
          )}

          <Section title="Credenciales">
            <div className="flex flex-col gap-1">
              <label className={labelClass} htmlFor="pw-username">
                Usuario / Correo
              </label>
              <input
                id="pw-username"
                type="email"
                autoComplete="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="cuenta@cliente.com"
                className={fieldClass}
              />
              {username && !isValidEmail(username) && (
                <p className="text-xs text-rose-600">Formato de correo no válido.</p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className={labelClass} htmlFor="pw-password">
                Contraseña
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    id="pw-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isEdit ? 'Déjala vacía para conservar la actual' : ''}
                    className={`${fieldClass} pr-9 font-mono`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPassword(generatePassword());
                    setShowPassword(true);
                  }}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-xs font-semibold text-navy hover:border-slate-300"
                >
                  <KeyIcon className="h-4 w-4" />
                  Generar contraseña segura
                </button>
              </div>
              {strength && (
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full ${STRENGTH_META[strength].bar} ${STRENGTH_META[strength].width}`} />
                  </div>
                  <span className={`text-xs font-semibold ${STRENGTH_META[strength].text}`}>
                    {STRENGTH_META[strength].label}
                  </span>
                </div>
              )}
            </div>
          </Section>

          <Section title="Vigencia">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className={labelClass} htmlFor="pw-assigned">
                  Fecha de asignación
                </label>
                <input
                  id="pw-assigned"
                  type="date"
                  value={assignedDate}
                  onChange={(e) => setAssignedDate(e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelClass} htmlFor="pw-expiry">
                  Fecha de vencimiento
                </label>
                <input
                  id="pw-expiry"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className={fieldClass}
                />
              </div>
            </div>
            {expiryDate && (
              <p className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700">
                <AlertIcon className="h-3.5 w-3.5" />
                Se notificará al líder 3 días antes del vencimiento
              </p>
            )}
          </Section>

          <Section title="Notas">
            <textarea
              aria-label="Notas"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={fieldClass}
            />
          </Section>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-xs font-medium text-rose-600">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded-md bg-black px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="border-b border-slate-100 pb-1 text-sm font-semibold text-navy">{title}</h4>
      {children}
    </section>
  );
}

const OTHER_APP = 'otra';
const APP_NAME_MAX = 100;

function errorMessage(body: unknown, fallback: string): string {
  const message = (body as { message?: string | string[] } | null)?.message;
  if (Array.isArray(message)) return message[0] ?? fallback;
  return message || fallback;
}

/**
 * Autocompletado sobre el catálogo. Elegir «Otra» (o «Agregar aplicación»)
 * abre un campo para darla de alta: se crea en el catálogo y queda elegida.
 * Si el nombre ya existe se ofrece usar la existente.
 */
function ApplicationCombobox({
  applications,
  value,
  onChange,
  canAdd,
  onCreated,
}: {
  applications: PasswordApplication[];
  value: string;
  onChange: (id: string) => void;
  canAdd: boolean;
  onCreated: (app: PasswordApplication) => void;
}) {
  const selected = applications.find((a) => a.id === value) ?? null;
  const [query, setQuery] = useState(selected?.name ?? '');
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? applications.filter((a) => a.name.toLowerCase().includes(q)) : applications;
    return list.slice(0, 50);
  }, [applications, query]);

  const trimmed = newName.trim();
  // «Otra» no cuenta como existente: es justo lo que se quiere reemplazar.
  const existing = trimmed
    ? applications.find(
        (a) => a.name.toLowerCase() !== OTHER_APP && a.name.toLowerCase() === trimmed.toLowerCase(),
      )
    : undefined;

  function pick(app: PasswordApplication) {
    onChange(app.id);
    setQuery(app.name);
    setOpen(false);
    const isOther = app.name.trim().toLowerCase() === OTHER_APP;
    setAdding(isOther);
    setAddError(null);
    if (isOther) setNewName('');
  }

  async function create() {
    if (!trimmed) return setAddError('Escribe el nombre de la aplicación.');
    if (existing) return;
    setSaving(true);
    setAddError(null);
    try {
      const res = await fetch('/api/passwords/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const body = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        setAddError(
          res.status === 403
            ? 'No tienes permiso para agregar aplicaciones al catálogo.'
            : errorMessage(body, 'No se pudo crear la aplicación.'),
        );
        return;
      }
      const app = body as PasswordApplication;
      onCreated(app);
      setQuery(app.name);
      setAdding(false);
      setNewName('');
    } catch {
      setAddError('No se pudo crear la aplicación.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          type="text"
          aria-label="Aplicación"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (value) onChange('');
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Buscar aplicación…"
          className={fieldClass}
        />
        {open && matches.length > 0 && (
          <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
            {matches.map((app) => (
              <li
                key={app.id}
                onMouseDown={() => pick(app)}
                className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-slate-50"
              >
                <span className="text-navy">{app.name}</span>
                {app.category && <span className="text-xs text-slate-400">{app.category}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {adding && canAdd && (
        <div className="space-y-1.5 rounded-md border border-slate-200 bg-slate-50 p-3">
          <label className={labelClass} htmlFor="pw-new-app">
            Nombre de la aplicación
          </label>
          <div className="flex gap-2">
            <input
              id="pw-new-app"
              type="text"
              autoFocus
              required
              maxLength={APP_NAME_MAX}
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setAddError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void create();
                }
              }}
              placeholder="Ej. Miro"
              className={`${fieldClass} bg-white`}
            />
            <button
              type="button"
              onClick={() => void create()}
              disabled={saving || !trimmed || !!existing}
              className="shrink-0 rounded-md bg-black px-3 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {saving ? 'Agregando…' : 'Usar esta aplicación'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setAddError(null);
              }}
              className="shrink-0 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
          {existing && (
            <p className="text-xs text-amber-700">
              «{existing.name}» ya está en la lista.{' '}
              <button type="button" onClick={() => pick(existing)} className="font-semibold underline">
                Usar «{existing.name}»
              </button>
            </p>
          )}
          {addError && <p className="text-xs text-rose-600">{addError}</p>}
        </div>
      )}
      {adding && !canAdd && (
        <p className="text-xs text-slate-500">
          Puedes guardar la cuenta con «Otra». Para agregar la aplicación al catálogo, pídeselo a TI.
        </p>
      )}
      {!adding && canAdd && (
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setNewName(selected ? '' : query.trim().slice(0, APP_NAME_MAX));
          }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-black hover:underline"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Agregar aplicación
        </button>
      )}
    </div>
  );
}
