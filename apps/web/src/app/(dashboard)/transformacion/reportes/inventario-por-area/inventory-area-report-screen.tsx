'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { InventoryAreaReport, InventoryReportEmployee } from '@/lib/api';
import { ScrollableTable } from '@/components/ui/scrollable-table';

interface Props {
  report: InventoryAreaReport | null;
  error: boolean;
}

const PRINT_STYLES = `
@media print {
  body * { visibility: hidden; }
  #inventory-report, #inventory-report * { visibility: visible; }
  #inventory-report { position: absolute; inset: 0; }

  .no-print { display: none !important; }

  .area-section { page-break-after: always; }
  .area-section:last-child { page-break-after: avoid; }
  .employee-block { page-break-inside: avoid; }

  body { font-size: 11px; color: #000; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
  th { background: #f1f5f9; font-weight: 600; }
  .report-header { margin-bottom: 20px; }
  .area-title { font-size: 14px; font-weight: 700; margin: 16px 0 8px; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 4px; }
  .employee-name { font-size: 12px; font-weight: 600; margin: 12px 0 4px; }
  .employee-meta { font-size: 10px; color: #555; margin-bottom: 6px; }
}
`;

function totalEquipment(employees: InventoryReportEmployee[]) {
  return employees.reduce((sum, e) => sum + e.equipment.length, 0);
}

export function InventoryAreaReportScreen({ report, error }: Props) {
  const [areaFilter, setAreaFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const allAreas = useMemo(() => report?.areas.map((a) => a.area) ?? [], [report]);

  const allLocations = useMemo(() => {
    if (!report) return [];
    const set = new Set<string>();
    for (const area of report.areas) {
      for (const emp of area.employees) {
        if (emp.location) set.add(emp.location);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [report]);

  const allStatuses = useMemo(() => {
    if (!report) return [];
    const set = new Set<string>();
    for (const area of report.areas) {
      for (const emp of area.employees) {
        for (const eq of emp.equipment) set.add(eq.status);
      }
    }
    return Array.from(set).sort();
  }, [report]);

  const filteredAreas = useMemo(() => {
    if (!report) return [];
    return report.areas
      .filter((a) => !areaFilter || a.area === areaFilter)
      .map((a) => ({
        ...a,
        employees: a.employees
          .filter((e) => !locationFilter || e.location === locationFilter)
          .map((e) => ({
            ...e,
            equipment: e.equipment.filter((eq) => !statusFilter || eq.status === statusFilter),
          }))
          .filter((e) => e.equipment.length > 0),
      }))
      .filter((a) => a.employees.length > 0);
  }, [report, areaFilter, locationFilter, statusFilter]);

  const today = new Date().toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const totalAreas = filteredAreas.length;
  const totalEmps = filteredAreas.reduce((sum, a) => sum + a.employees.length, 0);
  const totalEquip = filteredAreas.reduce((sum, a) => sum + totalEquipment(a.employees), 0);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />

      <div className="mx-auto max-w-6xl px-8 py-8 no-print">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-slate-500">
          <Link href="/transformacion/reportes" className="hover:text-terracota">Reportes</Link>
          <span>/</span>
          <span className="text-navy font-medium">Inventario por área</span>
        </nav>

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy">Inventario Tecnológico por Área</h1>
            <p className="mt-1 text-sm text-slate-500">
              Equipos asignados agrupados por área y empleado · {today}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy/90"
          >
            <span>🖨</span>
            Exportar PDF
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-terracota/30 bg-terracota/5 px-4 py-3 text-sm text-terracota-dark">
            No se pudo cargar el reporte. Verifica tu conexión e intenta de nuevo.
          </div>
        )}

        {/* Filtros */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <select
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-terracota focus:outline-none"
          >
            <option value="">Área: Todas</option>
            {allAreas.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-terracota focus:outline-none"
          >
            <option value="">Ubicación: Todas</option>
            {allLocations.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-terracota focus:outline-none"
          >
            <option value="">Estado: Todos</option>
            {allStatuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {(areaFilter || locationFilter || statusFilter) && (
            <button
              type="button"
              onClick={() => { setAreaFilter(''); setLocationFilter(''); setStatusFilter(''); }}
              className="text-sm text-slate-500 underline hover:text-navy"
            >
              Limpiar filtros
            </button>
          )}

          <span className="ml-auto text-xs text-slate-400">
            {totalAreas} área{totalAreas !== 1 ? 's' : ''} · {totalEmps} empleado{totalEmps !== 1 ? 's' : ''} · {totalEquip} equipo{totalEquip !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Reporte — visible en pantalla y en impresión */}
      <div id="inventory-report" className="mx-auto max-w-6xl px-8 pb-16">

        {/* Header de impresión */}
        <div className="report-header hidden print:block mb-6">
          <h1 className="text-2xl font-bold text-navy">Inventario Tecnológico — Lievant</h1>
          <p className="text-sm text-slate-500 mt-1">Reporte generado el {today}</p>
        </div>

        {filteredAreas.length === 0 && !error && (
          <p className="px-8 text-sm text-slate-400 no-print">
            {report ? 'No hay equipos con los filtros seleccionados.' : 'Cargando…'}
          </p>
        )}

        {filteredAreas.map((area, areaIdx) => (
          <div key={area.area} className={`area-section mb-12 ${areaIdx === filteredAreas.length - 1 ? '' : 'pb-8'}`}>
            {/* Cabecera del área */}
            <div className="area-title mb-4 border-b-2 border-navy pb-2">
              <h2 className="text-lg font-bold uppercase text-navy">{area.area}</h2>
              <p className="text-xs text-slate-500 font-normal normal-case mt-0.5">
                {area.employees.length} empleado{area.employees.length !== 1 ? 's' : ''} · {totalEquipment(area.employees)} equipo{totalEquipment(area.employees) !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Bloques por empleado */}
            <div className="space-y-6">
              {area.employees.map((emp) => (
                <div key={emp.employeeId} className="employee-block">
                  <div className="employee-name mb-1">
                    <p className="font-semibold text-navy">{emp.fullName}</p>
                    <p className="employee-meta text-xs text-slate-500">
                      {[emp.division, emp.location].filter(Boolean).join(' · ')}
                    </p>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <ScrollableTable>
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-2">ID Lievant</th>
                          <th className="px-3 py-2">ID Anterior</th>
                          <th className="px-3 py-2">Tipo</th>
                          <th className="px-3 py-2">Marca / Modelo</th>
                          <th className="px-3 py-2">No. Serie</th>
                          <th className="px-3 py-2">Estado</th>
                          <th className="px-3 py-2">Cargador</th>
                        </tr>
                      </thead>
                      <tbody>
                        {emp.equipment.map((eq) => (
                          <tr key={eq.displayId} className="border-b border-slate-100 last:border-none">
                            <td className="px-3 py-1.5 font-mono text-[10px] font-medium text-terracota">{eq.displayId}</td>
                            <td className="px-3 py-1.5 font-mono text-[10px] text-slate-500">{eq.legacyId ?? '—'}</td>
                            <td className="px-3 py-1.5 text-slate-700">{eq.equipmentType}</td>
                            <td className="px-3 py-1.5 text-slate-700">
                              {[eq.brand, eq.model].filter(Boolean).join(' ') || '—'}
                            </td>
                            <td className="px-3 py-1.5 font-mono text-[10px] text-slate-600">{eq.serialNumber ?? '—'}</td>
                            <td className="px-3 py-1.5">
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                {eq.status}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              {eq.chargerIncluded ? '✓' : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </ScrollableTable>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
