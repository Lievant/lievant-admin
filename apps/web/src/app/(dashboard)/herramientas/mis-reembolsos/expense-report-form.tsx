'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import {
  EmployeePicker,
  type EmployeePickerValue,
} from '@/app/(dashboard)/rrhh/empleados/employee-picker';
import { PlusIcon, TrashIcon } from '@/components/icons';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import type { ExpenseCatalogs, ExpenseReportItem, ExpenseReportPayload } from '@/lib/api';
import {
  createExpenseReportAction,
  submitExpenseReportAction,
  updateExpenseReportAction,
} from './actions';
import { DocumentHeader, Hint, money } from './expense-shared';

/** Línea en edición. `persistedId` solo existe si ya está guardada en la BD. */
interface DraftLine {
  key: string;
  persistedId: string | null;
  lineDate: string;
  vendor: string;
  conceptId: string;
  expenseTypeId: string;
  subtotal: string;
  tip: string;
  extras: string;
  hasInvoice: boolean;
  invoiceOriginalName: string | null;
}

interface Props {
  requesterName: string;
  report: ExpenseReportItem | null;
}

let keySeq = 0;
const nextKey = () => `l${++keySeq}`;

function emptyLine(): DraftLine {
  return {
    key: nextKey(),
    persistedId: null,
    lineDate: '',
    vendor: '',
    conceptId: '',
    expenseTypeId: '',
    subtotal: '',
    tip: '',
    extras: '',
    hasInvoice: false,
    invoiceOriginalName: null,
  };
}

function toNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const inputClass =
  'w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black';
const fieldClass =
  'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black';
const labelClass = 'text-xs font-semibold uppercase tracking-wide text-slate-500';

export function ExpenseReportForm({ requesterName, report }: Props) {
  const router = useRouter();
  const [catalogs, setCatalogs] = useState<ExpenseCatalogs | null>(null);

  const [authorizer, setAuthorizer] = useState<EmployeePickerValue | null>(
    report?.authorizerEmployee
      ? {
          id: report.authorizerEmployee.id,
          fullName: report.authorizerEmployee.fullName,
          position: '',
          area: null,
          location: null,
          corporateEmail: null,
        }
      : null,
  );
  const [department, setDepartment] = useState(report?.department ?? '');
  const [motive, setMotive] = useState(report?.motive ?? '');
  const [periodStart, setPeriodStart] = useState(report?.periodStart?.slice(0, 10) ?? '');
  const [periodEnd, setPeriodEnd] = useState(report?.periodEnd?.slice(0, 10) ?? '');

  const [lines, setLines] = useState<DraftLine[]>(
    report?.lines?.length
      ? report.lines.map((l) => ({
          key: nextKey(),
          persistedId: l.id,
          lineDate: l.lineDate.slice(0, 10),
          vendor: l.vendor,
          conceptId: l.conceptId ?? '',
          expenseTypeId: l.expenseTypeId ?? '',
          subtotal: String(Number(l.subtotal)),
          tip: String(Number(l.tip)),
          extras: String(Number(l.extras)),
          hasInvoice: l.hasInvoice,
          invoiceOriginalName: l.invoiceOriginalName,
        }))
      : [emptyLine()],
  );

  const [error, setError] = useState<string | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/expenses/catalogs');
        if (res.ok) setCatalogs((await res.json()) as ExpenseCatalogs);
      } catch {
        /* los selects quedan vacíos; el resto del formulario sigue usable */
      }
    })();
  }, []);

  const totals = lines.reduce(
    (acc, l) => {
      const subtotal = toNumber(l.subtotal);
      const tip = toNumber(l.tip);
      const extras = toNumber(l.extras);
      return {
        subtotal: acc.subtotal + subtotal,
        tip: acc.tip + tip,
        extras: acc.extras + extras,
        total: acc.total + subtotal + tip + extras,
      };
    },
    { subtotal: 0, tip: 0, extras: 0, total: 0 },
  );

  function patchLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function buildPayload(): ExpenseReportPayload | null {
    if (!motive.trim()) {
      setError('El motivo es obligatorio.');
      return null;
    }
    if (!periodStart || !periodEnd) {
      setError('Indica la fecha de inicio y de término del período.');
      return null;
    }
    if (periodEnd < periodStart) {
      setError('La fecha de término no puede ser anterior a la de inicio.');
      return null;
    }

    const usable = lines.filter((l) => l.lineDate && l.vendor.trim());
    if (usable.length !== lines.length) {
      setError('Cada línea necesita al menos fecha y proveedor. Elimina las líneas vacías.');
      return null;
    }

    setError(null);
    return {
      ...(authorizer ? { authorizerEmployeeId: authorizer.id } : {}),
      ...(department ? { department } : {}),
      motive: motive.trim(),
      periodStart,
      periodEnd,
      lines: usable.map((l, index) => ({
        lineDate: l.lineDate,
        vendor: l.vendor.trim(),
        ...(l.conceptId ? { conceptId: l.conceptId } : {}),
        ...(l.expenseTypeId ? { expenseTypeId: l.expenseTypeId } : {}),
        subtotal: toNumber(l.subtotal),
        tip: toNumber(l.tip),
        extras: toNumber(l.extras),
        sortOrder: index,
      })),
    };
  }

  /** Guarda y devuelve el id, o null si falló. */
  async function save(): Promise<string | null> {
    const payload = buildPayload();
    if (!payload) return null;

    const res = report
      ? await updateExpenseReportAction(report.id, payload)
      : await createExpenseReportAction(payload);

    if (!res.success) {
      setError(res.error ?? 'No se pudo guardar el reporte.');
      return null;
    }
    return res.id ?? report?.id ?? null;
  }

  function handleSaveDraft() {
    startTransition(async () => {
      const id = await save();
      if (id) router.push(`/herramientas/mis-reembolsos/${id}`);
    });
  }

  function handleSubmitForAuthorization() {
    startTransition(async () => {
      // Se guarda antes de enviar: si no, los cambios en pantalla no viajarían.
      const id = await save();
      if (!id) return;

      const res = await submitExpenseReportAction(id);
      if (res.success) {
        router.push(`/herramientas/mis-reembolsos/${id}`);
      } else {
        setConfirmSubmit(false);
        setError(res.error ?? 'No se pudo enviar el reporte.');
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* En un reporte nuevo aún no hay códigos guardados: DocumentHeader usa
          sus valores por defecto (FIN-RE-07 / 00 / C2). */}
      <DocumentHeader
        {...(report
          ? {
              code: report.documentCode,
              version: report.documentVersion,
              classification: report.documentClassification,
            }
          : {})}
      />

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* ── Encabezado ─────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Solicitante</label>
            <p className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {requesterName}
            </p>
          </div>

          <div>
            <div className="mb-1 flex items-center">
              <span className={labelClass}>Autorizado por</span>
              <Hint text="Selecciona tu Director de División, Head de Unidad o Jefe directo" />
            </div>
            <EmployeePicker label="" value={authorizer} onSelect={setAuthorizer} />
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelClass} htmlFor="departamento">
              Departamento
            </label>
            <select
              id="departamento"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className={fieldClass}
            >
              <option value="">Selecciona…</option>
              {catalogs?.departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className={labelClass} htmlFor="inicio">
                Fecha de inicio
              </label>
              <input
                id="inicio"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className={fieldClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass} htmlFor="termino">
                Fecha de término
              </label>
              <input
                id="termino"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className={fieldClass}
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="mb-1 flex items-center">
              <label className={labelClass} htmlFor="motivo">
                Motivo / Evento
              </label>
              <Hint text="Especifica si fue cobertura, tipo de evento, junta y/o cliente visitado" />
            </div>
            <textarea
              id="motivo"
              rows={2}
              value={motive}
              onChange={(e) => setMotive(e.target.value)}
              className={fieldClass}
            />
          </div>
        </div>
      </section>

      {/* ── Tabla de gastos ────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <ScrollableTable>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-3 text-left">Fecha</th>
                <th className="px-3 py-3 text-left">
                  Proveedor
                  <Hint text="Nombre de locación o razón social de la factura" />
                </th>
                <th className="px-3 py-3 text-left">Concepto</th>
                <th className="px-3 py-3 text-right">
                  Subtotal
                  <Hint text="Monto antes de impuestos y cargos adicionales" />
                </th>
                <th className="px-3 py-3 text-right">Propina</th>
                <th className="px-3 py-3 text-right">
                  Extras
                  <Hint text="Cargos adicionales como estacionamiento, servicio, IVA" />
                </th>
                <th className="px-3 py-3 text-right">Total</th>
                <th className="px-3 py-3 text-left">Tipo de gasto</th>
                <th className="px-3 py-3 text-center">
                  Factura
                  <Hint text="Sube el comprobante fiscal. Formatos: PDF, JPG, PNG" />
                </th>
                <th className="px-3 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((line) => {
                const total = toNumber(line.subtotal) + toNumber(line.tip) + toNumber(line.extras);
                return (
                  <tr key={line.key}>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={line.lineDate}
                        onChange={(e) => patchLine(line.key, { lineDate: e.target.value })}
                        className={inputClass}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={line.vendor}
                        onChange={(e) => patchLine(line.key, { vendor: e.target.value })}
                        className={inputClass}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={line.conceptId}
                        onChange={(e) => patchLine(line.key, { conceptId: e.target.value })}
                        className={inputClass}
                      >
                        <option value="">—</option>
                        {catalogs?.concepts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    {(['subtotal', 'tip', 'extras'] as const).map((field) => (
                      <td key={field} className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line[field]}
                          onChange={(e) => patchLine(line.key, { [field]: e.target.value })}
                          className={`${inputClass} text-right`}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold text-navy">{money(total)}</td>
                    <td className="px-3 py-2">
                      <select
                        value={line.expenseTypeId}
                        onChange={(e) => patchLine(line.key, { expenseTypeId: e.target.value })}
                        className={inputClass}
                      >
                        <option value="">—</option>
                        {catalogs?.types.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <InvoiceCell
                        reportId={report?.id ?? null}
                        line={line}
                        onUploaded={(name) =>
                          patchLine(line.key, { hasInvoice: true, invoiceOriginalName: name })
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                        disabled={lines.length === 1}
                        className="text-slate-400 transition hover:text-rose-600 disabled:opacity-30"
                        aria-label="Eliminar línea"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 text-sm font-semibold text-navy">
              <tr>
                <td colSpan={3} className="px-3 py-3 text-right uppercase tracking-wide text-slate-500">
                  Totales
                </td>
                <td className="px-3 py-3 text-right">{money(totals.subtotal)}</td>
                <td className="px-3 py-3 text-right">{money(totals.tip)}</td>
                <td className="px-3 py-3 text-right">{money(totals.extras)}</td>
                <td className="px-3 py-3 text-right">{money(totals.total)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </ScrollableTable>

        <div className="border-t border-slate-100 px-3 py-3">
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, emptyLine()])}
            className="inline-flex items-center gap-1.5 rounded-md border border-black/30 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-black transition hover:bg-zinc-800 hover:text-white"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Agregar línea
          </button>
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={isPending}
          className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {isPending ? 'Guardando…' : 'Guardar borrador'}
        </button>
        <button
          type="button"
          onClick={() => setConfirmSubmit(true)}
          disabled={isPending}
          className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
        >
          Enviar para autorización
        </button>
      </div>

      {confirmSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-navy">¿Enviar para autorización?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Se enviará a {authorizer?.fullName ?? 'tu autorizador'} por un total de{' '}
              <span className="font-semibold text-navy">{money(totals.total)}</span>. Una vez
              enviado ya no podrás editarlo.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmSubmit(false)}
                disabled={isPending}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmitForAuthorization}
                disabled={isPending}
                className="rounded-md bg-black px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {isPending ? 'Enviando…' : 'Sí, enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * La factura se sube contra una línea que ya existe en la BD, así que en un
 * reporte nuevo (o en una línea recién agregada) primero hay que guardar: sin
 * lineId no hay ruta a la que subir.
 */
function InvoiceCell({
  reportId,
  line,
  onUploaded,
}: {
  reportId: string | null;
  line: DraftLine;
  onUploaded: (name: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!reportId || !line.persistedId) {
    return (
      <span className="text-[11px] text-slate-400" title="Guarda el borrador para poder adjuntar la factura">
        Guarda primero
      </span>
    );
  }

  async function handleFile(file: File) {
    setUploading(true);
    setFailed(false);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`/api/expenses/${reportId}/lines/${line.persistedId}/invoice`, {
        method: 'POST',
        body,
      });
      if (res.ok) onUploaded(file.name);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title={line.invoiceOriginalName ?? 'Subir comprobante'}
        className={`text-xs font-medium ${
          failed ? 'text-rose-600' : line.hasInvoice ? 'text-emerald-600' : 'text-slate-500'
        } hover:underline disabled:opacity-50`}
      >
        {uploading ? '…' : failed ? 'Error' : line.hasInvoice ? '✓ Factura' : '📎 Subir'}
      </button>
    </>
  );
}
