'use client';

import { useState, useTransition } from 'react';
import type { ClientDetail, ClientSegment, ClientStatus, UpdateClientPayload, UserSummary } from '@/lib/api';
import { CloseIcon } from '@/components/icons';
import { CLIENT_SEGMENTS, CLIENT_SEGMENT_LABELS, CLIENT_STATUSES, CLIENT_STATUS_LABELS } from '../constants';
import { updateClientAction } from './actions';
import { TextField } from '../form-field';

interface EditClientDialogProps {
  client: ClientDetail;
  accountManagers: UserSummary[];
  onClose: () => void;
}

export function EditClientDialog({ client, accountManagers, onClose }: EditClientDialogProps) {
  const [status, setStatus] = useState<ClientStatus>(client.status);
  const [accountManagerId, setAccountManagerId] = useState(client.accountManagerId ?? '');
  const [notes, setNotes] = useState(client.notes ?? '');
  const [crmId, setCrmId] = useState(client.crmId ?? '');
  const [corId, setCorId] = useState(client.corId ?? '');
  const [contpaqId, setContpaqId] = useState(client.contpaqId ?? '');
  const [dynamicsId, setDynamicsId] = useState(client.dynamicsId ?? '');
  const [segment, setSegment] = useState<ClientSegment | ''>(client.segment ?? '');
  const [npsScore, setNpsScore] = useState(client.npsScore != null ? String(client.npsScore) : '');
  const [lastContactDate, setLastContactDate] = useState(client.lastContactDate ?? '');
  const [website, setWebsite] = useState(client.website ?? '');
  const [linkedin, setLinkedin] = useState(client.linkedin ?? '');
  const [country, setCountry] = useState(client.country ?? '');
  const [city, setCity] = useState(client.city ?? '');
  const [address, setAddress] = useState(client.address ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const payload: UpdateClientPayload = { status };
      if (accountManagerId) payload.accountManagerId = accountManagerId;
      if (notes.trim()) payload.notes = notes.trim();
      if (crmId.trim()) payload.crmId = crmId.trim();
      if (corId.trim()) payload.corId = corId.trim();
      if (contpaqId.trim()) payload.contpaqId = contpaqId.trim();
      if (dynamicsId.trim()) payload.dynamicsId = dynamicsId.trim();
      if (segment) payload.segment = segment;
      if (npsScore !== '') payload.npsScore = Number(npsScore);
      if (lastContactDate) payload.lastContactDate = lastContactDate;
      if (website.trim()) payload.website = website.trim();
      if (linkedin.trim()) payload.linkedin = linkedin.trim();
      if (country.trim()) payload.country = country.trim();
      if (city.trim()) payload.city = city.trim();
      if (address.trim()) payload.address = address.trim();

      const result = await updateClientAction(client.id, payload);
      if (result.success) {
        onClose();
      } else {
        setError(result.error ?? 'No se pudo actualizar el cliente.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-navy">Editar cliente</h2>
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
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="client-status">
                Estado
              </label>
              <select
                id="client-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ClientStatus)}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
              >
                {CLIENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {CLIENT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="client-am">
                Account manager
              </label>
              <select
                id="client-am"
                value={accountManagerId}
                onChange={(e) => setAccountManagerId(e.target.value)}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
              >
                <option value="">Sin asignar</option>
                {accountManagers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="client-segment">
                Segmento
              </label>
              <select
                id="client-segment"
                value={segment}
                onChange={(e) => setSegment(e.target.value as ClientSegment | '')}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
              >
                <option value="">Sin definir</option>
                {CLIENT_SEGMENTS.map((s) => (
                  <option key={s} value={s}>
                    {CLIENT_SEGMENT_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <TextField id="client-nps" label="NPS (0-10)" type="number" value={npsScore} onChange={setNpsScore} placeholder="8" />
            <TextField
              id="client-last-contact"
              label="Último contacto"
              type="date"
              value={lastContactDate}
              onChange={setLastContactDate}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextField id="client-website" label="Sitio web" value={website} onChange={setWebsite} placeholder="https://www.cliente.com" />
            <TextField id="client-linkedin" label="LinkedIn" value={linkedin} onChange={setLinkedin} placeholder="https://www.linkedin.com/company/..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextField id="client-country" label="País" value={country} onChange={setCountry} placeholder="México" />
            <TextField id="client-city" label="Ciudad" value={city} onChange={setCity} placeholder="Ciudad de México" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="client-address">
              Dirección
            </label>
            <textarea
              id="client-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextField id="client-crm" label="CRM ID" value={crmId} onChange={setCrmId} mono />
            <TextField id="client-cor" label="COR ID" value={corId} onChange={setCorId} mono />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <TextField id="client-contpaq" label="Contpaq ID" value={contpaqId} onChange={setContpaqId} mono />
            <TextField id="client-dynamics" label="Dynamics ID" value={dynamicsId} onChange={setDynamicsId} mono />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="client-notes">
              Notas
            </label>
            <textarea
              id="client-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
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
              {isPending ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
