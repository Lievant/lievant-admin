'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatPct, periodLabel } from '@/app/(dashboard)/rrhh/matriz-puestos/positions-constants';

interface TeamMember { employeeId: string; fullName: string; position: string | null; assigned: number; evaluated: number }
interface TeamResponse { period: string; editable: boolean; team: TeamMember[] }
interface MemberOkr {
  employeeOkrId: string;
  objectiveCode: string | null;
  krCode: string | null;
  objective: string;
  keyResult: string;
  weight: number | null;
  score: number | null;
  comments: string | null;
  status: 'pendiente' | 'completada';
}
interface MemberResponse {
  employee: { id: string; fullName: string; position: string | null };
  period: string;
  editable: boolean;
  assigned: number;
  evaluated: number;
  okrs: MemberOkr[];
}

const INPUT = 'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black disabled:bg-slate-50 disabled:text-slate-500';
const LABEL = 'text-xs font-semibold uppercase tracking-wide text-slate-500';

async function apiError(res: Response, fallback: string): Promise<{ message: string; code?: string }> {
  const body = (await res.json().catch(() => null)) as { message?: string | string[]; code?: string } | null;
  const message = Array.isArray(body?.message) ? body.message.join(' · ') : body?.message;
  return { message: message || fallback, ...(body?.code ? { code: body.code } : {}) };
}

/** Un OKR con su formulario de evaluación: calificación 0–100, comentarios y "Guardar Evaluación". */
function OkrCard({ okr, employeeId, editable, onSaved }: { okr: MemberOkr; employeeId: string; editable: boolean; onSaved: (o: MemberOkr) => void }) {
  const [score, setScore] = useState(okr.score !== null ? String(okr.score) : '');
  const [comments, setComments] = useState(okr.comments ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setScore(okr.score !== null ? String(okr.score) : '');
    setComments(okr.comments ?? '');
  }, [okr.score, okr.comments]);

  const save = async () => {
    setError(null);
    setSaved(false);
    const trimmed = score.trim();
    let scoreValue: number | null = null;
    if (trimmed !== '') {
      scoreValue = Number(trimmed);
      if (!Number.isFinite(scoreValue)) return setError('La calificación debe ser un número.');
      if (scoreValue < 0 || scoreValue > 100) return setError('La calificación debe estar entre 0 y 100.');
      if (Math.abs(Math.round(scoreValue * 100) - scoreValue * 100) > 1e-7) return setError('La calificación admite hasta dos decimales.');
    }
    if (scoreValue === null && !comments.trim()) return setError('Escribe una calificación o un comentario.');

    setSaving(true);
    try {
      const res = await fetch(`/api/hr/okr-evaluations/my-team/${employeeId}/okrs/${okr.employeeOkrId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: scoreValue, comments: comments.trim() || null }),
      });
      if (!res.ok) throw new Error((await apiError(res, 'No se pudo guardar la evaluación.')).message);
      onSaved((await res.json()) as MemberOkr);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la evaluación.');
    } finally {
      setSaving(false);
    }
  };

  const evaluated = okr.status === 'completada';

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Objetivo</p>
          <p className="whitespace-pre-line text-sm font-medium text-navy">{okr.objectiveCode ? `${okr.objectiveCode} · ` : ''}{okr.objective}</p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Resultado Clave</p>
          <p className="whitespace-pre-line text-sm text-slate-700">{okr.krCode ? `${okr.krCode} · ` : ''}{okr.keyResult}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{okr.weight !== null ? formatPct(okr.weight) : 'Sin peso'}</span>
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', evaluated ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>{evaluated ? 'Evaluado' : 'Pendiente'}</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr]">
        <div className="flex flex-col gap-1">
          <label className={LABEL} htmlFor={`score-${okr.employeeOkrId}`}>Calificación (0–100)</label>
          <input id={`score-${okr.employeeOkrId}`} type="number" min={0} max={100} step="0.01" inputMode="decimal" disabled={!editable} value={score} onChange={(e) => { setScore(e.target.value); setSaved(false); }} className={INPUT} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={LABEL} htmlFor={`comments-${okr.employeeOkrId}`}>Comentarios</label>
          <textarea id={`comments-${okr.employeeOkrId}`} rows={2} maxLength={2000} disabled={!editable} value={comments} onChange={(e) => { setComments(e.target.value); setSaved(false); }} className={INPUT} />
        </div>
      </div>

      {error && <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && <p role="status" className="mt-3 text-sm font-medium text-emerald-700">Evaluación guardada.</p>}
      {editable && (
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={save} disabled={saving} className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60">
            {saving ? 'Guardando…' : 'Guardar Evaluación'}
          </button>
        </div>
      )}
    </li>
  );
}

export function MyOkrsScreen() {
  const [periods, setPeriods] = useState<string[]>([]);
  const [period, setPeriod] = useState('');
  const [team, setTeam] = useState<TeamResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [member, setMember] = useState<MemberResponse | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMember, setLoadingMember] = useState(false);

  // Solo cuenta la respuesta de la consulta más reciente (si no, una respuesta lenta pisa a una nueva).
  const latestTeam = useRef(0);
  const latestMember = useRef(0);

  useEffect(() => {
    fetch('/api/hr/okr-evaluations/my-team/periods')
      .then(async (res) => {
        if (!res.ok) {
          const err = await apiError(res, 'No se pudo cargar los periodos.');
          if (res.status === 403 && (err.code === 'NOT_A_LEADER' || err.code === 'EMPLOYEE_NOT_LINKED')) return setBlocked(err.message);
          throw new Error(err.message);
        }
        const body = (await res.json()) as { periods: string[]; current: string };
        setPeriods(body.periods);
        setPeriod(body.current);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'No se pudo cargar los periodos.'));
  }, []);

  const loadTeam = useCallback(async () => {
    if (!period) return;
    const ticket = ++latestTeam.current;
    try {
      const res = await fetch(`/api/hr/okr-evaluations/my-team?period=${period}`);
      if (!res.ok) throw new Error((await apiError(res, 'No se pudo cargar tu equipo.')).message);
      const data = (await res.json()) as TeamResponse;
      if (ticket === latestTeam.current) {
        setTeam(data);
        setError(null);
      }
    } catch (err) {
      if (ticket === latestTeam.current) setError(err instanceof Error ? err.message : 'No se pudo cargar tu equipo.');
    }
  }, [period]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  const loadMember = useCallback(async () => {
    if (!selected || !period) return;
    const ticket = ++latestMember.current;
    setLoadingMember(true);
    try {
      const res = await fetch(`/api/hr/okr-evaluations/my-team/${selected}?period=${period}`);
      if (!res.ok) throw new Error((await apiError(res, 'No se pudo cargar los OKRs.')).message);
      const data = (await res.json()) as MemberResponse;
      if (ticket === latestMember.current) {
        setMember(data);
        setError(null);
      }
    } catch (err) {
      if (ticket === latestMember.current) setError(err instanceof Error ? err.message : 'No se pudo cargar los OKRs.');
    } finally {
      if (ticket === latestMember.current) setLoadingMember(false);
    }
  }, [selected, period]);

  useEffect(() => {
    setMember(null);
    void loadMember();
  }, [loadMember]);

  if (blocked) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-navy">Mis OKRs</h1>
        <div className="rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-500">{blocked}</div>
      </div>
    );
  }

  const onSaved = (updated: MemberOkr) => {
    setMember((cur) => {
      if (!cur) return cur;
      const okrs = cur.okrs.map((o) => (o.employeeOkrId === updated.employeeOkrId ? { ...o, ...updated } : o));
      return { ...cur, okrs, evaluated: okrs.filter((o) => o.score !== null).length };
    });
    void loadTeam();
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-black">Herramientas</p>
        <h1 className="mt-1 text-2xl font-bold text-navy">Mis OKRs</h1>
        <p className="mt-1 text-sm text-slate-500">Califica de 0 a 100 los OKRs de tus colaboradores directos.</p>
      </div>

      <div className="flex flex-col gap-1 sm:w-64">
        <label htmlFor="mo-period" className={LABEL}>Periodo</label>
        <select id="mo-period" value={period} onChange={(e) => { setPeriod(e.target.value); setTeam(null); }} className={INPUT}>
          {periods.map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
        </select>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!team ? (
        !error && <p className="text-sm text-slate-400">Cargando…</p>
      ) : team.team.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-500">No Tienes Colaboradores Directos Activos</div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
          <ul className="space-y-2">
            {team.team.map((m) => (
              <li key={m.employeeId}>
                <button
                  type="button"
                  onClick={() => setSelected(m.employeeId)}
                  className={cn('flex w-full items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 text-left shadow-sm hover:border-slate-300', selected === m.employeeId ? 'border-black' : 'border-slate-200')}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-navy">{m.fullName}</span>
                    {m.position && <span className="block truncate text-xs text-slate-500">{m.position}</span>}
                  </span>
                  <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold', m.assigned === 0 ? 'bg-slate-100 text-slate-500' : m.evaluated === m.assigned ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                    {m.assigned === 0 ? 'Sin OKRs' : `${m.evaluated} de ${m.assigned} evaluados`}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="min-w-0">
            {!selected ? (
              <p className="rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-500">Elige un colaborador para ver sus OKRs.</p>
            ) : loadingMember && !member ? (
              <p className="text-sm text-slate-400">Cargando…</p>
            ) : member ? (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-navy">{member.employee.fullName}</h2>
                  <p className="text-sm text-slate-500">{periodLabel(member.period)} · {member.evaluated} de {member.assigned} evaluados</p>
                </div>
                {!member.editable && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Este periodo es de solo lectura: solo se evalúan el semestre actual y el anterior.</p>}
                {member.okrs.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-500">Este Colaborador No Tiene OKRs Asignados En Este Periodo. Contacta a RRHH.</p>
                ) : (
                  <ul className="space-y-3">
                    {member.okrs.map((o) => (
                      <OkrCard key={o.employeeOkrId} okr={o} employeeId={member.employee.id} editable={member.editable} onSaved={onSaved} />
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
