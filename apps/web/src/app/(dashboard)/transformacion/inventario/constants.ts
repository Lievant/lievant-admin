export const STATUS_BADGE_STYLES: Record<string, string> = {
  Asignado: 'bg-blue-50 text-blue-700',
  Disponible: 'bg-green-50 text-green-700',
  'En Reparación': 'bg-orange-50 text-orange-700',
  'En garantía': 'bg-purple-50 text-purple-700',
  'Sin Verificar': 'bg-slate-100 text-slate-600',
  'En espera de devolución': 'bg-yellow-50 text-yellow-700',
  Descompuesto: 'bg-red-50 text-red-600',
  Baja: 'bg-slate-200 text-slate-700',
  Extraviado: 'bg-red-100 text-red-700',
  Robado: 'bg-red-100 text-red-700',
};

export function statusBadgeStyle(status: string): string {
  return STATUS_BADGE_STYLES[status] ?? 'bg-slate-100 text-slate-600';
}

export const TYPE_ICONS: Record<string, string> = {
  Laptop: 'ti-device-laptop',
  'PC Escritorio': 'ti-device-desktop',
  Monitor: 'ti-device-desktop-analytics',
  Teclado: 'ti-keyboard',
  Mouse: 'ti-mouse',
  Celular: 'ti-device-mobile',
  Adaptador: 'ti-plug-connected',
  Audifonos: 'ti-headphones',
  'Micrófono': 'ti-microphone',
  WebCam: 'ti-camera',
  'Cámara': 'ti-camera',
  Tableta: 'ti-device-tablet',
  'Memoria Ext': 'ti-device-usb',
  Pantalla: 'ti-device-tv',
  'Pantalla de Luz': 'ti-bulb',
  'Megáfono': 'ti-speakerphone',
  Base: 'ti-device-laptop',
  Cable: 'ti-plug',
};

export function typeIcon(type: string): string {
  return TYPE_ICONS[type] ?? 'ti-device-laptop';
}

export function formatCurrency(value: string | number): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n) || n === 0) return '—';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(n);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  } catch {
    return value;
  }
}
