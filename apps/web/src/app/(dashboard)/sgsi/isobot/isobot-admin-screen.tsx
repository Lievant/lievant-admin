'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { compararMacroprocesos } from '@/app/(dashboard)/herramientas/isobot/isobot-document-library';
import {
  AlertIcon,
  CloseIcon,
  FileTextIcon,
  LayersIcon,
  PlusIcon,
  SearchIcon,
  SitemapIcon,
  TrashIcon,
} from '@/components/icons';

// ── tipos ────────────────────────────────────────────────────────────────────

interface AdminDocument {
  id: string;
  title: string;
  fileName: string;
  fileType: string | null;
  macroprocess: string | null;
  category: string | null;
  fileSize: number | null;
  chunkCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AdminDocumentsPage {
  data: AdminDocument[];
  nextCursor: string | null;
  total: number;
  stats: {
    documentos: number;
    chunks: number;
    macroprocesos: number;
    ultimaActualizacion: string | null;
  };
}

interface Filtros {
  search: string;
  macroprocess: string;
  fileType: string;
}

const FILTROS_VACIOS: Filtros = { search: '', macroprocess: '', fileType: '' };
const TIPOS = ['pdf', 'docx', 'xlsx'];

// ── utilidades ───────────────────────────────────────────────────────────────

function formatSize(bytes: number | null): string {
  // Los 364 documentos cargados por el seed no tienen tamaño registrado: la
  // columna file_size se agregó con el panel.
  if (bytes === null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Sube con XMLHttpRequest en lugar de fetch: la reindexación de un DOCX grande
 * tarda decenas de segundos y sin el evento `progress` de la subida el usuario
 * no tiene señal de que algo esté pasando.
 */
function subirConProgreso(
  url: string,
  method: 'POST' | 'PUT',
  form: FormData,
  onProgress: (pct: number) => void,
): Promise<{ ok: boolean; body: unknown }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener('load', () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText) as unknown;
      } catch {
        body = null;
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, body });
    });
    xhr.addEventListener('error', () => resolve({ ok: false, body: null }));
    xhr.send(form);
  });
}

function mensajeDeError(body: unknown, fallback: string): string {
  const message = (body as { message?: string | string[] } | null)?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? fallback;
}

// ── pantalla ─────────────────────────────────────────────────────────────────

export function IsobotAdminScreen() {
  const [documentos, setDocumentos] = useState<AdminDocument[]>([]);
  const [stats, setStats] = useState<AdminDocumentsPage['stats'] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [macroprocesos, setMacroprocesos] = useState<string[]>([]);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [subiendo, setSubiendo] = useState(false);
  const [reemplazando, setReemplazando] = useState<AdminDocument | null>(null);
  const [retirando, setRetirando] = useState<AdminDocument | null>(null);

  // El texto de búsqueda se aplica con retardo para no lanzar una consulta por
  // cada tecla sobre una tabla de varios cientos de documentos.
  useEffect(() => {
    const id = setTimeout(() => setFiltros((f) => ({ ...f, search: busqueda })), 350);
    return () => clearTimeout(id);
  }, [busqueda]);

  const queryString = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams();
      if (filtros.search) params.set('search', filtros.search);
      if (filtros.macroprocess) params.set('macroprocess', filtros.macroprocess);
      if (filtros.fileType) params.set('fileType', filtros.fileType);
      if (cursor) params.set('cursor', cursor);
      params.set('limit', '20');
      return params.toString();
    },
    [filtros],
  );

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/isobot/admin/documents?${queryString()}`);
      if (res.status === 403) {
        setError('No tienes permiso para administrar los documentos del SGSI.');
        return;
      }
      if (!res.ok) {
        setError('No se pudieron cargar los documentos.');
        return;
      }
      const page = (await res.json()) as AdminDocumentsPage;
      setDocumentos(page.data);
      setStats(page.stats);
      setNextCursor(page.nextCursor);
      setError(null);
    } catch {
      setError('No se pudieron cargar los documentos.');
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/isobot/admin/macroprocesses');
        if (res.ok) setMacroprocesos(((await res.json()) as string[]).sort(compararMacroprocesos));
      } catch {
        /* el filtro queda vacío; el resto de la pantalla sirve */
      }
    })();
  }, []);

  async function cargarMas() {
    if (!nextCursor || cargandoMas) return;
    setCargandoMas(true);
    try {
      const res = await fetch(`/api/isobot/admin/documents?${queryString(nextCursor)}`);
      if (res.ok) {
        const page = (await res.json()) as AdminDocumentsPage;
        setDocumentos((prev) => [...prev, ...page.data]);
        setNextCursor(page.nextCursor);
      }
    } finally {
      setCargandoMas(false);
    }
  }

  const filtrosActivos = filtros.search || filtros.macroprocess || filtros.fileType;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy">Administración ISOBOT</h1>
          <p className="mt-1 text-sm text-slate-500">
            Documentos del SGSI que alimentan al chatbot. Al subir o reemplazar un archivo se
            reindexa de inmediato y el bot responde con la versión nueva.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSubiendo(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90"
        >
          <PlusIcon className="h-4 w-4" />
          Subir documento
        </button>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={<FileTextIcon className="h-5 w-5" />}
          label="Documentos"
          value={stats ? String(stats.documentos) : '—'}
        />
        <StatCard
          icon={<LayersIcon className="h-5 w-5" />}
          label="Fragmentos indexados"
          value={stats ? stats.chunks.toLocaleString('es-MX') : '—'}
        />
        <StatCard
          icon={<SitemapIcon className="h-5 w-5" />}
          label="Macroprocesos"
          value={stats ? String(stats.macroprocesos) : '—'}
        />
        <StatCard
          icon={<AlertIcon className="h-5 w-5" />}
          label="Última actualización"
          value={formatDate(stats?.ultimaActualizacion ?? null)}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por título o archivo…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-navy placeholder:text-slate-400 focus:border-navy focus:outline-none"
          />
        </div>
        <select
          value={filtros.macroprocess}
          onChange={(e) => setFiltros((f) => ({ ...f, macroprocess: e.target.value }))}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy focus:border-navy focus:outline-none"
        >
          <option value="">Todos los macroprocesos</option>
          {macroprocesos.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          value={filtros.fileType}
          onChange={(e) => setFiltros((f) => ({ ...f, fileType: e.target.value }))}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy focus:border-navy focus:outline-none"
        >
          <option value="">Todos los tipos</option>
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {t.toUpperCase()}
            </option>
          ))}
        </select>
        {filtrosActivos && (
          <button
            type="button"
            onClick={() => {
              setBusqueda('');
              setFiltros(FILTROS_VACIOS);
            }}
            className="text-sm text-slate-500 hover:text-navy"
          >
            Limpiar
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Cargando documentos…</p>
      ) : documentos.length === 0 ? (
        <p className="text-sm text-slate-400">
          {filtrosActivos ? 'Ningún documento coincide con los filtros.' : 'No hay documentos.'}
        </p>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Documento</th>
                  <th className="px-4 py-3">Macroproceso</th>
                  <th className="px-4 py-3 text-center">Tipo</th>
                  <th className="px-4 py-3 text-right">Fragmentos</th>
                  <th className="px-4 py-3 text-right">Tamaño</th>
                  <th className="px-4 py-3">Actualizado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documentos.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50">
                    <td className="max-w-xs px-4 py-3">
                      <p className="truncate font-medium text-navy">{doc.title}</p>
                      <p className="truncate text-xs text-slate-400">{doc.fileName}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{doc.macroprocess ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                        {doc.fileType ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {doc.chunkCount}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {formatSize(doc.fileSize)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(doc.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setReemplazando(doc)}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-navy hover:text-navy"
                        >
                          Reemplazar
                        </button>
                        <button
                          type="button"
                          onClick={() => setRetirando(doc)}
                          className="rounded-md p-1 text-slate-400 hover:text-rose-600"
                          aria-label={`Retirar ${doc.title}`}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
            <span>
              {documentos.length} de {stats?.documentos ?? documentos.length}
            </span>
            {nextCursor && (
              <button
                type="button"
                onClick={() => void cargarMas()}
                disabled={cargandoMas}
                className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-navy hover:border-navy disabled:opacity-60"
              >
                {cargandoMas ? 'Cargando…' : 'Cargar más'}
              </button>
            )}
          </div>
        </>
      )}

      {subiendo && (
        <UploadModal
          macroprocesos={macroprocesos}
          onClose={() => setSubiendo(false)}
          onDone={() => {
            setSubiendo(false);
            void cargar();
          }}
        />
      )}

      {reemplazando && (
        <ReplaceModal
          documento={reemplazando}
          onClose={() => setReemplazando(null)}
          onDone={() => {
            setReemplazando(null);
            void cargar();
          }}
        />
      )}

      {retirando && (
        <DeleteModal
          documento={retirando}
          onClose={() => setRetirando(null)}
          onDone={() => {
            setRetirando(null);
            void cargar();
          }}
        />
      )}
    </div>
  );
}

// ── piezas ───────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2 text-slate-400">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1 text-xl font-semibold text-navy">{value}</p>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="font-bold text-navy">{title}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-navy">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function ProgressBar({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="mt-4">
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-navy transition-all"
          style={{ width: `${Math.max(pct, 5)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function UploadModal({
  macroprocesos,
  onClose,
  onDone,
}: {
  macroprocesos: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [macroprocess, setMacroprocess] = useState('');
  const [category, setCategory] = useState('');
  const [pct, setPct] = useState(0);
  const [fase, setFase] = useState<'idle' | 'subiendo' | 'indexando'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!file || fase !== 'idle') return;
    setError(null);
    setFase('subiendo');
    setPct(0);

    const form = new FormData();
    form.append('file', file);
    if (title.trim()) form.append('title', title.trim());
    if (macroprocess.trim()) form.append('macroprocess', macroprocess.trim());
    if (category.trim()) form.append('category', category.trim());

    const { ok, body } = await subirConProgreso(
      '/api/isobot/admin/documents',
      'POST',
      form,
      (p) => {
        setPct(p);
        // Al llegar a 100 la transferencia terminó pero el servidor sigue
        // extrayendo texto y generando embeddings, que es la parte lenta.
        if (p >= 100) setFase('indexando');
      },
    );

    if (!ok) {
      setError(mensajeDeError(body, 'No se pudo subir el documento.'));
      setFase('idle');
      return;
    }
    onDone();
  }

  const trabajando = fase !== 'idle';

  return (
    <Modal title="Subir documento" onClose={trabajando ? () => undefined : onClose}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Archivo</label>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.xlsx"
            disabled={trabajando}
            onChange={(e) => {
              const seleccionado = e.target.files?.[0] ?? null;
              setFile(seleccionado);
              if (seleccionado && !title) {
                setTitle(seleccionado.name.replace(/\.[^.]+$/, ''));
              }
            }}
            className="w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-navy"
          />
          <p className="mt-1 text-xs text-slate-400">PDF, DOCX o XLSX · máximo 20 MB</p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Título</label>
          <input
            type="text"
            value={title}
            disabled={trabajando}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy focus:border-navy focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Macroproceso</label>
          <input
            type="text"
            list="macroprocesos-isobot"
            value={macroprocess}
            disabled={trabajando}
            onChange={(e) => setMacroprocess(e.target.value)}
            placeholder="Ej. 4. RECURSOS HUMANOS"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy placeholder:text-slate-400 focus:border-navy focus:outline-none"
          />
          <datalist id="macroprocesos-isobot">
            {macroprocesos.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Categoría</label>
          <input
            type="text"
            value={category}
            disabled={trabajando}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy focus:border-navy focus:outline-none"
          />
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        {trabajando && (
          <ProgressBar
            pct={fase === 'indexando' ? 100 : pct}
            label={fase === 'indexando' ? 'Indexando y generando embeddings…' : `Subiendo… ${pct}%`}
          />
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={trabajando}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!file || trabajando}
            className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {trabajando ? 'Procesando…' : 'Subir e indexar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ReplaceModal({
  documento,
  onClose,
  onDone,
}: {
  documento: AdminDocument;
  onClose: () => void;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [pct, setPct] = useState(0);
  const [fase, setFase] = useState<'idle' | 'subiendo' | 'indexando'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!file || fase !== 'idle') return;
    setError(null);
    setFase('subiendo');
    setPct(0);

    const form = new FormData();
    form.append('file', file);

    const { ok, body } = await subirConProgreso(
      `/api/isobot/admin/documents/${documento.id}`,
      'PUT',
      form,
      (p) => {
        setPct(p);
        if (p >= 100) setFase('indexando');
      },
    );

    if (!ok) {
      setError(mensajeDeError(body, 'No se pudo reemplazar el documento.'));
      setFase('idle');
      return;
    }
    onDone();
  }

  const trabajando = fase !== 'idle';

  return (
    <Modal title="Reemplazar documento" onClose={trabajando ? () => undefined : onClose}>
      <p className="text-sm text-slate-600">
        Se sustituirá el archivo de <span className="font-medium text-navy">{documento.title}</span>{' '}
        y se regenerarán sus {documento.chunkCount} fragmentos. El nombre de archivo original se
        conserva.
      </p>

      <div className="mt-3">
        <input
          type="file"
          accept=".pdf,.docx,.xlsx"
          disabled={trabajando}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-navy"
        />
      </div>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {trabajando && (
        <ProgressBar
          pct={fase === 'indexando' ? 100 : pct}
          label={fase === 'indexando' ? 'Reindexando…' : `Subiendo… ${pct}%`}
        />
      )}

      <div className="flex justify-end gap-2 pt-4">
        <button
          type="button"
          onClick={onClose}
          disabled={trabajando}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!file || trabajando}
          className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {trabajando ? 'Procesando…' : 'Reemplazar'}
        </button>
      </div>
    </Modal>
  );
}

function DeleteModal({
  documento,
  onClose,
  onDone,
}: {
  documento: AdminDocument;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/isobot/admin/documents/${documento.id}`, { method: 'DELETE' });
      if (!res.ok) {
        setError(mensajeDeError(await res.json().catch(() => null), 'No se pudo retirar.'));
        return;
      }
      onDone();
    } catch {
      setError('No se pudo retirar el documento.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Retirar documento" onClose={onClose}>
      <p className="text-sm text-slate-600">
        <span className="font-medium text-navy">{documento.title}</span> dejará de estar disponible
        para el chatbot y sus {documento.chunkCount} fragmentos se eliminarán del índice. El
        registro se conserva en el historial.
      </p>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <div className="flex justify-end gap-2 pt-4">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Retirando…' : 'Retirar'}
        </button>
      </div>
    </Modal>
  );
}
