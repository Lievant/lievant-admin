'use client';

import type { Announcement } from '@/lib/api';
import { useState } from 'react';

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

interface Props {
  initialAnnouncements: Announcement[];
  canManage: boolean;
}

export function AnnouncementsCard({ initialAnnouncements, canManage }: Props) {
  const [announcements, setAnnouncements] = useState<Announcement[]>(initialAnnouncements);
  const [showDialog, setShowDialog] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? 'Error al publicar');
      }

      const created = (await res.json()) as Announcement;
      setAnnouncements((prev) => [created, ...prev]);
      setShowDialog(false);
      setTitle('');
      setBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    await fetch(`/api/announcements/${id}`, { method: 'DELETE' });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-navy text-sm">Tablón de comunicados</h2>
        {canManage && (
          <button
            onClick={() => setShowDialog(true)}
            className="text-xs font-medium text-terracota border border-terracota/40 rounded-md px-2.5 py-1 hover:bg-terracota hover:text-white transition-colors"
          >
            + Publicar
          </button>
        )}
      </div>

      {announcements.length === 0 ? (
        <p className="text-xs text-slate-400 py-4 text-center">No hay comunicados activos.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {announcements.map((a) => (
            <li key={a.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy">{a.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500 whitespace-pre-line">{a.body}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {a.author?.name ?? 'Sistema'} · {relativeDate(a.createdAt)}
                  </p>
                </div>
                {canManage && (
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="flex-shrink-0 text-slate-300 hover:text-terracota transition-colors text-lg leading-none"
                    title="Eliminar"
                  >
                    ×
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl p-6">
            <h3 className="font-semibold text-navy mb-4">Nuevo comunicado</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Título</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracota/30"
                  placeholder="Asunto del comunicado"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Mensaje</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracota/30 resize-none"
                  placeholder="Escribe el comunicado..."
                />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowDialog(false); setError(null); }}
                  className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium bg-terracota text-white rounded-lg hover:bg-terracota-dark disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Publicando…' : 'Publicar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
