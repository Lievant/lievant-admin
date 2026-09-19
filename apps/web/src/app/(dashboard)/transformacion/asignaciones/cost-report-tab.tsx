'use client';

import { useMemo, useState } from 'react';
import { DownloadIcon, SearchIcon } from '@/components/icons';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import type { CostReport, CostReportParams, ToolRecord } from '@/lib/api';
import { BILLING_PERIOD_LABEL, formatMoney, todayISO, yearStartISO } from './constants';

interface CostReportTabProps {
  initialReport: CostReport;
  tools: ToolRecord[];
  areas: string[];
}

const EMPTY: CostReport = {
  summary: {
    totalActiveLicenses: 0,
    totalMonthlyCostMXN: 0,
    totalMonthlyCostUSD: 0,
    totalAnnualCostMXN: 0,
    totalAnnualCostUSD: 0,
    costPerEmployeeMXN: 0,
    costPerEmployeeUSD: 0,
    totalEmployees: 0,
    totalTools: 0,
    totalAreas: 0,
  },
  byTool: [],
  byArea: [],
  byEmployee: [],
  timeline: [],
};

const INPUT =
  'rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none focus:border-navy';
const LABEL = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500';
const EMPLOYEE_PAGE = 20;

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-navy">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

/** Cabecera ordenable: un solo criterio a la vez, alternando asc/desc. */
function SortTh({
  label,
  active,
  dir,
  onClick,
  align = 'left',
}: {
  label: string;
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: () => void;
  align?: 'left' | 'right';
}) {
  return (
    <th className={`px-4 py-3 ${align === 'right' ? 'text-right' : ''}`}>
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1 hover:text-navy ${active ? 'text-navy' : ''}`}
      >
        {label}
        <span className="text-[10px]">{active ? (dir === 'desc' ? '▼' : '▲') : '↕'}</span>
      </button>
    </th>
  );
}

export function CostReportTab({ initialReport, tools, areas }: CostReportTabProps) {
  const [report, setReport] = useState<CostReport>(initialReport ?? EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dateFrom, setDateFrom] = useState(yearStartISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [area, setArea] = useState('');
  const [toolId, setToolId] = useState('');
  const [currency, setCurrency] = useState('');
  // Rango con el que se cargó el reporte que está en pantalla: es el que debe
  // ir en el nombre del archivo, no el que el usuario esté tecleando.
  const [applied, setApplied] = useState({ dateFrom: yearStartISO(), dateTo: todayISO() });

  const [toolDir, setToolDir] = useState<'asc' | 'desc'>('desc');
  const [areaDir, setAreaDir] = useState<'asc' | 'desc'>('desc');
  const [empDir, setEmpDir] = useState<'asc' | 'desc'>('desc');
  const [empSearch, setEmpSearch] = useState('');
  const [empShown, setEmpShown] = useState(EMPLOYEE_PAGE);

  async function applyFilters() {
    setLoading(true);
    setError(null);
    const params: CostReportParams = {};
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    if (area) params.area = area;
    if (toolId) params.toolId = toolId;
    if (currency) params.currency = currency;

    const q = new URLSearchParams(params as Record<string, string>).toString();
    try {
      const res = await fetch(`/api/assignments/cost-report${q ? `?${q}` : ''}`);
      if (!res.ok) throw new Error('El reporte no se pudo generar.');
      setReport((await res.json()) as CostReport);
      setApplied({ dateFrom, dateTo });
      setEmpShown(EMPLOYEE_PAGE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'El reporte no se pudo generar.');
    } finally {
      setLoading(false);
    }
  }

  const { summary, byTool, byArea, byEmployee } = report;

  const sortedTools = useMemo(
    () =>
      [...byTool].sort((a, b) =>
        toolDir === 'desc' ? b.totalCost - a.totalCost : a.totalCost - b.totalCost,
      ),
    [byTool, toolDir],
  );

  const sortedAreas = useMemo(
    () =>
      [...byArea].sort((a, b) => {
        const d = b.totalMonthlyCostMXN - a.totalMonthlyCostMXN;
        return areaDir === 'desc' ? d : -d;
      }),
    [byArea, areaDir],
  );

  const filteredEmployees = useMemo(() => {
    const q = empSearch.trim().toLowerCase();
    const base = q ? byEmployee.filter((e) => e.fullName.toLowerCase().includes(q)) : byEmployee;
    return [...base].sort((a, b) => {
      const d = b.totalMonthlyCostMXN - a.totalMonthlyCostMXN;
      return empDir === 'desc' ? d : -d;
    });
  }, [byEmployee, empSearch, empDir]);

  // Totales al pie: se calculan sobre lo que se está mostrando, no sobre el
  // summary, para que cuadren con las filas visibles.
  const toolTotals = useMemo(
    () =>
      byTool.reduce(
        (acc, t) => {
          if (t.currency === 'USD') acc.usd += t.totalCost;
          else acc.mxn += t.totalCost;
          return acc;
        },
        { mxn: 0, usd: 0 },
      ),
    [byTool],
  );

  const areaTotals = useMemo(
    () =>
      byArea.reduce(
        (acc, a) => {
          acc.mxn += a.totalMonthlyCostMXN;
          acc.usd += a.totalMonthlyCostUSD;
          acc.asignaciones += a.activeAssignments;
          acc.empleados += a.employees;
          return acc;
        },
        { mxn: 0, usd: 0, asignaciones: 0, empleados: 0 },
      ),
    [byArea],
  );

  // SheetJS se carga solo al exportar: son ~96 kB que no tienen por qué entrar
  // en el bundle de quien únicamente consulta el dashboard.
  async function exportExcel() {
    const XLSX = await import('xlsx');
    const periodo = `${applied.dateFrom} a ${applied.dateTo}`;
    const generado = new Date().toLocaleString('es-MX');
    const encabezado = [
      ['Lievant Admin'],
      ['Reporte de Costos de Licencias'],
      [`Período: ${periodo}`],
      [`Fecha de generación: ${generado}`],
      [],
    ];

    const wb = XLSX.utils.book_new();

    // 1 · Resumen
    const resumen = XLSX.utils.aoa_to_sheet([
      ...encabezado,
      ['Indicador', 'Valor'],
      ['Licencias activas', summary.totalActiveLicenses],
      ['Colaboradores con licencias', summary.totalEmployees],
      ['Herramientas activas', summary.totalTools],
      ['Áreas con licencias', summary.totalAreas],
      ['Costo mensual MXN', summary.totalMonthlyCostMXN],
      ['Costo mensual USD', summary.totalMonthlyCostUSD],
      ['Costo anual MXN', summary.totalAnnualCostMXN],
      ['Costo anual USD', summary.totalAnnualCostUSD],
      ['Costo por colaborador MXN', summary.costPerEmployeeMXN],
      ['Costo por colaborador USD', summary.costPerEmployeeUSD],
    ]);
    XLSX.utils.book_append_sheet(wb, resumen, 'Resumen');

    // 2 · Por herramienta
    const hojaTools = XLSX.utils.aoa_to_sheet(encabezado);
    XLSX.utils.sheet_add_json(
      hojaTools,
      sortedTools.map((t) => ({
        Código: t.toolCode,
        Herramienta: t.toolName,
        Categoría: t.category,
        Proveedor: t.provider,
        Asignaciones: t.activeAssignments,
        'Costo unitario': t.unitCost,
        Moneda: t.currency,
        Periodo: BILLING_PERIOD_LABEL[t.billingPeriod] ?? t.billingPeriod,
        'Costo mensual': t.monthlyCost,
        'Costo total mensual': t.totalCost,
      })),
      { origin: -1 },
    );
    XLSX.utils.book_append_sheet(wb, hojaTools, 'Por herramienta');

    // 3 · Por área
    const hojaAreas = XLSX.utils.aoa_to_sheet(encabezado);
    XLSX.utils.sheet_add_json(
      hojaAreas,
      sortedAreas.map((a) => ({
        Área: a.area,
        Empleados: a.employees,
        Asignaciones: a.activeAssignments,
        'Costo MXN': a.totalMonthlyCostMXN,
        'Costo USD': a.totalMonthlyCostUSD,
      })),
      { origin: -1 },
    );
    XLSX.utils.book_append_sheet(wb, hojaAreas, 'Por área');

    // 4 · Por colaborador — completa, sin la paginación de la pantalla
    const hojaEmpleados = XLSX.utils.aoa_to_sheet(encabezado);
    XLSX.utils.sheet_add_json(
      hojaEmpleados,
      byEmployee.map((e) => ({
        Empleado: e.fullName,
        Área: e.area ?? '',
        Cargo: e.position ?? '',
        Licencias: e.activeAssignments,
        'Costo MXN': e.totalMonthlyCostMXN,
        'Costo USD': e.totalMonthlyCostUSD,
        Herramientas: e.tools.join(', '),
      })),
      { origin: -1 },
    );
    XLSX.utils.book_append_sheet(wb, hojaEmpleados, 'Por colaborador');

    XLSX.writeFile(wb, `reporte-licencias-${applied.dateFrom}-${applied.dateTo}.xlsx`);
  }

  return (
    <div className="space-y-6">
      {/* ── 1 · Filtros ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className={LABEL}>Desde</label>
            <input
              type="date"
              className={INPUT}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL}>Hasta</label>
            <input
              type="date"
              className={INPUT}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL}>Área</label>
            <select className={INPUT} value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">Todas las áreas</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Herramienta</label>
            <select className={INPUT} value={toolId} onChange={(e) => setToolId(e.target.value)}>
              <option value="">Todas las herramientas</option>
              {tools.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Moneda</label>
            <select
              className={INPUT}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="">Ambas</option>
              <option value="MXN">Solo MXN</option>
              <option value="USD">Solo USD</option>
            </select>
          </div>

          <button
            onClick={applyFilters}
            disabled={loading}
            className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Generando…' : 'Aplicar filtros'}
          </button>
          <button
            onClick={exportExcel}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-navy hover:bg-slate-50"
          >
            <DownloadIcon className="h-4 w-4" />
            Exportar Excel
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      </div>

      {/* ── 2 · KPIs ────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Licencias activas" value={String(summary.totalActiveLicenses)} />
        <KpiCard
          label="Costo mensual MXN"
          value={formatMoney(summary.totalMonthlyCostMXN, 'MXN')}
        />
        <KpiCard
          label="Costo mensual USD"
          value={formatMoney(summary.totalMonthlyCostUSD, 'USD')}
        />
        <KpiCard
          label="Costo por colaborador"
          value={formatMoney(summary.costPerEmployeeMXN, 'MXN')}
          hint={`${summary.totalEmployees} colaboradores · ${formatMoney(summary.costPerEmployeeUSD, 'USD')}`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Costo anual MXN" value={formatMoney(summary.totalAnnualCostMXN, 'MXN')} />
        <KpiCard label="Costo anual USD" value={formatMoney(summary.totalAnnualCostUSD, 'USD')} />
        <KpiCard
          label="Herramientas"
          value={`${summary.totalTools} activas`}
          hint={`${summary.totalAreas} áreas`}
        />
      </div>

      {/* ── 3 · Por herramienta ─────────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          Por herramienta
        </h2>
        <ScrollableTable>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Herramienta</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Proveedor</th>
                <th className="px-4 py-3 text-right">Asignaciones</th>
                <th className="px-4 py-3 text-right">Costo unit.</th>
                <th className="px-4 py-3">Moneda</th>
                <th className="px-4 py-3">Periodo</th>
                <th className="px-4 py-3 text-right">Costo mensual</th>
                <SortTh
                  label="Costo total mensual"
                  active
                  dir={toolDir}
                  align="right"
                  onClick={() => setToolDir(toolDir === 'desc' ? 'asc' : 'desc')}
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedTools.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                    Sin asignaciones activas en el período.
                  </td>
                </tr>
              )}
              {sortedTools.map((t) => (
                <tr key={t.toolCode} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{t.toolCode}</td>
                  <td className="px-4 py-3 font-medium text-navy">{t.toolName}</td>
                  <td className="px-4 py-3 text-slate-600">{t.category}</td>
                  <td className="px-4 py-3 text-slate-600">{t.provider}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-navy">
                    {t.activeAssignments}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-navy">
                    {formatMoney(t.unitCost, t.currency)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{t.currency}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {BILLING_PERIOD_LABEL[t.billingPeriod] ?? t.billingPeriod}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-navy">
                    {formatMoney(t.monthlyCost, t.currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-navy">
                    {formatMoney(t.totalCost, t.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            {sortedTools.length > 0 && (
              <tfoot className="border-t-2 border-slate-200 bg-slate-50 text-sm font-semibold">
                <tr>
                  <td className="px-4 py-3 text-navy" colSpan={9}>
                    Total mensual
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-navy">
                    {formatMoney(toolTotals.mxn, 'MXN')}
                    {toolTotals.usd > 0 && (
                      <span className="ml-2 text-slate-500">
                        + {formatMoney(toolTotals.usd, 'USD')}
                      </span>
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </ScrollableTable>
      </div>

      {/* ── 4 · Por área ────────────────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Por área</h2>
        <ScrollableTable>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Área</th>
                <th className="px-4 py-3 text-right">Empleados</th>
                <th className="px-4 py-3 text-right">Asignaciones</th>
                <SortTh
                  label="Costo MXN"
                  active
                  dir={areaDir}
                  align="right"
                  onClick={() => setAreaDir(areaDir === 'desc' ? 'asc' : 'desc')}
                />
                <th className="px-4 py-3 text-right">Costo USD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedAreas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Sin asignaciones activas en el período.
                  </td>
                </tr>
              )}
              {sortedAreas.map((a) => (
                <tr key={a.area} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-navy">{a.area}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-navy">{a.employees}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-navy">
                    {a.activeAssignments}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-navy">
                    {formatMoney(a.totalMonthlyCostMXN, 'MXN')}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-navy">
                    {formatMoney(a.totalMonthlyCostUSD, 'USD')}
                  </td>
                </tr>
              ))}
            </tbody>
            {sortedAreas.length > 0 && (
              <tfoot className="border-t-2 border-slate-200 bg-slate-50 text-sm font-semibold">
                <tr>
                  <td className="px-4 py-3 text-navy">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums text-navy">
                    {areaTotals.empleados}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-navy">
                    {areaTotals.asignaciones}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-navy">
                    {formatMoney(areaTotals.mxn, 'MXN')}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-navy">
                    {formatMoney(areaTotals.usd, 'USD')}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </ScrollableTable>
      </div>

      {/* ── 5 · Por colaborador ─────────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Por colaborador
          </h2>
          <div className="relative min-w-[220px]">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={empSearch}
              onChange={(e) => {
                setEmpSearch(e.target.value);
                setEmpShown(EMPLOYEE_PAGE);
              }}
              placeholder="Buscar colaborador…"
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-navy"
            />
          </div>
        </div>

        <ScrollableTable>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Empleado</th>
                <th className="px-4 py-3">Área</th>
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3 text-right">Licencias</th>
                <SortTh
                  label="Costo MXN"
                  active
                  dir={empDir}
                  align="right"
                  onClick={() => setEmpDir(empDir === 'desc' ? 'asc' : 'desc')}
                />
                <th className="px-4 py-3 text-right">Costo USD</th>
                <th className="px-4 py-3">Herramientas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Sin colaboradores que coincidan.
                  </td>
                </tr>
              )}
              {filteredEmployees.slice(0, empShown).map((e) => (
                <tr key={e.employeeId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-navy">{e.fullName}</td>
                  <td className="px-4 py-3 text-slate-600">{e.area ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{e.position ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-navy">
                    {e.activeAssignments}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-navy">
                    {formatMoney(e.totalMonthlyCostMXN, 'MXN')}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-navy">
                    {formatMoney(e.totalMonthlyCostUSD, 'USD')}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.tools.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>

        {filteredEmployees.length > empShown && (
          <div className="mt-3 flex justify-center">
            <button
              onClick={() => setEmpShown(empShown + EMPLOYEE_PAGE)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-navy hover:bg-slate-50"
            >
              Cargar más ({filteredEmployees.length - empShown} restantes)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
