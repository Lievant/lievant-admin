'use client';

import { useEffect, useState } from 'react';
import { CloseIcon } from '@/components/icons';

interface IsobotDocumentListItem {
  id: string;
  title: string;
  file_name: string;
  file_type: string | null;
  macroprocess: string | null;
  category: string | null;
  is_active: boolean;
  created_at: string;
  chunk_count: number;
}

export function IsobotDocumentLibrary({ onClose }: { onClose: () => void }) {
  const [documents, setDocuments] = useState<IsobotDocumentListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/isobot/documents')
      .then(async (res) => {
        if (!res.ok) throw new Error('No se pudo cargar la biblioteca de documentos');
        return (await res.json()) as IsobotDocumentListItem[];
      })
      .then((data) => {
        if (cancelled) return;
        setDocuments(data);
        setOpenGroup(data[0] ? (data[0].macroprocess ?? 'Sin macroproceso') : null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error al cargar documentos');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDownload(id: string) {
    if (downloadingId) return;
    setDownloadingId(id);
    try {
      const res = await fetch(`/api/isobot/documents/${id}/download`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { url: string };
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch {
      // silencioso — el documento puede no tener archivo asociado en S3
    } finally {
      setDownloadingId(null);
    }
  }

  const groups = (documents ?? []).reduce<Record<string, IsobotDocumentListItem[]>>((acc, doc) => {
    const key = doc.macroprocess ?? 'Sin macroproceso';
    (acc[key] ??= []).push(doc);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="font-bold text-navy">Biblioteca de documentos</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-navy">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!error && !documents && <p className="text-sm text-slate-400">Cargando…</p>}
          {!error && documents && documents.length === 0 && (
            <p className="text-sm text-slate-400">No hay documentos disponibles.</p>
          )}

          {Object.entries(groups).map(([macroprocess, docs]) => (
            <div key={macroprocess} className="border-b border-slate-100 last:border-b-0">
              <button
                type="button"
                onClick={() => setOpenGroup(openGroup === macroprocess ? null : macroprocess)}
                className="flex w-full items-center justify-between py-3 text-left text-sm font-semibold text-navy"
              >
                <span>{macroprocess}</span>
                <span className="text-xs font-normal text-slate-400">{docs.length}</span>
              </button>
              {openGroup === macroprocess && (
                <div className="space-y-1 pb-3">
                  {docs.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => handleDownload(doc.id)}
                      disabled={downloadingId === doc.id}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                    >
                      <span className="truncate">{doc.title}</span>
                      <span className="shrink-0 rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                        {doc.file_type ?? '—'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
