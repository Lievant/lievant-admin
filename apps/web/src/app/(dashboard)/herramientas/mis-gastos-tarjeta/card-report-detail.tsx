'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { EyeIcon } from '@/components/icons';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import type { CardExpenseLineItem, CardExpenseReportItem } from '@/lib/api';
import { processCardReportAction, submitCardReportAction } from './actions';
import {
  CardStatusBadge,
  DocumentHeader,
  describeCard,
  formatDate,
  formatDateTime,
  money,
} from './card-shared';

interface Props {
  report: CardExpenseReportItem;
  viewer: { isCreator: boolean; canProcess: boolean };
  backHref: string;
}

export function CardReportDetail({ report, viewer, backHref }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showPayment, setShowPayment] = useState(false);
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  const puedeEnviar = viewer.isCreator && report.status === 'draft';
  const puedeProcesar = viewer.canProcess && report.status === 'submitted';

  function run(fn: () => Promise<{ success: boolean; error?: string }>, fallback: string) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.success) {
        setShowPayment(false);
        router.refresh();
      } else {
        setError(res.error ?? fallback);
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={backHref} className="text-sm text-slate-500 hover:underline">
          ← Volver
        </Link>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-slate-500">{report.reportNumber}</span>
          <CardStatusBadge status={report.status} />
        </div>
      </div>

      <DocumentHeader
        code={report.documentCode}
        version={report.documentVersion}
        classification={report.documentClassification}
        title="Reporte de Gastos"
      />

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <Timeline report={report} />
      </section>

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
        <Field label="Tarjeta" value={describeCard(report.creditCard)} />
        <Field label="Titular" value={report.creditCard?.holderEmployee?.fullName ?? '—'} />
        <Field
          label="Creado por"
          value={report.creatorEmployee?.fullName ?? report.creator?.name ?? '—'}
        />
        <Field label="Departamento" value={report.department ?? '—'} />
        <Field
          label="Período"
          value={`${formatDate(report.periodStart)} – ${formatDate(report.periodEnd)}`}
        />
        {report.status === 'processed' && (
          <>
            <Field label="Fecha de pago" value={formatDate(report.paymentDate)} />
            <Field label="Nota de pago" value={report.paymentNote ?? '—'} />
          </>
        )}
        {report.observations && (
          <div className="md:col-span-2">
            <Field label="Observaciones" value={report.observations} />
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <ScrollableTable>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-3 text-left">Fecha</th>
                <th className="px-3 py-3 text-left">Colaborador</th>
                <th className="px-3 py-3 text-left">Motivo/Evento</th>
                <th className="px-3 py-3 text-left">Proveedor</th>
                <th className="px-3 py-3 text-left">Concepto</th>
                <th className="px-3 py-3 text-right">Subtotal</th>
                <th className="px-3 py-3 text-right">Propina</th>
                <th className="px-3 py-3 text-right">Extras</th>
                <th className="px-3 py-3 text-right">Total</th>
                <th className="px-3 py-3 text-left">Tipo de gasto</th>
                <th className="px-3 py-3 text-center">Factura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(report.lines ?? []).map((line) => (
                <tr key={line.id}>
                  <td className="px-3 py-2 text-slate-600">{formatDate(line.lineDate)}</td>
                  <td className="px-3 py-2 text-slate-600">{line.collaborator ?? '—'}</td>
                  <td className="max-w-[14rem] truncate px-3 py-2 text-slate-600" title={line.motive ?? ''}>
                    {line.motive ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{line.vendor}</td>
                  <td className="px-3 py-2 text-slate-600">{line.conceptName ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{money(line.subtotal)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{money(line.tip)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{money(line.extras)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-navy">{money(line.total)}</td>
                  <td className="px-3 py-2 text-slate-600">{line.expenseTypeName ?? '—'}</td>
                  <td className="px-3 py-2 text-center">
                    <InvoiceLink line={line} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 text-sm font-semibold text-navy">
              <tr>
                <td colSpan={5} className="px-3 py-3 text-right uppercase tracking-wide text-slate-500">
                  Totales
                </td>
                <td className="px-3 py-3 text-right">{money(report.totalSubtotal)}</td>
                <td className="px-3 py-3 text-right">{money(report.totalTip)}</td>
                <td className="px-3 py-3 text-right">{money(report.totalExtras)}</td>
                <td className="px-3 py-3 text-right">{money(report.totalAmount)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </ScrollableTable>
      </section>

      {(puedeEnviar || puedeProcesar) && (
        <section className="flex flex-wrap justify-end gap-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          {puedeEnviar && (
            <>
              <Link
                href={`/herramientas/mis-gastos-tarjeta/${report.id}/editar`}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Editar
              </Link>
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  run(() => submitCardReportAction(report.id), 'No se pudo enviar el reporte.')
                }
                className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                Enviar a Finanzas
              </button>
            </>
          )}
          {puedeProcesar && (
            <button
              type="button"
              onClick={() => setShowPayment(true)}
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
            >
              Registrar procesado
            </button>
          )}
        </section>
      )}

      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-navy">Registrar procesado</h3>
            <p className="mt-1 text-sm text-slate-500">
              {report.reportNumber} — {money(report.totalAmount)}
            </p>

            <div className="mt-4 space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="fecha-pago">
                  Fecha de pago
                </label>
                <input
                  id="fecha-pago"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="nota-pago">
                  Nota (opcional)
                </label>
                <textarea
                  id="nota-pago"
                  rows={2}
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPayment(false)}
                disabled={isPending}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isPending || !paymentDate}
                onClick={() =>
                  run(
                    () => processCardReportAction(report.id, paymentDate, paymentNote),
                    'No se pudo registrar el pago.',
                  )
                }
                className="rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {isPending ? 'Guardando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Timeline({ report }: { report: CardExpenseReportItem }) {
  const steps = [
    { label: 'Creado', at: report.createdAt, done: true },
    { label: 'Enviado a Finanzas', at: report.submittedAt, done: report.status !== 'draft' },
    { label: 'Procesado', at: report.processedAt, done: report.status === 'processed' },
  ];

  return (
    <ol className="flex flex-wrap gap-4">
      {steps.map((step) => (
        <li key={step.label} className="flex min-w-[10rem] flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${step.done ? 'bg-emerald-500' : 'bg-slate-200'}`}
            />
            <span className={`text-xs font-semibold ${step.done ? 'text-navy' : 'text-slate-400'}`}>
              {step.label}
            </span>
          </div>
          <span className="pl-[1.125rem] text-xs text-slate-400">
            {step.done ? formatDateTime(step.at) : 'Pendiente'}
          </span>
        </li>
      ))}
    </ol>
  );
}

function InvoiceLink({ line }: { line: CardExpenseLineItem }) {
  if (!line.hasInvoice) return <span className="text-xs text-slate-400">Sin factura</span>;

  if (!line.invoiceUrl) {
    return (
      <span className="text-xs text-amber-600" title="El comprobante existe pero no se pudo generar el enlace">
        No disponible
      </span>
    );
  }

  return (
    <a
      href={line.invoiceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline"
      title={line.invoiceOriginalName ?? 'Ver factura'}
    >
      <EyeIcon className="h-3.5 w-3.5" />
      Ver factura
    </a>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-sm text-slate-700">{value}</span>
    </div>
  );
}
