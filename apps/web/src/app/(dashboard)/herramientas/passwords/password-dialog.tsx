'use client';

import { useMemo, useState, useTransition } from 'react';
import type { AccountPasswordItem, PasswordApplication, PasswordTeamEmployee } from '@/lib/api';
import { AlertIcon, EyeIcon, EyeOffIcon, KeyIcon, PlusIcon } from '@/components/icons';
import {
  createAccountPasswordAction,
  createPasswordApplicationAction,
  updateAccountPasswordAction,
} from './actions';
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
  team: PasswordTeamEmployee[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function PasswordDialog({ account, applications, team, onClose, onSaved }: PasswordDialogProps) {
  const isEdit = account !== null;
  const [apps, setApps] = useState<PasswordApplication[]>(applications);
  const [applicationId, setApplicationId] = useState(account?.application.id ?? '');
  const [employeeId, setEmployeeId] = useState(account?.employee.id ?? '');
  const [username, setUsername] = useState(account?.username ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [assignedDate, setAssignedDate] = useState(account?.assignedDate ?? todayIso());
  const [expiryDate, setExpiryDate] = useState(account?.expiryDate ?? '');
  const [notes, setNotes] = useState(account?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Al editar, el colaborador y la aplicación actuales pueden ya no estar en
  // las listas (cambió de jefe, app desactivada); se agregan para no perderlos.
  const teamOptions = useMemo(() => {
    if (!account || team.some((e) => e.id === account.employee.id)) return team;
    return [
      ...team,
      { id: account.employee.id, fullName: account.employee.fullName, position: account.employee.position, area: account.employee.area, corporateEmail: null },
    ];
  }, [team, account]);
  const appOptions = useMemo(() => {
    if (!account || apps.some((a) => a.id === account.application.id)) return apps;
    return [
      ...apps,
      { id: account.application.id, name: account.application.name, category: account.application.category, isActive: false, sortOrder: 999 },
    ];
  }, [apps, account]);

  const strength = password ? passwordStrength(password) : null;

  function handleSave() {
    if (!applicationId) return setError('Selecciona la aplicación.');
    if (!employeeId) return setError('Selecciona al colaborador.');
    if (!isValidEmail(username)) return setError('El usuario debe ser un correo válido.');
    if (!isEdit && !password) return setError('Escribe o genera la contraseña.');
    if (expiryDate && expiryDate < assignedDate) {
      return setError('El vencimiento no puede ser anterior a la fecha de asignación.');
    }
    setError(null);

    const payload = {
      applicationId,
      employeeId,
      username: username.trim(),
      assignedDate,
      expiryDate: expiryDate || null,
      notes: notes.trim() || null,
      ...(password ? { password } : {}),
    };

    startTransition(async () => {
      const res = isEdit
        ? await updateAccountPasswordAction(account.id, payload)
        : await createAccountPasswordAction(payload);
      if (res.success) onSaved(isEdit ? 'Cuenta actualizada.' : 'Cuenta registrada.');
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
              onCreated={(app) => {
                setApps((prev) => [...prev, app]);
                setApplicationId(app.id);
              }}
            />
          </Section>

          <Section title="Colaborador">
            <select
              aria-label="Colaborador"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className={`${fieldClass} bg-white`}
            >
              <option value="">Selecciona un colaborador…</option>
              {teamOptions.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName}
                  {emp.area ? ` · ${emp.area}` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400">Solo aparecen los colaboradores que te reportan directamente.</p>
          </Section>

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

        {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}

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

/** Autocompletado sobre el catálogo con alta inline si la aplicación no existe. */
function ApplicationCombobox({
  applications,
  value,
  onChange,
  onCreated,
}: {
  applications: PasswordApplication[];
  value: string;
  onChange: (id: string) => void;
  onCreated: (app: PasswordApplication) => void;
}) {
  const selected = applications.find((a) => a.id === value) ?? null;
  const [query, setQuery] = useState(selected?.name ?? '');
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? applications.filter((a) => a.name.toLowerCase().includes(q)) : applications;
    return list.slice(0, 50);
  }, [applications, query]);

  function pick(app: PasswordApplication) {
    onChange(app.id);
    setQuery(app.name);
    setOpen(false);
  }

  function create() {
    setAddError(null);
    startTransition(async () => {
      const res = await createPasswordApplicationAction(newName);
      if (res.success && res.data) {
        onCreated(res.data);
        setQuery(res.data.name);
        setAdding(false);
        setNewName('');
      } else {
        setAddError(res.error ?? 'No se pudo crear la aplicación.');
      }
    });
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

      {adding ? (
        <div className="flex gap-2">
          <input
            type="text"
            aria-label="Nombre de la nueva aplicación"
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                create();
              }
            }}
            placeholder="Nombre de la aplicación"
            className={fieldClass}
          />
          <button
            type="button"
            onClick={create}
            disabled={isPending}
            className="shrink-0 rounded-md bg-black px-3 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {isPending ? 'Agregando…' : 'Agregar'}
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setAddError(null);
            }}
            className="shrink-0 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setNewName(selected ? '' : query.trim());
          }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-black hover:underline"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Agregar aplicación
        </button>
      )}
      {addError && <p className="text-xs text-rose-600">{addError}</p>}
    </div>
  );
}
