'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { PlusIcon, TrashIcon } from '@/components/icons';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import type {
  CardExpenseReportItem,
  CardReportPayload,
  CreditCardItem,
  ExpenseCatalogs,
} from '@/lib/api';
import {
  createCardReportAction,
  submitCardReportAction,
  updateCardReportAction,
} from '../actions';
import { DocumentHeader, Hint, describeCard, money } from '../card-shared';

interface DraftLine {
  key: string;
  persistedId: string | null;
  lineDate: string;
  collaborator: string;
  motive: string;
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
  report: CardExpenseReportItem | null;
}

let keySeq = 0;
const nextKey = () => `c${++keySeq}`;

function emptyLine(): DraftLine {
  return {
    key: nextKey(),
    persistedId: null,
    lineDate: '',
    collaborator: '',
    motive: '',
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

function toNumber(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const inputClass =
  'w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black';
const fieldClass =
  'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black';
const labelClass = 'text-xs font-semibold uppercase tracking-wide text-slate-500';

export function CardExpenseForm({ report }: Props) {
  const router = useRouter();
  const [cards, setCards] = useState<CreditCardItem[]>([]);
  const [catalogs, setCatalogs] = useState<ExpenseCatalogs | null>(null);

  const [creditCardId, setCreditCardId] = useState(report?.creditCardId ?? '');
  const [department, setDepartment] = useState(report?.department ?? '');
  const [periodStart, setPeriodStart] = useState(report?.periodStart?.slice(0, 10) ?? '');
  const [periodEnd, setPeriodEnd] = useState(report?.periodEnd?.slice(0, 10) ?? '');
  const [observations, setObservations] = useState(report?.observations ?? '');

  const [lines, setLines] = useState<DraftLine[]>(
    report?.lines?.length
      ? report.lines.map((l) => ({
          key: nextKey(),
          persistedId: l.id,
          lineDate: l.lineDate.slice(0, 10),
          collaborator: l.collaborator ?? '',
          motive: l.motive ?? '',
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
        const [resCards, resCat] = await Promise.all([
          fetch('/api/credit-cards/active'),
          fetch('/api/expenses/catalogs'),
        ]);
        if (resCards.ok) setCards((await resCards.json()) as CreditCardItem[]);
        if (resCat.ok) setCatalogs((await resCat.json()) as ExpenseCatalogs);
      } catch {
        /* los selects quedan vacíos; el resto del formulario sigue usable */
      }
    })();
  }, []);

  const selectedCard = cards.find((c) => c.id === creditCardId) ?? report?.creditCard ?? null;

  const totals = lines.reduce(
    (acc, l) => {
      const s = toNumber(l.subtotal);
      const t = toNumber(l.tip);
      const e = toNumber(l.extras);
      return {
        subtotal: acc.subtotal + s,
        tip: acc.tip + t,
        extras: acc.extras + e,
        total: acc.total + s + t + e,
      };
    },
    { subtotal: 0, tip: 0, extras: 0, total: 0 },
  );

  function patchLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function buildPayload(): CardReportPayload | null {
    if (!creditCardId) {
      setError('Selecciona la tarjeta utilizada.');
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
    if (lines.some((l) => !l.lineDate || !l.vendor.trim())) {
      setError('Cada línea necesita al menos fecha y proveedor. Elimina las líneas vacías.');
      return null;
    }

    setError(null);
    return {
      creditCardId,
      ...(department ? { department } : {}),
      periodStart,
      periodEnd,
      ...(observations.trim() ? { observations: observations.trim() } : {}),
      lines: lines.map((l, index) => ({
        // El id viaja para que el servidor actualice la línea en su lugar y no
        // pierda la factura que ya se subió contra ella.
        ...(l.persistedId ? { id: l.persistedId } : {}),
        lineDate: l.lineDate,
        ...(l.collaborator.trim() ? { collaborator: l.collaborator.trim() } : {}),
        ...(l.motive.trim() ? { motive: l.motive.trim() } : {}),
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

  async function save(): Promise<string | null> {
    const payload = buildPayload();
    if (!payload) return null;

    const res = report
      ? await updateCardReportAction(report.id, payload)
      : await createCardReportAction(payload);

    if (!res.success) {
      setError(res.error ?? 'No se pudo guardar el reporte.');
      return null;
    }
    return res.id ?? report?.id ?? null;
  }

  function handleSaveDraft() {
    startTransition(async () => {
      const id = await save();
      if (id) router.push(`/herramientas/mis-gastos-tarjeta/${id}`);
    });
  }

  function handleSubmitToFinance() {
    startTransition(async () => {
      // Se guarda antes de enviar: si no, los cambios en pantalla no viajarían.
      const id = await save();
      if (!id) return;
      const res = await submitCardReportAction(id);
      if (res.success) {
        router.push(`/herramientas/mis-gastos-tarjeta/${id}`);
      } else {
        setConfirmSubmit(false);
        setError(res.error ?? 'No se pudo enviar el reporte.');
      }
    });
  }

  return (
    <div className="space-y-5">
      <DocumentHeader
        {...(report
          ? {
              code: report.documentCode,
              version: report.documentVersion,
              classification: report.documentClassification,
            }
          : { code: 'FIN-RE-06' })}
        title="Reporte de Gastos"
      />

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <div className="flex items-center">
              <label className={labelClass} htmlFor="tarjeta">
                Tarjeta de crédito
              </label>
              <Hint text="Selecciona la tarjeta corporativa utilizada" />
            </div>
            <select
              id="tarjeta"
              value={creditCardId}
              onChange={(e) => setCreditCardId(e.target.value)}
              className={fieldClass}
            >
              <option value="">Selecciona…</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {describeCard(c)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelClass}>Titular</label>
            <p className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {selectedCard?.holderEmployee?.fullName ?? '—'}
            </p>
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
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <ScrollableTable>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-3 text-left">Fecha</th>
                <th className="px-3 py-3 text-left">
                  Colaborador
                  <Hint text="Nombre del colaborador que realizó o se benefició del gasto" />
                </th>
                <th className="px-3 py-3 text-left">
                  Motivo/Evento
                  <Hint text="Especifica el evento, junta o motivo del gasto" />
                </th>
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
                <th className="px-3 py-3 text-right">✕</th>
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
                        value={line.collaborator}
                        onChange={(e) => patchLine(line.key, { collaborator: e.target.value })}
                        className={inputClass}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={line.motive}
                        onChange={(e) => patchLine(line.key, { motive: e.target.value })}
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
                <td colSpan={5} className="px-3 py-3 text-right uppercase tracking-wide text-slate-500">
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

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-1 flex items-center">
          <label className={labelClass} htmlFor="observaciones">
            Observaciones
          </label>
          <Hint text="Indica si hay cargos a repartir entre áreas y el % correspondiente" />
        </div>
        <textarea
          id="observaciones"
          rows={3}
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          className={fieldClass}
        />
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
          Enviar a Finanzas
        </button>
      </div>

      {confirmSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-navy">¿Enviar a Finanzas?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Se enviará el reporte de la tarjeta {selectedCard ? `•••• ${selectedCard.lastFour}` : ''} por{' '}
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
                onClick={handleSubmitToFinance}
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

/** Igual que en reembolsos: sin línea guardada no hay ruta a la que subir. */
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
      const res = await fetch(
        `/api/credit-cards/reports/${reportId}/lines/${line.persistedId}/invoice`,
        { method: 'POST', body },
      );
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
