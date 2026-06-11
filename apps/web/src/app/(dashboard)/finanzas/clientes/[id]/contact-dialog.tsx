'use client';

import { useState, useTransition } from 'react';
import type { Contact, ContactType, CreateContactPayload } from '@/lib/api';
import { CloseIcon } from '@/components/icons';
import { CONTACT_TYPES, CONTACT_TYPE_LABELS } from '../constants';
import { TextField } from '../form-field';
import { addContactAction, removeContactAction, updateContactAction } from './actions';

export function ContactDialog({
  clientId,
  contact,
  onClose,
}: {
  clientId: string;
  contact?: Contact;
  onClose: () => void;
}) {
  const isEdit = Boolean(contact);
  const [name, setName] = useState(contact?.name ?? '');
  const [position, setPosition] = useState(contact?.position ?? '');
  const [area, setArea] = useState(contact?.area ?? '');
  const [contactType, setContactType] = useState<ContactType | ''>(contact?.contactType ?? '');
  const [email, setEmail] = useState(contact?.email ?? '');
  const [phone, setPhone] = useState(contact?.phone ?? '');
  const [mobile, setMobile] = useState(contact?.mobile ?? '');
  const [isPrimary, setIsPrimary] = useState(contact?.isPrimary ?? false);
  const [notes, setNotes] = useState(contact?.notes ?? '');
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
      const payload: CreateContactPayload = { name: name.trim(), isPrimary };
      if (position.trim()) payload.position = position.trim();
      if (area.trim()) payload.area = area.trim();
      if (contactType) payload.contactType = contactType;
      if (email.trim()) payload.email = email.trim();
      if (phone.trim()) payload.phone = phone.trim();
      if (mobile.trim()) payload.mobile = mobile.trim();
      if (notes.trim()) payload.notes = notes.trim();

      const result =
        isEdit && contact
          ? await updateContactAction(clientId, contact.id, payload)
          : await addContactAction(clientId, payload);

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
      const result = await removeContactAction(clientId, contact.id);
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
          <TextField id="contact-name" label="Nombre" value={name} onChange={setName} placeholder="Nombre completo" />

          <div className="grid grid-cols-2 gap-4">
            <TextField id="contact-position" label="Cargo" value={position} onChange={setPosition} placeholder="Director general" />
            <TextField id="contact-area" label="Área" value={area} onChange={setArea} placeholder="Finanzas" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="contact-type">
              Tipo de contacto
            </label>
            <select
              id="contact-type"
              value={contactType}
              onChange={(e) => setContactType(e.target.value as ContactType | '')}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
            >
              <option value="">Sin especificar</option>
              {CONTACT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {CONTACT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextField id="contact-email" label="Email" type="email" value={email} onChange={setEmail} placeholder="contacto@cliente.com" />
            <TextField id="contact-phone" label="Teléfono" value={phone} onChange={setPhone} placeholder="55 1234 5678" />
          </div>

          <TextField id="contact-mobile" label="Celular" value={mobile} onChange={setMobile} placeholder="55 1234 5678" />

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-terracota focus:ring-terracota"
            />
            Contacto principal
          </label>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="contact-notes">
              Notas
            </label>
            <textarea
              id="contact-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
            />
          </div>

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
                className="rounded-md bg-terracota px-4 py-2 text-sm font-semibold text-white hover:bg-terracota-dark disabled:opacity-60"
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
