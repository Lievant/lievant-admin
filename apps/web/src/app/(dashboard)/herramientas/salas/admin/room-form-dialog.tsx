'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CreateRoomPayload, Room, RoomType } from '@/lib/api';
import { CloseIcon } from '@/components/icons';
import { createRoomAction, updateRoomAction } from '../actions';
import { AMENITY_OPTIONS, ROOM_TYPE_LABELS } from '../constants';
import { SelectField, TextAreaField, TextField } from '../form-field';

interface RoomFormDialogProps {
  officeId: string;
  room?: Room;
  onClose: () => void;
}

export function RoomFormDialog({ officeId, room, onClose }: RoomFormDialogProps) {
  const router = useRouter();
  const [name, setName] = useState(room?.name ?? '');
  const [type, setType] = useState<RoomType>(room?.type ?? 'sala_reunion');
  const [capacity, setCapacity] = useState(room ? String(room.capacity) : '1');
  const [floor, setFloor] = useState(room?.floor ?? '');
  const [amenities, setAmenities] = useState<string[]>(room?.amenities ?? []);
  const [openTime, setOpenTime] = useState(room?.openTime.slice(0, 5) ?? '08:00');
  const [closeTime, setCloseTime] = useState(room?.closeTime.slice(0, 5) ?? '20:00');
  const [maxBookingHours, setMaxBookingHours] = useState(room ? String(room.maxBookingHours) : '4');
  const [requiresApprovalOverHours, setRequiresApprovalOverHours] = useState(
    room ? String(room.requiresApprovalOverHours) : '4',
  );
  const [notes, setNotes] = useState(room?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleAmenity(amenity: string) {
    setAmenities((prev) => (prev.includes(amenity) ? prev.filter((a) => a !== amenity) : [...prev, amenity]));
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('El nombre de la sala es obligatorio.');
      return;
    }

    const capacityNum = Number(capacity);
    if (!Number.isInteger(capacityNum) || capacityNum < 1) {
      setError('La capacidad debe ser un número entero mayor a 0.');
      return;
    }

    startTransition(async () => {
      const basePayload: Omit<CreateRoomPayload, 'office_id'> = {
        name: name.trim(),
        type,
        capacity: capacityNum,
        amenities,
        open_time: openTime,
        close_time: closeTime,
        max_booking_hours: Number(maxBookingHours),
        requires_approval_over_hours: Number(requiresApprovalOverHours),
      };
      if (floor.trim()) basePayload.floor = floor.trim();
      if (notes.trim()) basePayload.notes = notes.trim();

      const result = room
        ? await updateRoomAction(room.id, basePayload)
        : await createRoomAction({ ...basePayload, office_id: officeId });

      if (result.success) {
        router.refresh();
        onClose();
      } else {
        setError(result.error ?? 'No se pudo guardar la sala.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-navy">{room ? 'Editar sala' : 'Nueva sala'}</h2>
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
          <TextField id="room-name" label="Nombre" value={name} onChange={setName} />

          <div className="grid grid-cols-2 gap-4">
            <SelectField id="room-type" label="Tipo" value={type} onChange={(v) => setType(v as RoomType)}>
              {Object.entries(ROOM_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
            <TextField id="room-capacity" label="Capacidad" type="number" value={capacity} onChange={setCapacity} />
          </div>

          <TextField id="room-floor" label="Piso (opcional)" value={floor} onChange={setFloor} />

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amenidades</p>
            <div className="mt-2 flex flex-wrap gap-3">
              {AMENITY_OPTIONS.map((amenity) => (
                <label key={amenity} className="flex items-center gap-1.5 text-sm text-navy">
                  <input type="checkbox" checked={amenities.includes(amenity)} onChange={() => toggleAmenity(amenity)} />
                  {amenity}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextField id="room-open-time" label="Hora de apertura" type="time" value={openTime} onChange={setOpenTime} />
            <TextField id="room-close-time" label="Hora de cierre" type="time" value={closeTime} onChange={setCloseTime} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextField
              id="room-max-hours"
              label="Máx. horas por reserva"
              type="number"
              value={maxBookingHours}
              onChange={setMaxBookingHours}
            />
            <TextField
              id="room-approval-hours"
              label="Requiere aprobación si supera (h)"
              type="number"
              value={requiresApprovalOverHours}
              onChange={setRequiresApprovalOverHours}
            />
          </div>

          <TextAreaField id="room-notes" label="Notas (opcional)" value={notes} onChange={setNotes} />

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
              {isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
