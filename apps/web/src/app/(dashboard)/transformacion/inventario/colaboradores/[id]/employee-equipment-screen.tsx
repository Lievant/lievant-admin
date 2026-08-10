'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CloseIcon, DownloadIcon } from '@/components/icons';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import { statusBadgeStyle, typeIcon } from '../../constants';
import { EmployeePhoto } from '../colaboradores-screen';

interface EquipmentItem {
  id: string;
  displayId: string;
  equipmentType: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  status: string;
  assignmentDate: string | null;
}

interface EmployeeDetail {
  employee: {
    id: string;
    displayId: string;
    fullName: string;
    area: string | null;
    position: string;
    corporateEmail: string | null;
    photoUrl: string | null;
    hireDate: string | null;
  };
  equipment: EquipmentItem[];
  responsiva: { code: string; generatedAt: string | null } | null;
}

function formatFecha(iso: string | null): string {
  if (!iso) return '—';
  const [anio, mes, dia] = iso.slice(0, 10).split('-');
  if (!anio || !mes || !dia) return '—';
  return `${dia}/${mes}/${anio}`;
}

/**
 * Dispara la descarga navegando a la ruta proxy. No se usa fetch + blob porque
 * el backend ya manda el Content-Disposition con el nombre correcto del archivo
 * y dejarlo al navegador evita duplicar esa lógica.
 */
function descargar(employeeId: string) {
  window.location.href = `/api/inventory/employees/${employeeId}/responsiva/download`;
}

/** Bitácora TIC-RE-10, el anexo de equipos de la responsiva. */
function descargarBitacora(employeeId: string) {
  window.location.href = `/api/inventory/employees/${employeeId}/bitacora`;
}

export function EmployeeEquipmentScreen({ employeeId }: { employeeId: string }) {
  const [detalle, setDetalle] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [generando, setGenerando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/inventory/employees/${employeeId}`);
      if (res.status === 403) {
        setError('No tienes permiso para ver el inventario.');
        return;
      }
      if (res.status === 404) {
        setError('El colaborador no existe.');
        return;
      }
      if (!res.ok) {
        setError('No se pudo cargar la información del colaborador.');
        return;
      }
      setDetalle((await res.json()) as EmployeeDetail);
      setError(null);
    } catch {
      setError('No se pudo cargar la información del colaborador.');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function generar() {
    if (generando) return;
    setGenerando(true);
    try {
      const res = await fetch(`/api/inventory/employees/${employeeId}/responsiva`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? 'No se pudo generar la responsiva.');
        setConfirmando(false);
        return;
      }
      // Se recarga antes de descargar para que el badge ya muestre el folio
      // aunque el navegador tarde en resolver la descarga.
      await cargar();
      setConfirmando(false);
      descargar(employeeId);
    } catch {
      setError('No se pudo generar la responsiva.');
      setConfirmando(false);
    } finally {
      setGenerando(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <p className="text-sm text-slate-400">Cargando…</p>
      </div>
    );
  }

  if (error && !detalle) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
        <Link
          href="/transformacion/inventario"
          className="mt-4 inline-block text-sm text-navy hover:underline"
        >
          ← Volver a Inventario
        </Link>
      </div>
    );
  }

  if (!detalle) return null;

  const { employee, equipment, responsiva } = detalle;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/transformacion/inventario"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-navy hover:text-navy"
        >
          ← Volver a Inventario
        </Link>
        <Link
          href="/transformacion/inventario/colaboradores"
          className="text-sm text-slate-500 hover:text-navy hover:underline"
        >
          Ver todos los colaboradores
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <header className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          <EmployeePhoto name={employee.fullName} photoUrl={employee.photoUrl} size="lg" />

          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-navy">{employee.fullName}</h1>
            <p className="text-sm text-slate-600">{employee.position || 'Sin cargo'}</p>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
              <span>
                <span className="font-medium text-slate-400">Área:</span> {employee.area ?? '—'}
              </span>
              <span>
                <span className="font-medium text-slate-400">Ingreso:</span>{' '}
                {formatFecha(employee.hireDate)}
              </span>
              <span>
                <span className="font-medium text-slate-400">No. empleado:</span>{' '}
                {employee.displayId}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                responsiva
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                  : 'bg-rose-50 text-rose-700 ring-rose-200'
              }`}
            >
              {responsiva ? `Responsiva: ${responsiva.code}` : 'Sin responsiva'}
            </span>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {responsiva ? (
                <button
                  type="button"
                  onClick={() => descargar(employeeId)}
                  className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90"
                >
                  <DownloadIcon className="h-4 w-4" />
                  Descargar responsiva
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmando(true)}
                  className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90"
                >
                  Generar responsiva
                </button>
              )}

              {/* La bitácora lleva impreso el folio de la responsiva, así que
                  sin folio no hay documento que generar. */}
              <button
                type="button"
                onClick={() => descargarBitacora(employeeId)}
                disabled={!responsiva}
                title={
                  responsiva
                    ? 'Bitácora de asignación de equipos TIC-RE-10'
                    : 'Genera primero la carta responsiva'
                }
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-navy hover:border-navy disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200"
              >
                <DownloadIcon className="h-4 w-4" />
                Descargar bitácora
              </button>
            </div>
          </div>
        </div>
      </header>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Equipos asignados ({equipment.length})
      </h2>

      {equipment.length === 0 ? (
        <p className="text-sm text-slate-400">Este colaborador no tiene equipos asignados.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <ScrollableTable>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Marca</th>
                  <th className="px-4 py-3">Modelo</th>
                  <th className="px-4 py-3">Serie</th>
                  <th className="px-4 py-3">Asignación</th>
                  <th className="px-4 py-3">Estatus</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {equipment.map((eq) => (
                  <tr key={eq.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{eq.displayId}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <i className={`ti ${typeIcon(eq.equipmentType)} text-slate-400`} />
                        <span className="text-slate-700">{eq.equipmentType}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-navy">{eq.brand ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{eq.model ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {eq.serialNumber ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatFecha(eq.assignmentDate)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeStyle(eq.status)}`}
                      >
                        {eq.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/transformacion/inventario/${eq.id}`}
                        className="text-xs font-medium text-black hover:underline"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        </div>
      )}

      {confirmando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="font-bold text-navy">Generar carta responsiva</h2>
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                disabled={generando}
                className="text-slate-400 hover:text-navy disabled:opacity-60"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-slate-600">
                ¿Generar carta responsiva para{' '}
                <span className="font-semibold text-navy">{employee.fullName}</span>?
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Se asignará el siguiente folio TIC-RE-02 disponible y el documento se descargará
                automáticamente. El folio queda ligado al colaborador de forma permanente.
              </p>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setConfirmando(false)}
                  disabled={generando}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void generar()}
                  disabled={generando}
                  className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {generando ? 'Generando…' : 'Generar y descargar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
