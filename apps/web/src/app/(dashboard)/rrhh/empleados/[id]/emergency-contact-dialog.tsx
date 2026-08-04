'use client';

import { useState, useTransition } from 'react';
import type { CreateEmergencyContactPayload, EmployeeDetail, EmployeeEmergencyContact } from '@/lib/api';
import { CloseIcon } from '@/components/icons';
import { TextField } from '../form-field';
import { addContactAction, removeContactAction, updateContactAction } from './actions';

export function EmergencyContactDialog({
  employee,
  contact,
  onClose,
}: {
  employee: EmployeeDetail;
  contact?: EmployeeEmergencyContact;
  onClose: () => void;
}) {
  const isEdit = Boolean(contact);
  const [name, setName] = useState(contact?.name ?? '');
  const [relationship, setRelationship] = useState(contact?.relationship ?? '');
  const [phone, setPhone] = useState(contact?.phone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }

    startTransition(async () => {
      const payload: CreateEmergencyContactPayload = { name: name.trim() };
      if (relationship.trim()) payload.relationship = relationship.trim();
      if (phone.trim()) payload.phone = phone.trim();

      const result =
        isEdit && contact
          ? await updateContactAction(employee.id, contact.id, payload)
          : await addContactAction(employee.id, payload);

      if (result.success) {
        onClose();
      } else {
        setError(result.error ?? 'No se pudo guardar el contacto.');
      }
    });
  };

  const handleDelete = () => {
    if (!contact) return;
    setError(null);

    startTransition(async () => {
      const result = await removeContactAction(employee.id, contact.id);
      if (result.success) {
        onClose();
      } else {
        setError(result.error ?? 'No se pudo eliminar el contacto.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-navy">{isEdit ? 'Editar contacto' : 'Agregar contacto'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
          <TextField id="emergency-contact-name" label="Nombre" value={name} onChange={setName} placeholder="Nombre completo" />
          <TextField id="emergency-contact-relationship" label="Parentesco" value={relationship} onChange={setRelationship} placeholder="Madre, padre, esposo(a)…" />
          <TextField id="emergency-contact-phone" label="Teléfono" value={phone} onChange={setPhone} placeholder="55 1234 5678" />

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            {isEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Eliminar
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
              >
                {isPending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
