'use client';

import { useState } from 'react';
import type { EmployeeDetail, EmployeeVacation } from '@/lib/api';
import { PlusIcon } from '@/components/icons';
import { VacationDialog } from './vacation-dialog';

function VacationCard({ vacation, onEdit }: { vacation: EmployeeVacation; onEdit: () => void }) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-slate-300"
    >
      <p className="text-sm font-semibold text-navy">Año {vacation.year}</p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Apertura</p>
          <p className="mt-1 text-lg font-bold text-navy">{vacation.openingBalance ?? '0'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tomados</p>
          <p className="mt-1 text-lg font-bold text-navy">{vacation.taken}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Saldo actual</p>
          <p className="mt-1 text-lg font-bold text-terracota">{vacation.closingBalance ?? '0'}</p>
        </div>
      </div>
      <div className="mt-4 border-t border-slate-100 pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Días de actividad de apoyo</p>
        <p className="mt-1 text-sm text-navy">{vacation.supportActivityDays}</p>
      </div>
      {vacation.notes && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notas</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{vacation.notes}</p>
        </div>
      )}
    </button>
  );
}

export function VacationTab({
  employee,
  vacations,
  canView,
}: {
  employee: EmployeeDetail;
  vacations: EmployeeVacation[];
  canView: boolean;
}) {
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [editingVacation, setEditingVacation] = useState<EmployeeVacation | null>(null);

  if (!canView) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-10 text-center shadow-sm">
        <p className="text-sm font-semibold text-amber-700">Acceso restringido</p>
        <p className="mt-1 text-sm text-amber-600">
          Esta información solo está disponible para Recursos Humanos.
        </p>
      </div>
    );
  }

  const sorted = [...vacations].sort((a, b) => b.year - a.year);

  return (
    <div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-2 rounded-md bg-terracota px-4 py-2 text-sm font-semibold text-white hover:bg-terracota-dark"
        >
          <PlusIcon className="h-4 w-4" />
          Registrar movimiento
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400 shadow-sm sm:col-span-2 lg:col-span-3">
            Este empleado no tiene movimientos de vacaciones registrados.
          </div>
        )}
        {sorted.map((vacation) => (
          <VacationCard key={vacation.id} vacation={vacation} onEdit={() => setEditingVacation(vacation)} />
        ))}
      </div>

      {isDialogOpen && (
        <VacationDialog employee={employee} existingYears={vacations.map((v) => v.year)} onClose={() => setDialogOpen(false)} />
      )}
      {editingVacation && (
        <VacationDialog
          employee={employee}
          vacation={editingVacation}
          existingYears={vacations.map((v) => v.year)}
          onClose={() => setEditingVacation(null)}
        />
      )}
    </div>
  );
}
