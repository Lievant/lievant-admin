'use client';

import { useState, useTransition } from 'react';
import type { CatalogItem, CreateCatalogItemPayload } from '@/lib/api';
import { CloseIcon } from '@/components/icons';
import type { CatalogConfig } from '../constants';
import { createCatalogItemAction, updateCatalogItemAction } from './actions';

interface CatalogItemDialogProps {
  config: CatalogConfig;
  item: CatalogItem | null;
  onClose: () => void;
}

export function CatalogItemDialog({ config, item, onClose }: CatalogItemDialogProps) {
  const [name, setName] = useState(item?.name ?? '');
  const [sortOrder, setSortOrder] = useState(item?.sortOrder ?? 0);
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [extra, setExtra] = useState<Record<string, string | boolean>>(() => {
    const initial: Record<string, string | boolean> = {};
    for (const field of config.fields) {
      if (field.type === 'checkbox') {
        initial[field.key] = Boolean(item?.[field.key]);
      } else if (field.type === 'date') {
        initial[field.key] = ((item?.[field.key] as string | undefined) ?? '').slice(0, 10);
      } else {
        initial[field.key] =
          (item?.[field.key] as string | undefined) ?? (field.key === 'appliesTo' ? 'client' : '');
      }
    }
    return initial;
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isEdit = Boolean(item);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }

    for (const field of config.fields) {
      if (field.required && !String(extra[field.key] ?? '').trim()) {
        setError(`${field.label} es obligatorio.`);
        return;
      }
    }

    const payload: Record<string, unknown> = {
      name: name.trim(),
      sortOrder,
      isActive,
    };

    for (const field of config.fields) {
      const value = extra[field.key];
      if (field.type === 'checkbox') {
        payload[field.key] = Boolean(value);
      } else if (typeof value === 'string' && value.trim()) {
        payload[field.key] = value.trim();
      }
    }

    if (config.filter) {
      Object.assign(payload, config.filter);
    }

    startTransition(async () => {
      const result = item
        ? await updateCatalogItemAction(config.entity, item.id, payload as unknown as CreateCatalogItemPayload)
        : await createCatalogItemAction(config.entity, payload as unknown as CreateCatalogItemPayload);

      if (result.success) {
        onClose();
      } else {
        setError(result.error ?? 'No se pudo guardar el ítem.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-navy">
            {isEdit ? `Editar ${config.itemLabel}` : `Nueva ${config.itemLabel}`}
          </h2>
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
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="catalog-name">
              Nombre
            </label>
            <input
              id="catalog-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
            />
          </div>

          {config.fields.map((field) => {
            if (field.type === 'checkbox') {
              return (
                <label key={field.key} className="flex items-center gap-2 text-sm text-navy">
                  <input
                    type="checkbox"
                    checked={Boolean(extra[field.key])}
                    onChange={(e) => setExtra((prev) => ({ ...prev, [field.key]: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-terracota focus:ring-terracota"
                  />
                  {field.label}
                </label>
              );
            }

            if (field.type === 'date') {
              return (
                <div key={field.key} className="flex flex-col gap-1">
                  <label
                    className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                    htmlFor={`catalog-${field.key}`}
                  >
                    {field.label}
                    {field.required ? ' *' : ''}
                  </label>
                  <input
                    id={`catalog-${field.key}`}
                    type="date"
                    value={String(extra[field.key] ?? '')}
                    onChange={(e) => setExtra((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
                  />
                </div>
              );
            }

            if (field.type === 'select') {
              return (
                <div key={field.key} className="flex flex-col gap-1">
                  <label
                    className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                    htmlFor={`catalog-${field.key}`}
                  >
                    {field.label}
                  </label>
                  <select
                    id={`catalog-${field.key}`}
                    value={String(extra[field.key] ?? '')}
                    onChange={(e) => setExtra((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
                  >
                    {(field.options ?? []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }

            return (
              <div key={field.key} className="flex flex-col gap-1">
                <label
                  className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                  htmlFor={`catalog-${field.key}`}
                >
                  {field.label}
                  {field.required ? ' *' : ''}
                </label>
                <input
                  id={`catalog-${field.key}`}
                  type="text"
                  value={String(extra[field.key] ?? '')}
                  onChange={(e) => setExtra((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className={`rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota ${
                    field.mono ? 'font-mono' : ''
                  }`}
                />
              </div>
            );
          })}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="catalog-sort">
              Orden
            </label>
            <input
              id="catalog-sort"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="w-24 rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-navy">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-terracota focus:ring-terracota"
            />
            Activo
          </label>

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
              {isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
