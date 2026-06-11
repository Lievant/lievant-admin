'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { ClientStatus, CreateClientPayload, UserSummary } from '@/lib/api';
import { CLIENT_STATUSES, CLIENT_STATUS_LABELS } from '../constants';
import { TextField } from '../form-field';
import { createClientAction } from './actions';

type ClientType = 'group' | 'direct';

interface NewClientFormProps {
  accountManagers: UserSummary[];
}

export function NewClientForm({ accountManagers }: NewClientFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);

  // Paso 1
  const [type, setType] = useState<ClientType>('direct');
  const [groupName, setGroupName] = useState('');
  const [industry, setIndustry] = useState('');
  const [accountManagerId, setAccountManagerId] = useState('');
  const [status, setStatus] = useState<ClientStatus>('active');

  // Paso 2
  const [companyName, setCompanyName] = useState('');
  const [companyLegalName, setCompanyLegalName] = useState('');
  const [companyRfc, setCompanyRfc] = useState('');
  const [brandName, setBrandName] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleNext = () => {
    setError(null);
    if (type === 'group' && !groupName.trim()) {
      setError('El nombre del grupo es obligatorio para clientes tipo grupo económico.');
      return;
    }
    setStep(2);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!companyName.trim()) {
      setError('La razón social / nombre comercial de la empresa es obligatorio.');
      return;
    }

    startTransition(async () => {
      const payload: CreateClientPayload = {
        type,
        status,
        company: { name: companyName.trim() },
      };
      if (type === 'group') payload.groupName = groupName.trim();
      if (industry.trim()) payload.industry = industry.trim();
      if (accountManagerId) payload.accountManagerId = accountManagerId;
      if (companyLegalName.trim()) payload.company.legalName = companyLegalName.trim();
      if (companyRfc.trim()) payload.company.rfc = companyRfc.trim();
      if (brandName.trim()) payload.brand = { name: brandName.trim() };

      const result = await createClientAction(payload);
      if (result.success && result.id) {
        router.push(`/finanzas/clientes/${result.id}`);
      } else {
        setError(result.error ?? 'No se pudo crear el cliente.');
      }
    });
  };

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/finanzas" className="hover:text-terracota">
          Finanzas
        </Link>
        <span>/</span>
        <Link href="/finanzas/clientes" className="hover:text-terracota">
          Clientes
        </Link>
        <span>/</span>
        <span className="text-slate-600">Nuevo cliente</span>
      </nav>

      <h1 className="mt-4 text-2xl font-bold text-navy">Nuevo cliente</h1>

      {/* Step indicator */}
      <div className="mt-6 flex items-center gap-3 text-sm">
        <StepBadge number={1} active={step === 1} done={step > 1} label="Información general" />
        <div className="h-px flex-1 bg-slate-200" />
        <StepBadge number={2} active={step === 2} done={false} label="Empresa y marca" />
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {step === 1 && (
          <>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo de cliente</p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <TypeOption
                  label="Grupo económico"
                  description="Agrupa varias empresas y marcas bajo un mismo cliente."
                  active={type === 'group'}
                  onClick={() => setType('group')}
                />
                <TypeOption
                  label="Empresa directa"
                  description="Una sola empresa, sin grupo económico asociado."
                  active={type === 'direct'}
                  onClick={() => setType('direct')}
                />
              </div>
            </div>

            {type === 'group' && (
              <TextField
                id="group-name"
                label="Nombre del grupo"
                value={groupName}
                onChange={setGroupName}
                placeholder="Grupo Lievant"
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <TextField id="industry" label="Industria" value={industry} onChange={setIndustry} placeholder="Retail" />

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="account-manager">
                  Account manager
                </label>
                <select
                  id="account-manager"
                  value={accountManagerId}
                  onChange={(e) => setAccountManagerId(e.target.value)}
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
                >
                  <option value="">Sin asignar</option>
                  {accountManagers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="status">
                Estado
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ClientStatus)}
                className="w-full max-w-xs rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
              >
                {CLIENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {CLIENT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <p className="text-sm font-semibold text-navy">Primera empresa</p>
              <p className="mt-1 text-xs text-slate-400">
                {type === 'group'
                  ? 'Esta será la empresa principal del grupo. Podrás agregar más empresas después.'
                  : 'Datos de la empresa del cliente.'}
              </p>
            </div>

            <TextField
              id="company-name"
              label="Nombre comercial / razón social"
              value={companyName}
              onChange={setCompanyName}
              placeholder="Lievant Studio"
            />
            <TextField
              id="company-legal-name"
              label="Razón social completa (opcional)"
              value={companyLegalName}
              onChange={setCompanyLegalName}
              placeholder="Lievant Studio S.A. de C.V."
            />
            <TextField id="company-rfc" label="RFC (opcional)" value={companyRfc} onChange={setCompanyRfc} mono />

            <div className="border-t border-slate-100 pt-4">
              <p className="text-sm font-semibold text-navy">Primera marca (opcional)</p>
              <p className="mt-1 text-xs text-slate-400">
                Si se deja en blanco, se usará el nombre de la empresa.
              </p>
              <div className="mt-3">
                <TextField
                  id="brand-name"
                  label="Nombre de la marca"
                  value={brandName}
                  onChange={setBrandName}
                  placeholder={companyName || 'Nombre de la empresa'}
                />
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
        )}

        <div className="flex justify-between gap-2 pt-2">
          {step === 2 ? (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
            >
              Atrás
            </button>
          ) : (
            <Link
              href="/finanzas/clientes"
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
            >
              Cancelar
            </Link>
          )}

          {step === 1 ? (
            <button
              type="button"
              onClick={handleNext}
              className="rounded-md bg-terracota px-4 py-2 text-sm font-semibold text-white hover:bg-terracota-dark"
            >
              Siguiente
            </button>
          ) : (
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-terracota px-4 py-2 text-sm font-semibold text-white hover:bg-terracota-dark disabled:opacity-60"
            >
              {isPending ? 'Creando…' : 'Crear cliente'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function StepBadge({ number, active, done, label }: { number: number; active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
          active || done ? 'bg-terracota text-white' : 'bg-slate-100 text-slate-400',
        )}
      >
        {number}
      </div>
      <span className={cn('font-medium', active ? 'text-navy' : 'text-slate-400')}>{label}</span>
    </div>
  );
}

function TypeOption({
  label,
  description,
  active,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border px-4 py-3 text-left transition-colors',
        active ? 'border-terracota bg-terracota-bg' : 'border-slate-200 hover:border-slate-300',
      )}
    >
      <p className={cn('text-sm font-semibold', active ? 'text-terracota-dark' : 'text-navy')}>{label}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </button>
  );
}
