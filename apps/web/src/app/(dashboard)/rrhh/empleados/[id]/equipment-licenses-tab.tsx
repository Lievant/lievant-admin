'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { AssignmentRecord, EmployeeEquipmentItem } from '@/lib/api';
import { statusBadgeStyle, typeIcon } from '@/app/(dashboard)/transformacion/inventario/constants';
import { NoPermissions } from '@/components/ui/no-permissions';

interface EquipmentLicensesTabProps {
  employeeId: string;
  canViewEquipos: boolean;
  canViewLicencias: boolean;
}

function ToolBadge({ active }: { active: boolean }) {
  if (!active) {
    return (
      <span title="Revocada" className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        ✕
      </span>
    );
  }
  return (
    <span title="Activa" className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
      ✓
    </span>
  );
}

function EquipmentColumn({ employeeId }: { employeeId: string }) {
  const [items, setItems] = useState<EmployeeEquipmentItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/inventory/equipment/by-employee/${employeeId}`)
      .then((res) => (res.ok ? (res.json() as Promise<EmployeeEquipmentItem[]>) : []))
      .then((data) => { if (!cancelled) setItems(data); })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, [employeeId]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-700">Equipos tecnológicos</h3>
      {items === null ? (
        <p className="mt-3 text-sm text-slate-400">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">Sin equipos asignados.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <i className={`ti ${typeIcon(item.equipmentType)} text-slate-400`} />
                <div>
                  <p className="text-sm font-medium text-navy">{item.displayId}</p>
                  <p className="text-xs text-slate-500">
                    {[item.brand, item.model].filter(Boolean).join(' ') || item.equipmentType}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeStyle(item.status)}`}>
                  {item.status}
                </span>
                <Link href={`/transformacion/inventario/${item.id}`} className="text-xs font-semibold text-black hover:text-black">
                  Ver detalle
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LicensesColumn({ employeeId }: { employeeId: string }) {
  const [assignments, setAssignments] = useState<AssignmentRecord[] | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    // Lee del módulo de Asignaciones: el Maestro de Licenciamientos se retiró.
    // El usuario de AD y la responsiva vivían solo en aquel schema y no tienen
    // equivalente aquí, así que ya no se muestran.
    fetch(`/api/assignments/by-employee/${employeeId}`)
      .then((res) => (res.ok ? (res.json() as Promise<AssignmentRecord[]>) : null))
      .then((data) => { if (!cancelled) setAssignments(data); })
      .catch(() => { if (!cancelled) setAssignments(null); });
    return () => { cancelled = true; };
  }, [employeeId]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-700">Herramientas y licencias</h3>
      {assignments === undefined ? (
        <p className="mt-3 text-sm text-slate-400">Cargando…</p>
      ) : assignments === null || assignments.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">Sin herramientas asignadas.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {assignments.map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2">
              <ToolBadge active={a.status === 'activo'} />
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-700">{a.tool.name}</p>
                <p className="font-mono text-[11px] text-slate-400">{a.assignmentCode}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function EquipmentLicensesTab({ employeeId, canViewEquipos, canViewLicencias }: EquipmentLicensesTabProps) {
  if (!canViewEquipos && !canViewLicencias) {
    return <NoPermissions />;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {canViewEquipos && <EquipmentColumn employeeId={employeeId} />}
      {canViewLicencias && <LicensesColumn employeeId={employeeId} />}
    </div>
  );
}
