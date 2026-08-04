'use client';

import { useState, useTransition } from 'react';
import type { CompanyPayload } from '@/lib/api';
import { CloseIcon } from '@/components/icons';
import { addCompanyAction } from './actions';
import { TextField } from '../form-field';

export function AddCompanyDialog({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [rfc, setRfc] = useState('');
  const [industry, setIndustry] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('El nombre de la empresa es obligatorio.');
      return;
    }

    startTransition(async () => {
      const payload: CompanyPayload = { name: name.trim() };
      if (legalName.trim()) payload.legalName = legalName.trim();
      if (rfc.trim()) payload.rfc = rfc.trim();
      if (industry.trim()) payload.industry = industry.trim();

      const result = await addCompanyAction(clientId, payload);
      if (result.success) {
        onClose();
      } else {
        setError(result.error ?? 'No se pudo agregar la empresa.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-navy">Agregar empresa</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <TextField id="company-name" label="Nombre comercial" value={name} onChange={setName} placeholder="Lievant Studio" />
          <TextField
            id="company-legal-name"
            label="Razón social"
            value={legalName}
            onChange={setLegalName}
            placeholder="Lievant Studio S.A. de C.V."
          />
          <div className="grid grid-cols-2 gap-4">
            <TextField id="company-rfc" label="RFC" value={rfc} onChange={setRfc} mono />
            <TextField id="company-industry" label="Industria" value={industry} onChange={setIndustry} />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {isPending ? 'Guardando…' : 'Agregar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
