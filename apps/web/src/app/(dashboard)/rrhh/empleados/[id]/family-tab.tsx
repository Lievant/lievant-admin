'use client';

import { useState } from 'react';
import type { EmployeeDetail, EmployeeEmergencyContact, EmployeeTermination } from '@/lib/api';
import { avatarColor, initials } from '@/lib/avatar';
import { PlusIcon } from '@/components/icons';
import { formatDateLocal } from '@/lib/utils';
import { formatCurrency } from '../constants';
import { EmergencyContactDialog } from './emergency-contact-dialog';
import { TerminationDialog } from './termination-dialog';

export function FamilyTab({
  employee,
  contacts,
  termination,
  canView,
}: {
  employee: EmployeeDetail;
  contacts: EmployeeEmergencyContact[];
  termination: EmployeeTermination | null;
  canView: boolean;
}) {
  const [isAddOpen, setAddOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<EmployeeEmergencyContact | null>(null);
  const [isTerminationOpen, setTerminationOpen] = useState(false);

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

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-navy">Contactos de emergencia</h2>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            <PlusIcon className="h-4 w-4" />
            Agregar contacto
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3">
          {contacts.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
              Este empleado no tiene contactos de emergencia registrados.
            </div>
          )}
          {contacts.map((contact) => (
            <button
              key={contact.id}
              type="button"
              onClick={() => setEditingContact(contact)}
              className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-slate-300"
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: avatarColor(contact.name) }}
              >
                {initials(contact.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-navy">{contact.name}</p>
                <p className="mt-0.5 text-xs text-slate-400">{contact.relationship || 'Sin parentesco registrado'}</p>
              </div>
              <div className="hidden shrink-0 text-right text-xs text-slate-500 sm:block">
                {contact.phone && <p>{contact.phone}</p>}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-navy">Baja</h2>
        {termination?.terminationDate ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-red-400">Fecha de baja</p>
                <p className="mt-1 text-sm text-red-700">{formatDateLocal(termination.terminationDate)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-red-400">Motivo</p>
                <p className="mt-1 text-sm text-red-700">{termination.reason ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-red-400">Finiquito pagado</p>
                <p className="mt-1 text-sm text-red-700">{termination.severancePaid ? 'Sí' : 'No'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-red-400">Monto de finiquito</p>
                <p className="mt-1 text-sm text-red-700">{formatCurrency(termination.severanceAmount)}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-400">Referencias</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-red-700">{termination.references ?? '—'}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-400">Notas</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-red-700">{termination.notes ?? '—'}</p>
              </div>
            </div>
          </div>
        ) : employee.status === 'active' ? (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Este empleado se encuentra activo.</p>
            <button
              type="button"
              onClick={() => setTerminationOpen(true)}
              className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Registrar baja
            </button>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
            Sin información de baja registrada.
          </div>
        )}
      </div>

      {isAddOpen && <EmergencyContactDialog employee={employee} onClose={() => setAddOpen(false)} />}
      {editingContact && (
        <EmergencyContactDialog employee={employee} contact={editingContact} onClose={() => setEditingContact(null)} />
      )}
      {isTerminationOpen && <TerminationDialog employee={employee} onClose={() => setTerminationOpen(false)} />}
    </div>
  );
}
