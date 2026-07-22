'use client';

import { useState } from 'react';
import type { ProjectDetail } from '@/lib/api';

interface Props {
  project: ProjectDetail;
}

const DOC_TYPES = ['contrato', 'propuesta', 'orden_compra', 'entregable', 'otro'];

export function DocumentsTab({ project: initialProject }: Props) {
  const [project, setProject] = useState(initialProject);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState('contrato');
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('name', docName || file.name);
      form.append('type', docType);

      const res = await fetch(`/api/projects/${project.id}/documents`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const newDoc = await res.json();
      setProject((p) => ({ ...p, documents: [newDoc, ...p.documents] }));
      setFile(null);
      setDocName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir');
    } finally {
      setUploading(false);
    }
  }

  const fmtSize = (b: number | null) => {
    if (!b) return '';
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 font-semibold text-navy">Documentos</h2>

      {/* Upload form */}
      <div className="mb-6 rounded-lg border border-dashed border-slate-200 p-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-3">
            <input
              type="file"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }}
              className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
          </div>
          <input
            value={docName}
            onChange={(e) => setDocName(e.target.value)}
            placeholder="Nombre del documento"
            className="col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none"
          />
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none"
          >
            {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="mt-3 rounded-lg bg-navy px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {uploading ? 'Subiendo…' : 'Subir documento'}
        </button>
      </div>

      {/* Document list */}
      {project.documents.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Sin documentos cargados.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {project.documents.map((d) => (
            <li key={d.id} className="flex items-center gap-3 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-100 text-xs font-medium text-slate-500 uppercase">
                {d.type.slice(0, 3)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-navy">{d.name}</p>
                <p className="text-xs text-slate-400">{new Date(d.uploadedAt).toLocaleDateString('es-MX')} · {fmtSize(d.fileSize)}</p>
              </div>
              {d.downloadUrl && (
                <a
                  href={d.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Descargar
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
