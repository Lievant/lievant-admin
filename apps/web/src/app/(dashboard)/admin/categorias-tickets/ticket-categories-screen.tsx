'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDownIcon, PlusIcon } from '@/components/icons';
import { NoPermissions } from '@/components/ui/no-permissions';
import { useCurrentUser } from '@/components/user-provider';
import type { ErrorKind, TicketCategory, TicketSubcategory } from '@/lib/api';
import {
  createCategoryAction,
  createSubcategoryAction,
  deactivateCategoryAction,
  deactivateSubcategoryAction,
  updateCategoryAction,
  updateSubcategoryAction,
} from './actions';

interface Props {
  categories: TicketCategory[];
  subcategories: TicketSubcategory[];
  errorKind: ErrorKind | null;
}

const PRIORITIES = ['P1', 'P2', 'P3', 'P4'];

const PRIORITY_STYLES: Record<string, string> = {
  P1: 'bg-red-100 text-red-700',
  P2: 'bg-orange-100 text-orange-700',
  P3: 'bg-yellow-100 text-yellow-800',
  P4: 'bg-slate-100 text-slate-600',
};

const INPUT =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none focus:border-navy';
const LABEL = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500';

interface CategoryForm {
  name: string;
  priorityBase: string;
  slaResponseHours: string;
  slaResolutionHours: string;
  isActive: boolean;
}

const EMPTY_FORM: CategoryForm = {
  name: '',
  priorityBase: 'P3',
  slaResponseHours: '',
  slaResolutionHours: '',
  isActive: true,
};

/** Mismo algoritmo que el API, solo para mostrar el slug antes de guardar. */
function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

export function TicketCategoriesScreen({ categories, subcategories, errorKind }: Props) {
  const router = useRouter();
  const user = useCurrentUser();

  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<TicketCategory | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);

  const [subParent, setSubParent] = useState<string | null>(null);
  const [subName, setSubName] = useState('');
  const [editingSub, setEditingSub] = useState<TicketSubcategory | null>(null);
  const [editingSubName, setEditingSubName] = useState('');

  const canWrite =
    !user ||
    user.roles.some((r) => r.name === 'SUPER_ADMIN') ||
    user.permissions.some(
      (p) => p.section === 'admin' && p.module === 'helpdesk-categorias' && p.action === 'write',
    );

  if (errorKind === 'forbidden') return <NoPermissions />;

  async function run(key: string, fn: () => Promise<{ success: boolean; error?: string }>) {
    setBusy(key);
    setError(null);
    const result = await fn();
    setBusy(null);
    if (!result.success) {
      setError(result.error ?? 'No se pudo completar la operación.');
      return false;
    }
    router.refresh();
    return true;
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setCreating(true);
  }

  function openEdit(c: TicketCategory) {
    setForm({
      name: c.name,
      priorityBase: c.priorityBase ?? 'P3',
      slaResponseHours: c.slaResponseHours === null ? '' : String(c.slaResponseHours),
      slaResolutionHours: c.slaResolutionHours === null ? '' : String(c.slaResolutionHours),
      isActive: c.isActive,
    });
    setCreating(false);
    setEditing(c);
  }

  async function saveCategory() {
    if (!form.name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    const payload = {
      name: form.name.trim(),
      priorityBase: form.priorityBase,
      isActive: form.isActive,
      ...(form.slaResponseHours !== '' && { slaResponseHours: Number(form.slaResponseHours) }),
      ...(form.slaResolutionHours !== '' && {
        slaResolutionHours: Number(form.slaResolutionHours),
      }),
    };

    const ok = editing
      ? await run('save-cat', () => updateCategoryAction(editing.slug, payload))
      : await run('save-cat', () => createCategoryAction(payload));

    if (ok) {
      setEditing(null);
      setCreating(false);
    }
  }

  async function saveSubcategory(slug: string) {
    if (!subName.trim()) return;
    const ok = await run(`sub-${slug}`, () =>
      createSubcategoryAction(slug, { name: subName.trim() }),
    );
    if (ok) setSubName('');
  }

  async function saveSubEdit() {
    if (!editingSub || !editingSubName.trim()) return;
    const ok = await run(`edit-sub-${editingSub.id}`, () =>
      updateSubcategoryAction(editingSub.id, { name: editingSubName.trim() }),
    );
    if (ok) setEditingSub(null);
  }

  const showForm = creating || editing !== null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Categorías de Tickets</h1>
          <p className="mt-1 text-sm text-slate-500">
            La prioridad base de cada categoría es la que se aplica a los tickets nuevos.
          </p>
        </div>
        {canWrite && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            <PlusIcon className="h-4 w-4" />
            Nueva categoría
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}

      {showForm && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            {editing ? `Editar ${editing.name}` : 'Nueva categoría'}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label className={LABEL}>Nombre *</label>
              <input
                className={INPUT}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={100}
              />
              <p className="mt-1 font-mono text-xs text-slate-400">
                slug: {editing ? editing.slug : slugify(form.name) || '—'}
                {editing && ' (no cambia: es la llave del histórico)'}
              </p>
            </div>
            <div>
              <label className={LABEL}>Prioridad base</label>
              <select
                className={INPUT}
                value={form.priorityBase}
                onChange={(e) => setForm({ ...form, priorityBase: e.target.value })}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 pb-2 text-sm text-navy">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                Activa
              </label>
            </div>
            <div>
              <label className={LABEL}>SLA respuesta (horas)</label>
              <input
                className={INPUT}
                type="number"
                min="0"
                value={form.slaResponseHours}
                onChange={(e) => setForm({ ...form, slaResponseHours: e.target.value })}
              />
            </div>
            <div>
              <label className={LABEL}>SLA resolución (horas)</label>
              <input
                className={INPUT}
                type="number"
                min="0"
                value={form.slaResolutionHours}
                onChange={(e) => setForm({ ...form, slaResolutionHours: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              onClick={saveCategory}
              disabled={busy === 'save-cat'}
              className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy === 'save-cat' ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
        {categories.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-slate-400">No hay categorías.</p>
        )}
        {categories.map((c) => {
          const subs = subcategories.filter((s) => s.categorySlug === c.slug);
          const isOpen = expanded === c.slug;
          return (
            <div key={c.slug} className={c.isActive ? '' : 'bg-slate-50/60'}>
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <button
                  onClick={() => setExpanded(isOpen ? null : c.slug)}
                  className="flex items-center gap-2 text-left"
                  aria-label={isOpen ? 'Contraer' : 'Expandir'}
                >
                  <ChevronDownIcon
                    className={`h-4 w-4 text-slate-400 transition ${isOpen ? '' : '-rotate-90'}`}
                  />
                  <span className="font-medium text-navy">{c.name}</span>
                </button>
                <span className="font-mono text-xs text-slate-400">{c.slug}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    PRIORITY_STYLES[c.priorityBase ?? ''] ?? 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {c.priorityBase ?? 'P3'}
                </span>
                <span className="text-xs text-slate-500">
                  SLA {c.slaResponseHours ?? '—'}h / {c.slaResolutionHours ?? '—'}h
                </span>
                <span className="text-xs text-slate-400">{subs.length} subcategorías</span>
                {!c.isActive && (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                    Inactiva
                  </span>
                )}

                {canWrite && (
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={() => openEdit(c)}
                      className="rounded px-2 py-1 text-xs font-semibold text-navy hover:bg-slate-100"
                    >
                      Editar
                    </button>
                    {c.isActive && (
                      <button
                        onClick={() => {
                          if (
                            !confirm(
                              `¿Desactivar "${c.name}"? También se desactivan sus ${subs.length} subcategorías. Los tickets existentes conservan la categoría.`,
                            )
                          )
                            return;
                          void run(`off-${c.slug}`, () => deactivateCategoryAction(c.slug));
                        }}
                        disabled={busy === `off-${c.slug}`}
                        className="rounded px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Desactivar
                      </button>
                    )}
                  </div>
                )}
              </div>

              {isOpen && (
                <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3 pl-10">
                  {subs.length === 0 && (
                    <p className="text-sm text-slate-400">Sin subcategorías.</p>
                  )}
                  <ul className="divide-y divide-slate-100">
                    {subs.map((s) => (
                      <li key={s.id} className="flex items-center gap-3 py-2">
                        {editingSub?.id === s.id ? (
                          <>
                            <input
                              className={`${INPUT} max-w-xs`}
                              value={editingSubName}
                              onChange={(e) => setEditingSubName(e.target.value)}
                            />
                            <button
                              onClick={saveSubEdit}
                              className="rounded px-2 py-1 text-xs font-semibold text-navy hover:bg-slate-100"
                            >
                              Guardar
                            </button>
                            <button
                              onClick={() => setEditingSub(null)}
                              className="rounded px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <span
                              className={`text-sm ${s.isActive ? 'text-navy' : 'text-slate-400 line-through'}`}
                            >
                              {s.name}
                            </span>
                            {canWrite && (
                              <div className="ml-auto flex gap-2">
                                <button
                                  onClick={() => {
                                    setEditingSub(s);
                                    setEditingSubName(s.name);
                                  }}
                                  className="rounded px-2 py-1 text-xs font-semibold text-navy hover:bg-slate-100"
                                >
                                  Editar
                                </button>
                                {s.isActive && (
                                  <button
                                    onClick={() =>
                                      void run(`off-sub-${s.id}`, () =>
                                        deactivateSubcategoryAction(s.id),
                                      )
                                    }
                                    disabled={busy === `off-sub-${s.id}`}
                                    className="rounded px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                                  >
                                    Desactivar
                                  </button>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </li>
                    ))}
                  </ul>

                  {canWrite && (
                    <div className="mt-3 flex gap-2">
                      <input
                        className={`${INPUT} max-w-xs`}
                        value={subParent === c.slug ? subName : ''}
                        onFocus={() => setSubParent(c.slug)}
                        onChange={(e) => setSubName(e.target.value)}
                        placeholder="Nueva subcategoría…"
                      />
                      <button
                        onClick={() => saveSubcategory(c.slug)}
                        disabled={busy === `sub-${c.slug}` || subParent !== c.slug || !subName.trim()}
                        className="whitespace-nowrap rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                      >
                        Agregar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
