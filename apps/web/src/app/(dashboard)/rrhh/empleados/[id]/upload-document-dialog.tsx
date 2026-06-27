'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CatalogItem } from '@/lib/api';
import { CloseIcon } from '@/components/icons';

export function UploadEmployeeDocumentDialog({
  employeeId,
  onClose,
}: {
  employeeId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [docTypes, setDocTypes] = useState<CatalogItem[]>([]);
  const [docType, setDocType] = useState('');
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    fetch('/api/catalogs/document-types?appliesTo=employee')
      .then((r) => r.json() as Promise<CatalogItem[]>)
      .then((items) => {
        setDocTypes(items);
        if (items[0]) setDocType(items[0].name);
      })
      .catch(() => {});
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('El nombre del documento es obligatorio.');
      return;
    }
    if (!file) {
      setError('Selecciona un archivo para cargar.');
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', docType);
      formData.append('name', name.trim());

      try {
        const res = await fetch(`/api/employees/${employeeId}/documents`, {
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
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-navy">Subir documento</h2>
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
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="emp-doc-type">
              Tipo de documento
            </label>
            <select
              id="emp-doc-type"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              disabled={docTypes.length === 0}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota disabled:opacity-50"
            >
              {docTypes.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="emp-doc-name">
              Nombre
            </label>
            <input
              id="emp-doc-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. INE vigente 2025"
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy placeholder:text-slate-400 focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="emp-doc-file">
              Archivo
            </label>
            <input
              id="emp-doc-file"
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.webp,.svg"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-600 hover:file:bg-slate-200"
            />
            <p className="text-xs text-slate-400">
              PDF, Word, Excel, PowerPoint, TXT e imágenes · Máximo 20 MB
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
              disabled={isPending || docTypes.length === 0}
              className="rounded-md bg-terracota px-4 py-2 text-sm font-semibold text-white hover:bg-terracota-dark disabled:opacity-60"
            >
              {isPending ? 'Cargando…' : 'Subir documento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
