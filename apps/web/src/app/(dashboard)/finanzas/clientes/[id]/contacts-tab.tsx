'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { ClientDetail, Contact } from '@/lib/api';
import { avatarColor, initials } from '@/lib/avatar';
import { PlusIcon } from '@/components/icons';
import { CONTACT_TYPE_BADGE_STYLES, CONTACT_TYPE_LABELS } from '../constants';
import { ContactDialog } from './contact-dialog';

export function ContactsTab({ client }: { client: ClientDetail }) {
  const [isAddOpen, setAddOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  return (
    <div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 rounded-md bg-terracota px-4 py-2 text-sm font-semibold text-white hover:bg-terracota-dark"
        >
          <PlusIcon className="h-4 w-4" />
          Agregar contacto
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3">
        {client.contacts.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
            Este cliente no tiene contactos registrados.
          </div>
        )}
        {client.contacts.map((contact) => (
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
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-navy">{contact.name}</p>
                {contact.isPrimary && (
                  <span className="rounded-full bg-terracota/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-terracota-dark">
                    Principal
                  </span>
                )}
                {contact.contactType && (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
                      CONTACT_TYPE_BADGE_STYLES[contact.contactType],
                    )}
                  >
                    {CONTACT_TYPE_LABELS[contact.contactType]}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                {[contact.position, contact.area].filter(Boolean).join(' · ') || 'Sin cargo registrado'}
              </p>
            </div>
            <div className="hidden shrink-0 text-right text-xs text-slate-500 sm:block">
              {contact.email && <p>{contact.email}</p>}
              {contact.phone && <p className="mt-0.5">{contact.phone}</p>}
            </div>
          </button>
        ))}
      </div>

      {isAddOpen && <ContactDialog clientId={client.id} onClose={() => setAddOpen(false)} />}
      {editingContact && (
        <ContactDialog clientId={client.id} contact={editingContact} onClose={() => setEditingContact(null)} />
      )}
    </div>
  );
}
