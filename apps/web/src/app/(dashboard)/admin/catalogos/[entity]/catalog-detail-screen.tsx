'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/utils';
import type { CatalogItem } from '@/lib/api';
import { CloseIcon, PlusIcon } from '@/components/icons';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import type { CatalogConfig } from '../constants';
import { deactivateCatalogItemAction, updateCatalogItemAction } from './actions';
import { CatalogItemDialog } from './catalog-item-dialog';

interface CatalogDetailScreenProps {
  config: Omit<CatalogConfig, 'icon'>;
  items: CatalogItem[];
}

export function CatalogDetailScreen({ config, items }: CatalogDetailScreenProps) {
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const toggleActive = (item: CatalogItem) => {
    setActionError(null);
    setPendingId(item.id);
    startTransition(async () => {
      const result = item.isActive
        ? await deactivateCatalogItemAction(config.entity, item.id)
        : await updateCatalogItemAction(config.entity, item.id, { isActive: true });

      if (!result.success) {
        setActionError(result.error ?? 'No se pudo actualizar el ítem.');
      }
      setPendingId(null);
    });
  };

  const deactivate = (item: CatalogItem) => {
    setActionError(null);
    setPendingId(item.id);
    startTransition(async () => {
      const result = await deactivateCatalogItemAction(config.entity, item.id);
      if (!result.success) {
        setActionError(result.error ?? 'No se pudo desactivar el ítem.');
      }
      setPendingId(null);
    });
  };

  return (
    <div>
      <header className="mt-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">{config.label}</h1>
          <p className="mt-1 text-sm text-slate-500">{items.length} ítems registrados</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          <PlusIcon className="h-4 w-4" />
          Nuevo ítem
        </button>
      </header>

      {actionError && (
        <div className="mt-6 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} aria-label="Cerrar">
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <ScrollableTable>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Nombre</th>
              {config.fields.map((field) => (
                <th key={field.key} className="px-4 py-3">
                  {field.label}
                </th>
              ))}
              <th className="px-4 py-3">Activo</th>
              <th className="px-4 py-3">Orden</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={config.fields.length + 4} className="px-4 py-10 text-center text-sm text-slate-400">
                  No hay ítems registrados en este catálogo.
                </td>
              </tr>
            )}
            {items.map((item) => {
              const isRowPending = pendingId === item.id;

              return (
                <tr
                  key={item.id}
                  className={cn('border-b border-slate-100 last:border-none', !item.isActive && 'opacity-50')}
                >
                  <td className="px-4 py-3 font-medium text-navy">
                    <div className="flex items-center gap-2">
                      {item.name}
                      {!item.isActive && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                          Inactivo
                        </span>
                      )}
                    </div>
                  </td>
                  {config.fields.map((field) => (
                    <td key={field.key} className="px-4 py-3 text-slate-600">
                      {renderFieldValue(item, field)}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={item.isActive}
                      disabled={isRowPending}
                      onClick={() => toggleActive(item)}
                      className={cn(
                        'relative h-5 w-9 rounded-full transition-colors disabled:opacity-50',
                        item.isActive ? 'bg-black' : 'bg-slate-300',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
                          item.isActive ? 'translate-x-[18px]' : 'translate-x-0.5',
                        )}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.sortOrder}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingItem(item)}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-slate-300"
                      >
                        Editar
                      </button>
                      {item.isActive && (
                        <button
                          type="button"
                          disabled={isRowPending}
                          onClick={() => deactivate(item)}
                          className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          Desactivar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </ScrollableTable>
      </div>

      {isCreateOpen && <CatalogItemDialog config={config} item={null} onClose={() => setCreateOpen(false)} />}
      {editingItem && (
        <CatalogItemDialog config={config} item={editingItem} onClose={() => setEditingItem(null)} />
      )}
    </div>
  );
}

function renderFieldValue(item: CatalogItem, field: CatalogConfig['fields'][number]) {
  const value = item[field.key];

  if (field.type === 'checkbox') {
    return value ? 'Sí' : 'No';
  }

  if (field.type === 'date') {
    return value ? String(value).slice(0, 10) : '—';
  }

  if (field.type === 'select') {
    const option = field.options?.find((opt) => opt.value === value);
    return option?.label ?? '—';
  }

  return value ? <span className={field.mono ? 'font-mono' : ''}>{String(value)}</span> : '—';
}
