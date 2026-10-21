'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EmployeePicker, type EmployeePickerValue } from '@/app/(dashboard)/rrhh/empleados/employee-picker';
import { NoPermissions } from '@/components/ui/no-permissions';
import type { EquipmentAuditDetail, EquipmentAuditTechnician } from '@/lib/api';
import { errorMessageOf, INPUT_CLASS, LABEL_CLASS, todayInMexico } from '../constants';
import { useAuditPermissions } from '../use-audit-permissions';

interface NewAuditFormProps {
  technicians: EquipmentAuditTechnician[];
  currentUserId: string | null;
}

/**
 * Paso 1: fecha, técnico y colaborador. Al crearla, el API toma el snapshot del
 * colaborador y precarga sus equipos y licencias; el resto se llena en el detalle.
 */
export function NewAuditForm({ technicians, currentUserId }: NewAuditFormProps) {
  const router = useRouter();
  const { canWrite } = useAuditPermissions();
  const [auditDate, setAuditDate] = useState(todayInMexico());
  const [technicianUserId, setTechnicianUserId] = useState(
    technicians.some((t) => t.userId === currentUserId) ? (currentUserId ?? '') : (technicians[0]?.userId ?? ''),
  );
  const [employee, setEmployee] = useState<EmployeePickerValue | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canWrite) return <NoPermissions />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!employee) {
      setError('Elige al colaborador que se va a auditar.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/audits/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: employee.id, auditDate, technicianUserId: technicianUserId || undefined }),
      });
      if (!res.ok) throw new Error(await errorMessageOf(res, 'No se pudo crear la auditoría.'));
      const audit = (await res.json()) as EquipmentAuditDetail;
      router.push(`/transformacion/auditoria-equipos/${audit.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la auditoría.');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)}>
      <Link href="/transformacion/auditoria-equipos" className="text-sm text-slate-500 hover:text-black hover:underline">
        ← Auditorías
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-navy">Nueva auditoría de equipos</h1>
      <p className="mt-1 text-sm text-slate-500">
        TIC-RE-18 · Al continuar se cargan los equipos y licencias que tiene asignados el colaborador.
      </p>

      {error && (
        <div className="mt-6 rounded-lg border border-black/30 bg-black/5 px-4 py-3 text-sm text-black">{error}</div>
      )}

      <div className="mt-6 grid gap-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2">
        <div>
          <label className={LABEL_CLASS} htmlFor="audit-date">
            Fecha
          </label>
          <input
            id="audit-date"
            type="date"
            value={auditDate}
            onChange={(e) => setAuditDate(e.target.value)}
            required
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="audit-technician">
            Técnico
          </label>
          <select
            id="audit-technician"
            value={technicianUserId}
            onChange={(e) => setTechnicianUserId(e.target.value)}
            className={INPUT_CLASS}
          >
            {technicians.map((t) => (
              <option key={t.userId} value={t.userId}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <EmployeePicker label="Colaborador" id="audit-employee" value={employee} onSelect={setEmployee} />
        </div>
        {employee && (
          <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
            <div>
              <p className={LABEL_CLASS}>Área</p>
              <p className="text-sm text-navy">{employee.area ?? '—'}</p>
            </div>
            <div>
              <p className={LABEL_CLASS}>Cargo</p>
              <p className="text-sm text-navy">{employee.position || '—'}</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Link
          href="/transformacion/auditoria-equipos"
          className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={saving || !employee}
          className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {saving ? 'Creando…' : 'Iniciar auditoría'}
        </button>
      </div>
    </form>
  );
}
