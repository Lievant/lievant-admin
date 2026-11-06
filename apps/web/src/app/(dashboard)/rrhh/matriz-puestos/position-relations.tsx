'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { readError } from './position-form-dialog';
import { PositionSearch } from './position-search';
import { employeesCountLabel, positionRefLabel, relationsChanged, type PositionDetail, type PositionEmployee, type PositionRef } from './positions-constants';

const LABEL = 'text-xs font-semibold uppercase tracking-wide text-slate-500';
const CARD = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm';

function PositionLink({ p }: { p: PositionRef }) {
  return (
    <Link href={`/rrhh/matriz-puestos/${p.id}`} className="font-medium text-black underline-offset-2 hover:underline">
      {p.title}
      <span className="ml-1 text-xs font-normal text-slate-500">{[p.code, p.area].filter(Boolean).join(' · ')}</span>
    </Link>
  );
}

function LinkList({ items, empty }: { items: PositionRef[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-slate-400">{empty}</p>;
  return (
    <ul className="space-y-1 text-sm">
      {items.map((p) => <li key={p.id}><PositionLink p={p} /></li>)}
    </ul>
  );
}

/**
 * Sección «Relaciones» del puesto: «Reporta a (Puesto)» (selección única) y «Supervisa a» (selección múltiple con chips),
 * editables con permiso de editar la Matriz y de solo lectura en otro caso; debajo, quiénes le reportan y quién lo supervisa.
 */
export function RelationsSection({ position, canUpdate, onSaved }: { position: PositionDetail; canUpdate: boolean; onSaved: () => void }) {
  const [reportsTo, setReportsTo] = useState<PositionRef | null>(position.reportsToPosition);
  const [supervises, setSupervises] = useState<PositionRef[]>(position.supervises);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Si el puesto se recarga (guardar, otra edición), el borrador vuelve a lo guardado.
  useEffect(() => {
    setReportsTo(position.reportsToPosition);
    setSupervises(position.supervises);
  }, [position.reportsToPosition, position.supervises]);

  const dirty = relationsChanged({ reportsTo, supervises }, { reportsTo: position.reportsToPosition, supervises: position.supervises });

  const save = async () => {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch(`/api/hr/job-positions/${position.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportsToPositionId: reportsTo?.id ?? null, supervisesPositionIds: supervises.map((s) => s.id) }),
      });
      if (!res.ok) throw new Error(await readError(res, 'No se pudieron guardar las relaciones.'));
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar las relaciones.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-navy">Relaciones</h2>
        {canUpdate && (
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="rounded-md bg-black px-3 py-1.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar Relaciones'}
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="rel-reports" className={LABEL}>Reporta a (Puesto)</label>
          {reportsTo ? (
            <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-navy">
              <span className="min-w-0 truncate"><PositionLink p={reportsTo} /></span>
              {canUpdate && <button type="button" onClick={() => setReportsTo(null)} className="shrink-0 text-xs font-medium text-red-600 hover:underline">Quitar</button>}
            </div>
          ) : canUpdate ? (
            <PositionSearch id="rel-reports" excludeIds={[position.id]} onPick={setReportsTo} placeholder="Busca un puesto…" />
          ) : (
            <p id="rel-reports" className="text-sm text-slate-400">—</p>
          )}
          {position.reportsTo && !reportsTo && <p className="text-xs text-slate-500">Texto del Excel: {position.reportsTo}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="rel-supervises" className={LABEL}>Supervisa a</label>
          {canUpdate && (
            <PositionSearch id="rel-supervises" excludeIds={[position.id, ...supervises.map((s) => s.id)]} onPick={(p) => setSupervises((cur) => [...cur, p])} placeholder="Busca un puesto para agregarlo…" />
          )}
          {supervises.length === 0 ? (
            !canUpdate && <p className="text-sm text-slate-400">—</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Puestos que supervisa">
              {supervises.map((s) => (
                <li key={s.id} className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-navy">
                  <Link href={`/rrhh/matriz-puestos/${s.id}`} title={positionRefLabel(s)} className="break-words hover:underline">{s.title}</Link>
                  {canUpdate && (
                    <button type="button" onClick={() => setSupervises((cur) => cur.filter((x) => x.id !== s.id))} aria-label={`Quitar ${s.title}`} className="rounded-full px-1 text-slate-500 hover:bg-slate-200 hover:text-navy">×</button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {position.supervisesText && <p className="mt-1 text-xs text-slate-500">Texto del Excel: {position.supervisesText}</p>}
        </div>
      </div>

      {error && <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && !error && !dirty && <p role="status" className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Relaciones guardadas.</p>}

      <div className="mt-5 grid grid-cols-1 gap-5 border-t border-slate-100 pt-4 lg:grid-cols-2">
        <div>
          <h3 className={LABEL}>Reportan a Este Puesto</h3>
          <div className="mt-2"><LinkList items={position.directReports} empty="Ningún puesto le reporta." /></div>
        </div>
        <div>
          <h3 className={LABEL}>Supervisado Por</h3>
          <div className="mt-2"><LinkList items={position.supervisedBy} empty="Ningún puesto lo supervisa." /></div>
        </div>
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = { active: 'Activo', inactive: 'Inactivo' };

/** Colaboradores que tienen este puesto asignado (activos, solo datos básicos). El nombre enlaza al expediente solo con permiso. */
export function EmployeesSection({ position, canViewEmployees }: { position: PositionDetail; canViewEmployees: boolean }) {
  const list: PositionEmployee[] = position.employees;
  return (
    <div className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-navy">Colaboradores con Este Puesto</h2>
        <p className={cn('text-sm font-medium', list.length === 0 ? 'text-slate-400' : 'text-navy')}>{employeesCountLabel(position.employeesCount, position.plazas)}</p>
      </div>
      {list.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
          <p>Ningún colaborador tiene este puesto asignado todavía.</p>
          <p className="mt-1 text-xs text-slate-400">Se vincula desde el expediente del colaborador (pestaña Desarrollo Organizacional › Vincular/Cambiar Puesto).</p>
        </div>
      ) : (
        <div className="mt-4 max-w-full overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {['Nombre', 'Cargo', 'Área', 'Estatus'].map((c) => <th key={c} className="whitespace-nowrap px-3 py-2">{c}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((e) => (
                <tr key={e.id}>
                  <td className="px-3 py-2 font-medium text-navy">
                    {canViewEmployees ? <Link href={`/rrhh/empleados/${e.id}`} className="hover:underline">{e.fullName}</Link> : e.fullName}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{e.position || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{e.area ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{STATUS_LABEL[e.status] ?? e.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {position.employeesCount > list.length && (
        <p className="mt-2 text-xs text-slate-400">Se muestran los primeros {list.length} de {position.employeesCount} colaboradores.</p>
      )}
    </div>
  );
}
