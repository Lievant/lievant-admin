'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CatalogItem } from '@/lib/api';
import { CloseIcon } from '@/components/icons';
import { TextField } from '../form-field';

export function UploadDocumentDialog({
  clientId,
  documentTypes,
  onClose,
}: {
  clientId: string;
  documentTypes: CatalogItem[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [documentType, setDocumentType] = useState<string>(documentTypes[0]?.name ?? '');
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
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', documentType);
      if (version !== '') formData.append('version', version);

      try {
        const res = await fetch(`/api/clients/${clientId}/documents`, {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
          const message = body?.message
            ? Array.isArray(body.message)
              ? body.message.join(', ')
              : body.message
            : 'No se pudo cargar el documento.';
          setError(message);
          return;
        }

        router.refresh();
        onClose();
      } catch {
        setError('No se pudo cargar el documento.');
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
                className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
              >
                {documentTypes.map((dt) => (
                  <option key={dt.id} value={dt.name}>
                    {dt.name}
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
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.webp,.svg"
              onChange={handleFileChange}
              className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-600 hover:file:bg-slate-200"
            />
            <p className="text-xs text-slate-400">
              Formatos permitidos: PDF, Word, Excel, PowerPoint, TXT e imágenes (JPG, PNG, GIF, WEBP, SVG) · Máximo 20
              MB
            </p>
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
              {isPending ? 'Cargando…' : 'Cargar documento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
