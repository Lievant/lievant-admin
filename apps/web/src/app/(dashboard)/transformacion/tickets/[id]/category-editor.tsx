'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { HelpdeskCategorySummary, HelpdeskSubcategorySummary } from '@/lib/api';

function errorMessage(body: unknown, fallback: string): string {
  const message = (body as { message?: string | string[] } | null)?.message;
  if (Array.isArray(message)) return message[0] ?? fallback;
  return message || fallback;
}

/**
 * Cambio de categoría y subcategoría (solo TD). Las listas salen del catálogo
 * activo; la subcategoría depende de la categoría. El API registra el cambio en
 * el historial y recalcula la prioridad solo si era la base de la anterior.
 */
export function CategoryEditor({
  ticketId,
  category,
  subcategory,
}: {
  ticketId: string;
  category: string;
  subcategory: string | null;
}) {
  const router = useRouter();
  const [categories, setCategories] = useState<HelpdeskCategorySummary[]>([]);
  const [subcategories, setSubcategories] = useState<HelpdeskSubcategorySummary[]>([]);
  const [slug, setSlug] = useState(category);
  const [sub, setSub] = useState(subcategory ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/helpdesk/categories')
      .then((r) => (r.ok ? (r.json() as Promise<HelpdeskCategorySummary[]>) : []))
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!slug) return setSubcategories([]);
    let cancelled = false;
    fetch(`/api/helpdesk/categories/${encodeURIComponent(slug)}/subcategories`)
      .then((r) => (r.ok ? (r.json() as Promise<HelpdeskSubcategorySummary[]>) : []))
      .then((rows) => !cancelled && setSubcategories(rows))
      .catch(() => !cancelled && setSubcategories([]));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const unchanged = slug === category && sub === (subcategory ?? '');
  // La categoría actual puede estar desactivada: se sigue mostrando para no perderla.
  const options = categories.some((c) => c.slug === category)
    ? categories
    : [...categories, { id: category, slug: category, name: `${category} (inactiva)` } as HelpdeskCategorySummary];

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/helpdesk/tickets/${encodeURIComponent(ticketId)}/category`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: slug, subcategory: sub || null }),
      });
      if (!res.ok) {
        setError(errorMessage(await res.json().catch(() => null), 'No se pudo cambiar la categoría.'));
        return;
      }
      router.refresh();
    } catch {
      setError('No se pudo cambiar la categoría.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <label htmlFor={`cat-${ticketId}`} className="mb-1 block text-xs font-medium text-slate-600">
        Categoría
      </label>
      <select
        id={`cat-${ticketId}`}
        value={slug}
        onChange={(e) => {
          setSlug(e.target.value);
          setSub('');
        }}
        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:outline-none"
      >
        {options.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>
      <label htmlFor={`subcat-${ticketId}`} className="mb-1 mt-2 block text-xs font-medium text-slate-600">
        Subcategoría
      </label>
      <select
        id={`subcat-${ticketId}`}
        value={sub}
        onChange={(e) => setSub(e.target.value)}
        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:outline-none"
      >
        <option value="">Sin subcategoría</option>
        {subcategories.map((s) => (
          <option key={s.id} value={s.name}>
            {s.name}
          </option>
        ))}
        {sub && !subcategories.some((s) => s.name === sub) && <option value={sub}>{sub}</option>}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <button
        type="button"
        disabled={saving || unchanged || !slug}
        onClick={() => void save()}
        className="mt-1.5 w-full rounded-md bg-slate-700 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
      >
        {saving ? 'Guardando…' : 'Cambiar categoría'}
      </button>
    </div>
  );
}
