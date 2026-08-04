'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import type { MissingDocumentReportItem } from '@/lib/api';
import { ChevronLeftIcon, TableIcon } from '@/components/icons';
import { ScrollableTable } from '@/components/ui/scrollable-table';

interface Props {
  items: MissingDocumentReportItem[];
}

export function MissingDocsReportScreen({ items }: Props) {
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? items.filter((i) => i.companyName.toLowerCase().includes(q) || i.displayId.toLowerCase().includes(q)) : items;
  }, [items, search]);

  function toggleExpand(clientId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }

  function exportExcel() {
    const data = items.map((item) => ({
      'ID Cliente': item.displayId,
      Nombre: item.companyName,
      'Docs Requeridos': item.requiredDocs.length,
      'Docs Subidos': item.uploadedDocs.length,
      'Docs Faltantes': item.missingDocs.join(', '),
      '% Completitud': item.completionPct,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Documentos faltantes');
    XLSX.writeFile(wb, 'documentos_faltantes.xlsx');
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <div className="mb-6">
        <Link
          href="/finanzas/reportes"
          className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Reportes Finanzas
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <TableIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-black">Finanzas · Reportes</p>
              <h1 className="text-2xl font-bold text-navy">Documentos faltantes</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Filters + export */}
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[240px]">
          <label className="mb-1 block text-xs font-medium text-slate-500">Buscar cliente</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre o ID…"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-navy placeholder:text-slate-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black/30"
          />
        </div>

        <div className="ml-auto">
          <button
            onClick={exportExcel}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
          >
            <TableIcon className="h-4 w-4" />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Summary */}
      <p className="mb-3 text-xs text-slate-400">
        {filtered.length} cliente{filtered.length !== 1 ? 's' : ''} con documentos incompletos
        {search ? ` (filtrado de ${items.length})` : ''}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-20 text-center">
          <TableIcon className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="font-medium text-slate-400">
            {items.length === 0
              ? 'Todos los clientes tienen sus documentos completos'
              : 'Sin resultados para la búsqueda'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <ScrollableTable>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-center">Requeridos</th>
                <th className="px-4 py-3 text-center">Subidos</th>
                <th className="px-4 py-3 text-center">Faltantes</th>
                <th className="px-4 py-3 text-left w-40">% Completitud</th>
                <th className="px-4 py-3 text-left">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => {
                const isExpanded = expandedIds.has(item.clientId);
                return (
                  <>
                    <tr
                      key={item.clientId}
                      className="cursor-pointer hover:bg-slate-50/60"
                      onClick={() => toggleExpand(item.clientId)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
                            {item.displayId}
                          </span>
                          <span className="font-medium text-navy">{item.companyName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">{item.requiredDocs.length}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-semibold text-green-600">{item.uploadedDocs.length}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-semibold text-red-500">{item.missingDocs.length}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-black transition-all"
                              style={{ width: `${item.completionPct}%` }}
                            />
                          </div>
                          <span className="w-10 text-right text-xs font-semibold text-slate-600">
                            {item.completionPct}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/finanzas/clientes/${item.clientId}`}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-slate-300"
                        >
                          Ver expediente
                        </Link>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${item.clientId}-detail`} className="bg-slate-50">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-green-600">
                                Documentos subidos ({item.uploadedDocs.length})
                              </p>
                              {item.uploadedDocs.length === 0 ? (
                                <p className="text-xs text-slate-400">Ninguno</p>
                              ) : (
                                <ul className="space-y-1">
                                  {item.uploadedDocs.map((doc) => (
                                    <li key={doc} className="flex items-center gap-1.5 text-xs text-slate-600">
                                      <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                                      {doc}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div>
                              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-red-500">
                                Documentos faltantes ({item.missingDocs.length})
                              </p>
                              <ul className="space-y-1">
                                {item.missingDocs.map((doc) => (
                                  <li key={doc} className="flex items-center gap-1.5 text-xs text-slate-600">
                                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                                    {doc}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
          </ScrollableTable>
        </div>
      )}
    </div>
  );
}
