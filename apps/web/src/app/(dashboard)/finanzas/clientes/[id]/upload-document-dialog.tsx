'use client';

import { useState, useTransition } from 'react';
import type { UploadDocumentPayload } from '@/lib/api';
import { CloseIcon } from '@/components/icons';
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from '../constants';
import { addDocumentAction } from './actions';
import { TextField } from '../form-field';

export function UploadDocumentDialog({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const [documentType, setDocumentType] = useState<string>(DOCUMENT_TYPES[0]);
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError('Selecciona un archivo para cargar.');
      return;
    }

    startTransition(async () => {
      const payload: UploadDocumentPayload = { file, documentType };
      if (version !== '') payload.version = Number(version);

      const result = await addDocumentAction(clientId, payload);
      if (result.success) {
        onClose();
      } else {
        setError(result.error ?? 'No se pudo cargar el documento.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-navy">Cargar documento</h2>
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
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="doc-type">
                Tipo de documento
              </label>
              <select
                id="doc-type"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
              >
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {DOCUMENT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <TextField
              id="doc-version"
              label="Versión"
              type="number"
              value={version}
              onChange={setVersion}
              placeholder="1"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="doc-file">
              Archivo
            </label>
            <input
              id="doc-file"
              type="file"
              onChange={handleFileChange}
              className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-600 hover:file:bg-slate-200"
            />
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
              className="rounded-md bg-terracota px-4 py-2 text-sm font-semibold text-white hover:bg-terracota-dark disabled:opacity-60"
            >
              {isPending ? 'Cargando…' : 'Cargar documento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
