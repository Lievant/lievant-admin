'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/utils';
import type { CatalogItem, ClientDetail, ClientDocumentSummary } from '@/lib/api';
import { AlertIcon, CheckIcon, ClockIcon, CloseIcon, DownloadIcon, EyeIcon, PlusIcon } from '@/components/icons';
import { DOCUMENT_STATUS_BADGE_STYLES, DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS } from '../constants';
import { removeDocumentAction } from './actions';
import { UploadDocumentDialog } from './upload-document-dialog';

function StatusIcon({ status, className }: { status: ClientDocumentSummary['status']; className?: string }) {
  if (status === 'uploaded') return <CheckIcon className={className} />;
  if (status === 'pending') return <ClockIcon className={className} />;
  return <AlertIcon className={className} />;
}

export function DocumentsTab({
  client,
  documents,
  documentTypes,
}: {
  client: ClientDetail;
  documents: ClientDocumentSummary[];
  documentTypes: CatalogItem[];
}) {
  const [isUploadOpen, setUploadOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleRemove(docId: string) {
    setError(null);
    setPendingId(docId);
    startTransition(async () => {
      const result = await removeDocumentAction(client.id, docId);
      if (!result.success) {
        setError(result.error ?? 'No se pudo eliminar el documento.');
      }
      setPendingId(null);
    });
  }

  return (
    <div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          <PlusIcon className="h-4 w-4" />
          Cargar documento
        </button>
      </div>

      {error && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Cerrar">
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Archivo</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Versión</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                  No hay documentos registrados.
                </td>
              </tr>
            )}
            {documents.map((doc) => (
              <tr key={doc.id} className="border-b border-slate-100 last:border-none">
                <td className="px-4 py-3 text-slate-600">{DOCUMENT_TYPE_LABELS[doc.documentType] ?? doc.documentType}</td>
                <td className="px-4 py-3 font-medium text-navy">{doc.fileName}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold',
                      DOCUMENT_STATUS_BADGE_STYLES[doc.status],
                    )}
                  >
                    <StatusIcon status={doc.status} className="h-3.5 w-3.5" />
                    {DOCUMENT_STATUS_LABELS[doc.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">v{doc.version}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {doc.downloadUrl ? (
                      <>
                        <a
                          href={doc.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="Ver"
                          className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:border-slate-300"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </a>
                        <a
                          href={doc.downloadUrl}
                          download={doc.fileName}
                          title="Descargar"
                          className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:border-slate-300"
                        >
                          <DownloadIcon className="h-4 w-4" />
                        </a>
                      </>
                    ) : (
                      <span className="px-1.5 text-xs text-slate-400">Sin archivo</span>
                    )}
                    <button
                      type="button"
                      disabled={pendingId === doc.id}
                      onClick={() => handleRemove(doc.id)}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isUploadOpen && (
        <UploadDocumentDialog clientId={client.id} documentTypes={documentTypes} onClose={() => setUploadOpen(false)} />
      )}
    </div>
  );
}
