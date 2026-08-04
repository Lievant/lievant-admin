'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Room } from '@/lib/api';
import { listRoomsByOfficeAction, toggleRoomActiveAction } from '../actions';
import { ROOM_TYPE_BADGE_STYLES, ROOM_TYPE_LABELS } from '../constants';
import { SelectField } from '../form-field';
import type { OfficeOption } from './office-options';
import { RoomFormDialog } from './room-form-dialog';

interface RoomsManagementTabProps {
  offices: OfficeOption[];
}

export function RoomsManagementTab({ offices }: RoomsManagementTabProps) {
  const router = useRouter();
  const [officeId, setOfficeId] = useState(offices[0]?.id ?? '');
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editingRoom, setEditingRoom] = useState<Room | undefined>(undefined);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!officeId) {
      setRooms([]);
      return;
    }
    startTransition(async () => {
      const result = await listRoomsByOfficeAction(officeId);
      setRooms(result);
    });
  }, [officeId]);

  function handleToggleActive(id: string) {
    startTransition(async () => {
      const result = await toggleRoomActiveAction(id);
      if (result.success) {
        router.refresh();
        setRooms((prev) => prev?.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r)) ?? null);
      } else {
        setError(result.error ?? 'No se pudo actualizar la sala.');
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div className="w-full max-w-xs">
          <SelectField id="rooms-mgmt-office" label="Oficina" value={officeId} onChange={setOfficeId}>
            {offices.length === 0 && <option value="">Sin oficinas</option>}
            {offices.map((office) => (
              <option key={office.id} value={office.id}>
                {office.name} · {office.cityName}
              </option>
            ))}
          </SelectField>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          disabled={!officeId}
          className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          + Nueva sala
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}

      {rooms === null ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400 shadow-sm">
          {isPending ? 'Cargando…' : 'No se pudieron cargar las salas.'}
        </div>
      ) : rooms.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400 shadow-sm">
          Esta oficina no tiene salas registradas.
        </div>
      ) : (
        <div className="space-y-2">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-navy">{room.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROOM_TYPE_BADGE_STYLES[room.type]}`}>
                    {ROOM_TYPE_LABELS[room.type]}
                  </span>
                  {!room.isActive && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                      Inactiva
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500">Capacidad: {room.capacity}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditingRoom(room)}
                  className="text-sm font-medium text-black hover:underline"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleActive(room.id)}
                  disabled={isPending}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-slate-300 disabled:opacity-60"
                >
                  {room.isActive ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && officeId && <RoomFormDialog officeId={officeId} onClose={() => setShowCreate(false)} />}
      {editingRoom && (
        <RoomFormDialog officeId={editingRoom.officeId} room={editingRoom} onClose={() => setEditingRoom(undefined)} />
      )}
    </div>
  );
}
