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

/** Slots de 30 min usados por el filtro de disponibilidad en rooms-screen. */
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

/** Opciones de 15 min entre 07:00 y 21:00 para los selectores de reserva. */
export function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let hour = 7; hour <= 21; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      if (hour === 21 && minute > 0) break;
      options.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    }
  }
  return options;
}

export const MIN_BOOKING_MINUTES = 15;
export const MAX_BOOKING_MINUTES = 4 * 60;

/** Minutos desde medianoche para un "HH:mm". */
export function timeToMinutes(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, totalMinutes));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

/**
 * Hora de fin inicial a partir de una duración en horas, ajustada a la opción
 * válida más cercana para que el <select> no arranque con un valor inexistente.
 */
export function defaultEndTime(startTime: string, durationHours: number, options: string[]): string {
  const target = timeToMinutes(startTime) + Math.round(durationHours * 60);
  const candidates = options.filter((option) => timeToMinutes(option) > timeToMinutes(startTime));
  const fallback = options[options.length - 1] ?? startTime;
  if (candidates.length === 0) return fallback;
  return candidates.reduce(
    (best, option) =>
      Math.abs(timeToMinutes(option) - target) < Math.abs(timeToMinutes(best) - target) ? option : best,
    candidates[0] ?? fallback,
  );
}

export function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export const DEFAULT_ROOM_TIMEZONE = 'America/Mexico_City';

/**
 * "Ahora" expresado en la misma convención que start_time/end_time: el módulo
 * guarda la hora de pared local en componentes UTC (ver assertWithinOfficeHours
 * y buildIsoDateTime, que arma `${date}T${time}:00Z`). Por eso Date.now(), que
 * es el epoch real, no sirve como referencia: en México va 6 h por delante de
 * los valores guardados y hace que las reservas de hoy se vean como pasadas.
 *
 * Se usa Intl.formatToParts + Date.UTC en lugar de reparsear
 * toLocaleString(): el formato de salida de toLocaleString no está garantizado
 * por el estándar, así que `new Date(...)` sobre ese string devuelve NaN en
 * algunos motores y además desplaza ambos lados por igual, dejando el desfase
 * intacto.
 */
export function wallClockNowMs(timeZone: string = DEFAULT_ROOM_TIMEZONE): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const value = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second'),
  );
}

/** Fecha de hoy (YYYY-MM-DD) en la zona de la oficina, no en UTC ni en la del navegador. */
export function wallClockTodayString(timeZone: string = DEFAULT_ROOM_TIMEZONE): string {
  return new Date(wallClockNowMs(timeZone)).toISOString().slice(0, 10);
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
