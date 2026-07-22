import type { ComponentType, SVGProps } from 'react';
import type { BookingStatus, RoomType } from '@/lib/api';
import { AcIcon, PhoneIcon, ProjectorIcon, TvIcon, VideoIcon, WhiteboardIcon } from '@/components/icons';

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  sala_reunion: 'Sala de reunión',
  phone_booth: 'Phone booth',
};

export const ROOM_TYPE_BADGE_STYLES: Record<RoomType, string> = {
  sala_reunion: 'bg-blue-50 text-blue-600',
  phone_booth: 'bg-purple-50 text-purple-600',
};

export const ROOM_TYPE_OPTIONS: Array<{ value: RoomType | ''; label: string }> = [
  { value: '', label: 'Todas' },
  { value: 'sala_reunion', label: 'Salas de reunión' },
  { value: 'phone_booth', label: 'Phone booths' },
];

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  confirmada: 'Confirmada',
  pendiente_aprobacion: 'Pendiente de aprobación',
  cancelada: 'Cancelada',
};

export const BOOKING_STATUS_BADGE_STYLES: Record<BookingStatus, string> = {
  confirmada: 'bg-green-50 text-green-600',
  pendiente_aprobacion: 'bg-amber-50 text-amber-600',
  cancelada: 'bg-slate-100 text-slate-600',
};

export const DURATION_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0.5, label: '30 min' },
  { value: 1, label: '1 hora' },
  { value: 2, label: '2 horas' },
  { value: 3, label: '3 horas' },
  { value: 4, label: '4 horas' },
  { value: 5, label: 'Más de 4 horas' },
];

export const AMENITY_ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  TV: TvIcon,
  Videoconferencia: VideoIcon,
  Pizarrón: WhiteboardIcon,
  Proyector: ProjectorIcon,
  Teléfono: PhoneIcon,
  'Aire acondicionado': AcIcon,
};

export const AMENITY_OPTIONS: string[] = Object.keys(AMENITY_ICONS);

export const WEEKDAYS: Array<{ key: string; label: string; rrule: string; isoDay: number }> = [
  { key: 'L', label: 'L', rrule: 'MO', isoDay: 1 },
  { key: 'M', label: 'M', rrule: 'TU', isoDay: 2 },
  { key: 'X', label: 'X', rrule: 'WE', isoDay: 3 },
  { key: 'J', label: 'J', rrule: 'TH', isoDay: 4 },
  { key: 'V', label: 'V', rrule: 'FR', isoDay: 5 },
  { key: 'S', label: 'S', rrule: 'SA', isoDay: 6 },
  { key: 'D', label: 'D', rrule: 'SU', isoDay: 0 },
];

export function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let hour = 7; hour <= 20; hour++) {
    slots.push(`${String(hour).padStart(2, '0')}:00`);
    if (hour < 20) {
      slots.push(`${String(hour).padStart(2, '0')}:30`);
    }
  }
  return slots;
}

export function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function formatDateLabel(dateISO: string, timeZone = 'UTC'): string {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone,
  }).format(new Date(dateISO));
}

export function formatTimeLabel(dateISO: string, timeZone = 'UTC'): string {
  return new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(new Date(dateISO));
}

export function formatDateTimeRange(startISO: string, endISO: string, timeZone = 'UTC'): string {
  return `${formatDateLabel(startISO, timeZone)}, ${formatTimeLabel(startISO, timeZone)} - ${formatTimeLabel(endISO, timeZone)}`;
}

export function formatDurationLabel(startISO: string, endISO: string): string {
  const hours = (new Date(endISO).getTime() - new Date(startISO).getTime()) / (60 * 60 * 1000);
  if (hours < 1) {
    return `${Math.round(hours * 60)} min`;
  }
  if (Number.isInteger(hours)) {
    return `${hours} h`;
  }
  return `${hours.toFixed(1)} h`;
}

export function buildIsoDateTime(date: string, time: string): string {
  return `${date}T${time}:00Z`;
}

export function addHoursToIso(iso: string, hours: number): string {
  const date = new Date(iso);
  date.setUTCMinutes(date.getUTCMinutes() + hours * 60);
  return date.toISOString();
}
