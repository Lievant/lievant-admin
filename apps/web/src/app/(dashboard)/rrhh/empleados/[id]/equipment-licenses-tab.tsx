'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { EmployeeEquipmentItem, EmployeeLicenseDetail } from '@/lib/api';
import { statusBadgeStyle, typeIcon } from '@/app/(dashboard)/transformacion/inventario/constants';
import { NoPermissions } from '@/components/ui/no-permissions';

interface EquipmentLicensesTabProps {
  employeeId: string;
  canViewEquipos: boolean;
  canViewLicencias: boolean;
}

function ToolBadge({ hasAccess, isAdmin }: { hasAccess: boolean; isAdmin: boolean }) {
  if (!hasAccess) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        ✕
      </span>
    );
  }
  if (isAdmin) {
    return (
      <span title="Admin / superadmin" className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700">
        👑
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
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
                <Link href={`/transformacion/inventario/${item.id}`} className="text-xs font-semibold text-terracota hover:text-terracota-dark">
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
  const [license, setLicense] = useState<EmployeeLicenseDetail | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/licenses/by-employee/${employeeId}`)
      .then((res) => (res.ok ? (res.json() as Promise<EmployeeLicenseDetail>) : null))
      .then((data) => { if (!cancelled) setLicense(data); })
      .catch(() => { if (!cancelled) setLicense(null); });
    return () => { cancelled = true; };
  }, [employeeId]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-700">Licencias de software</h3>
      {license === undefined ? (
        <p className="mt-3 text-sm text-slate-400">Cargando…</p>
      ) : license === null ? (
        <p className="mt-3 text-sm text-slate-400">Sin información de licencias.</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
            {license.activeDirectoryName && (
              <span>Usuario AD: <strong className="text-slate-700">{license.activeDirectoryName}</strong></span>
            )}
            {license.responsiva && (
              <span>Responsiva: <strong className="text-slate-700">{license.responsiva}</strong></span>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {license.tools.map((tool) => (
              <div key={tool.toolId} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2">
                <ToolBadge hasAccess={tool.hasAccess} isAdmin={tool.isAdmin} />
                <span className="text-sm text-slate-700">{tool.toolName}</span>
              </div>
            ))}
          </div>
        </>
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
