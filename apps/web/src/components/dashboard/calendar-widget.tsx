'use client';

import type { Announcement } from '@/lib/api';
import { useEffect, useMemo, useState } from 'react';

// ── types ──────────────────────────────────────────────────────────────────────

interface PublicHoliday {
  date: string;
  localName: string;
  name: string;
}

interface BirthdayChip {
  id: string;
  fullName: string;
  birthDate: string; // "MM-DD"
}

type EventType = 'festivo' | 'efemeride' | 'cumpleanos' | 'rrhh';

interface DayEvent {
  id: string;
  label: string;
  description?: string;
  type: EventType;
}

interface Ephemeris {
  m: number;
  d: number;
  n: string;
  desc: string;
  cat: 'festivo' | 'efemeride';
}

// ── 54 efemérides ─────────────────────────────────────────────────────────────

const EFEMERIDES: Ephemeris[] = [
  { m: 1,  d: 1,  n: 'Año Nuevo',                              cat: 'festivo',   desc: 'Inicio del año calendario gregoriano' },
  { m: 1,  d: 6,  n: 'Día de Reyes',                           cat: 'efemeride', desc: 'Los Reyes Magos llevan regalos a los niños' },
  { m: 1,  d: 28, n: 'Día de la Protección de Datos',          cat: 'efemeride', desc: 'Reconocimiento del derecho a la privacidad digital' },
  { m: 2,  d: 5,  n: 'Día de la Constitución',                 cat: 'festivo',   desc: 'Promulgación de la Constitución Mexicana de 1917' },
  { m: 2,  d: 14, n: 'Día del Amor y la Amistad',              cat: 'efemeride', desc: 'Celebración del amor y la amistad' },
  { m: 2,  d: 24, n: 'Día de la Bandera',                      cat: 'efemeride', desc: 'Conmemoración de la Bandera Nacional Mexicana' },
  { m: 3,  d: 8,  n: 'Día Internacional de la Mujer',          cat: 'efemeride', desc: 'Reconocimiento a los derechos de las mujeres' },
  { m: 3,  d: 20, n: 'Inicio de Primavera',                    cat: 'efemeride', desc: 'Equinoccio de primavera en el hemisferio norte' },
  { m: 3,  d: 21, n: 'Natalicio de Benito Juárez',             cat: 'festivo',   desc: 'Conmemoración del Benemérito de las Américas, 1806' },
  { m: 3,  d: 22, n: 'Día Mundial del Agua',                   cat: 'efemeride', desc: 'Conciencia sobre la importancia del recurso hídrico' },
  { m: 4,  d: 7,  n: 'Día Mundial de la Salud',                cat: 'efemeride', desc: 'Fundación de la Organización Mundial de la Salud, 1948' },
  { m: 4,  d: 22, n: 'Día de la Tierra',                       cat: 'efemeride', desc: 'Conciencia sobre la protección del medioambiente' },
  { m: 4,  d: 23, n: 'Día del Idioma Español',                 cat: 'efemeride', desc: 'Aniversario de la muerte de Miguel de Cervantes, 1616' },
  { m: 4,  d: 24, n: 'Día del Contador Público',               cat: 'efemeride', desc: 'Reconocimiento al gremio contable en México' },
  { m: 4,  d: 30, n: 'Día del Niño',                           cat: 'efemeride', desc: 'Celebración de la infancia, reconocida desde 1925' },
  { m: 5,  d: 1,  n: 'Día del Trabajo',                        cat: 'festivo',   desc: 'Conmemoración internacional de los trabajadores' },
  { m: 5,  d: 3,  n: 'Día de la Santa Cruz',                   cat: 'efemeride', desc: 'Festividad religiosa y popular en la construcción' },
  { m: 5,  d: 5,  n: 'Batalla de Puebla',                      cat: 'efemeride', desc: 'Victoria mexicana sobre el ejército francés, 1862' },
  { m: 5,  d: 10, n: 'Día de las Madres',                      cat: 'efemeride', desc: 'Celebración a las madres en México' },
  { m: 5,  d: 15, n: 'Día del Maestro',                        cat: 'efemeride', desc: 'Reconocimiento a los educadores en México' },
  { m: 5,  d: 17, n: 'Día de las Telecomunicaciones',          cat: 'efemeride', desc: 'Aniversario del primer Telégrafo Internacional, 1865' },
  { m: 5,  d: 31, n: 'Día Mundial sin Tabaco',                 cat: 'efemeride', desc: 'Conciencia sobre los daños del tabaquismo' },
  { m: 6,  d: 1,  n: 'Día del Niño (oficial México)',          cat: 'efemeride', desc: 'Fecha oficial del Día del Niño en México desde 2023' },
  { m: 6,  d: 5,  n: 'Día Mundial del Medio Ambiente',         cat: 'efemeride', desc: 'Conciencia sobre la protección del planeta' },
  { m: 6,  d: 21, n: 'Inicio del Verano',                      cat: 'efemeride', desc: 'Solsticio de verano en el hemisferio norte' },
  { m: 6,  d: 27, n: 'Día del Abogado',                        cat: 'efemeride', desc: 'Reconocimiento al gremio jurídico en México' },
  { m: 7,  d: 14, n: 'Toma de la Bastilla',                    cat: 'efemeride', desc: 'Inicio de la Revolución Francesa, 1789' },
  { m: 7,  d: 20, n: 'Independencia de Colombia',              cat: 'efemeride', desc: 'Primer Grito de Independencia colombiana, 1810' },
  { m: 7,  d: 24, n: 'Día del Administrador',                  cat: 'efemeride', desc: 'Reconocimiento al gremio administrativo y directivo' },
  { m: 7,  d: 28, n: 'Día Mundial contra la Hepatitis',        cat: 'efemeride', desc: 'Conciencia sobre la hepatitis viral en el mundo' },
  { m: 8,  d: 9,  n: 'Día de los Pueblos Indígenas',           cat: 'efemeride', desc: 'Reconocimiento a los pueblos originarios del mundo' },
  { m: 8,  d: 12, n: 'Día Internacional de la Juventud',       cat: 'efemeride', desc: 'Reconocimiento de los derechos de los jóvenes' },
  { m: 8,  d: 19, n: 'Día Mundial de la Fotografía',           cat: 'efemeride', desc: 'Aniversario de la patente del daguerrotipo, 1839' },
  { m: 9,  d: 8,  n: 'Día Internacional de la Alfabetización', cat: 'efemeride', desc: 'Derecho a la educación y erradicación del analfabetismo' },
  { m: 9,  d: 15, n: 'Noche del Grito',                        cat: 'festivo',   desc: 'Inicio simbólico de la Independencia de México, 1810' },
  { m: 9,  d: 16, n: 'Día de la Independencia de México',      cat: 'festivo',   desc: 'Conmemoración oficial de la Independencia Mexicana' },
  { m: 9,  d: 21, n: 'Día Internacional de la Paz',            cat: 'efemeride', desc: 'Reconocimiento de la paz como derecho humano fundamental' },
  { m: 9,  d: 22, n: 'Inicio del Otoño',                       cat: 'efemeride', desc: 'Equinoccio de otoño en el hemisferio norte' },
  { m: 10, d: 1,  n: 'Día de las Personas Mayores',            cat: 'efemeride', desc: 'Reconocimiento a los adultos mayores del mundo' },
  { m: 10, d: 5,  n: 'Día Mundial del Docente',                cat: 'efemeride', desc: 'Reconocimiento al papel de los educadores a nivel global' },
  { m: 10, d: 10, n: 'Día de la Salud Mental',                 cat: 'efemeride', desc: 'Conciencia sobre la importancia de la salud mental' },
  { m: 10, d: 12, n: 'Día de la Raza',                         cat: 'efemeride', desc: 'Conmemoración del encuentro de culturas en América, 1492' },
  { m: 10, d: 31, n: 'Halloween / Día de Brujas',              cat: 'efemeride', desc: 'Festividad de origen celta adoptada en México' },
  { m: 11, d: 1,  n: 'Día de Todos los Santos',                cat: 'efemeride', desc: 'Festividad religiosa y popular en México y el mundo' },
  { m: 11, d: 2,  n: 'Día de Muertos',                         cat: 'efemeride', desc: 'Tradición mexicana de honrar a los difuntos, patrimonio UNESCO' },
  { m: 11, d: 20, n: 'Revolución Mexicana',                    cat: 'festivo',   desc: 'Inicio del movimiento armado de 1910 en México' },
  { m: 11, d: 25, n: 'Día contra la Violencia hacia la Mujer', cat: 'efemeride', desc: 'Eliminación de la violencia basada en género' },
  { m: 12, d: 1,  n: 'Día Mundial del SIDA',                   cat: 'efemeride', desc: 'Conciencia y prevención del VIH/SIDA en el mundo' },
  { m: 12, d: 10, n: 'Día de los Derechos Humanos',            cat: 'efemeride', desc: 'Aniversario de la Declaración Universal de 1948' },
  { m: 12, d: 12, n: 'Día de la Virgen de Guadalupe',          cat: 'efemeride', desc: 'Festividad religiosa más importante de México' },
  { m: 12, d: 21, n: 'Inicio del Invierno',                    cat: 'efemeride', desc: 'Solsticio de invierno en el hemisferio norte' },
  { m: 12, d: 24, n: 'Nochebuena',                             cat: 'efemeride', desc: 'Víspera de la Navidad, tradición familiar en México' },
  { m: 12, d: 25, n: 'Navidad',                                cat: 'festivo',   desc: 'Celebración del nacimiento de Jesucristo' },
  { m: 12, d: 31, n: 'Nochevieja',                             cat: 'efemeride', desc: 'Último día del año, víspera de Año Nuevo' },
];

// ── static maps (computed once) ───────────────────────────────────────────────

const EFEMERIS_MAP = new Map<string, Ephemeris[]>();
for (const e of EFEMERIDES) {
  const key = `${String(e.m).padStart(2, '0')}-${String(e.d).padStart(2, '0')}`;
  if (!EFEMERIS_MAP.has(key)) EFEMERIS_MAP.set(key, []);
  EFEMERIS_MAP.get(key)!.push(e);
}

// ── chip styles ────────────────────────────────────────────────────────────────

const TYPE_CHIP: Record<EventType, string> = {
  festivo:    'bg-blue-100 text-blue-700 border border-blue-200',
  efemeride:  'bg-amber-100 text-amber-700 border border-amber-200',
  cumpleanos: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  rrhh:       'bg-pink-100 text-pink-700 border border-pink-200',
};

const TYPE_LABEL: Record<EventType, string> = {
  festivo:    'Festivo',
  efemeride:  'Efeméride',
  cumpleanos: 'Cumpleaños',
  rrhh:       'Evento RRHH',
};

// ── locale constants ──────────────────────────────────────────────────────────

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DAYS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// ── helpers ───────────────────────────────────────────────────────────────────

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function mondayFirst(jsDay: number): number {
  return (jsDay + 6) % 7;
}

function formatLongDate(iso: string): string {
  const y = parseInt(iso.slice(0, 4), 10);
  const m = parseInt(iso.slice(5, 7), 10);
  const d = parseInt(iso.slice(8, 10), 10);
  return `${d} de ${MONTHS_ES[m - 1] ?? ''} de ${y}`;
}

const LOCATION_COUNTRY: Record<string, string> = {
  Colombia: 'CO',
  'Estados Unidos': 'US',
};

function countryForLocation(loc: string | null): string {
  if (!loc) return 'MX';
  return LOCATION_COUNTRY[loc] ?? 'MX';
}

// ── component ─────────────────────────────────────────────────────────────────

interface Props {
  birthdays: BirthdayChip[];
  announcements: Announcement[];
  canCreateEvents: boolean;
  userLocation: string | null;
}

export function CalendarWidget({ birthdays, announcements, canCreateEvents, userLocation }: Props) {
  const today = new Date();
  const [year, setYear]           = useState(today.getFullYear());
  const [month, setMonth]         = useState(today.getMonth());
  const [holidays, setHolidays]   = useState<PublicHoliday[]>([]);
  const [localAnn, setLocalAnn]   = useState<Announcement[]>(announcements);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [evTitle, setEvTitle]       = useState('');
  const [evBody, setEvBody]         = useState('');
  const [evDate, setEvDate]         = useState('');
  const [saving, setSaving]         = useState(false);
  const [saveErr, setSaveErr]       = useState<string | null>(null);

  // sync from parent
  useEffect(() => { setLocalAnn(announcements); }, [announcements]);

  const country = countryForLocation(userLocation);

  useEffect(() => {
    const countries = country === 'MX' ? ['MX'] : ['MX', country];
    Promise.all(
      countries.map((c) =>
        fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${c}`)
          .then((r) => (r.ok ? (r.json() as Promise<PublicHoliday[]>) : []))
          .catch(() => [] as PublicHoliday[]),
      ),
    ).then((res) => setHolidays(res.flat()));
  }, [year, country]);

  const holidayMap = useMemo(() => {
    const m = new Map<string, string>();
    holidays.forEach((h) => m.set(h.date, h.localName || h.name));
    return m;
  }, [holidays]);

  const birthdayByMD = useMemo(() => {
    const m = new Map<string, BirthdayChip[]>();
    birthdays.forEach((b) => {
      if (!m.has(b.birthDate)) m.set(b.birthDate, []);
      m.get(b.birthDate)!.push(b);
    });
    return m;
  }, [birthdays]);

  const annByDate = useMemo(() => {
    const m = new Map<string, Announcement[]>();
    localAnn.forEach((a) => {
      if (a.eventDate) {
        if (!m.has(a.eventDate)) m.set(a.eventDate, []);
        m.get(a.eventDate)!.push(a);
      }
    });
    return m;
  }, [localAnn]);

  function eventsFor(dateStr: string, monthDay: string): DayEvent[] {
    const list: DayEvent[] = [];
    const seen = new Set<string>();

    function add(e: DayEvent) {
      const key = `${e.type}::${e.label}`;
      if (!seen.has(key)) { seen.add(key); list.push(e); }
    }

    const holidayName = holidayMap.get(dateStr);
    if (holidayName) {
      add({ id: `h-${dateStr}`, label: holidayName, type: 'festivo' });
    }

    for (const ef of EFEMERIS_MAP.get(monthDay) ?? []) {
      add({ id: `ef-${ef.m}-${ef.d}-${ef.n}`, label: ef.n, description: ef.desc, type: ef.cat === 'festivo' ? 'festivo' : 'efemeride' });
    }

    for (const b of birthdayByMD.get(monthDay) ?? []) {
      add({ id: `bd-${b.id}`, label: b.fullName, type: 'cumpleanos' });
    }

    for (const a of annByDate.get(dateStr) ?? []) {
      add({ id: `rrhh-${a.id}`, label: a.title, description: a.body, type: 'rrhh' });
    }

    return list;
  }

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!evTitle.trim() || !evBody.trim() || !evDate) return;
    setSaving(true);
    setSaveErr(null);
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: evTitle.trim(), body: evBody.trim(), eventDate: evDate }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? 'Error al guardar');
      }
      const created = (await res.json()) as Announcement;
      setLocalAnn((prev) => [created, ...prev]);
      setShowDialog(false);
      setEvTitle('');
      setEvBody('');
      setEvDate('');
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  }

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  const firstOffset = mondayFirst(new Date(year, month, 1).getDay());
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr    = isoToday();

  const cells: (number | null)[] = [
    ...Array<null>(firstOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const MAX_CHIPS = 2;

  const selectedEvents = useMemo(() => {
    if (!selectedDate) return [];
    const [, sm, sd] = selectedDate.split('-');
    return eventsFor(selectedDate, `${sm}-${sd}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, holidayMap, birthdayByMD, annByDate]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-navy text-sm">Calendario laboral</h2>
        <div className="flex items-center gap-2">
          {canCreateEvents && (
            <button
              onClick={() => setShowDialog(true)}
              className="text-xs font-medium text-pink-600 border border-pink-300 rounded-md px-2.5 py-1 hover:bg-pink-50 transition-colors"
            >
              + Evento
            </button>
          )}
          <div className="flex items-center gap-0.5">
            <button
              onClick={prevMonth}
              className="p-1 rounded hover:bg-slate-100 text-slate-500 transition-colors"
              aria-label="Mes anterior"
            >
              ‹
            </button>
            <span className="text-sm font-medium text-slate-700 min-w-[140px] text-center">
              {MONTHS_ES[month]} {year}
            </span>
            <button
              onClick={nextMonth}
              className="p-1 rounded hover:bg-slate-100 text-slate-500 transition-colors"
              aria-label="Mes siguiente"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* ── Day labels ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_ES.map((d) => (
          <div key={d} className="text-[10px] font-medium text-slate-400 pb-1 text-center">{d}</div>
        ))}
      </div>

      {/* ── Grid ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} className="min-h-[72px]" />;

          const mm       = String(month + 1).padStart(2, '0');
          const dd       = String(day).padStart(2, '0');
          const dateStr  = `${year}-${mm}-${dd}`;
          const monthDay = `${mm}-${dd}`;
          const isToday  = dateStr === todayStr;
          const events   = eventsFor(dateStr, monthDay);
          const visible  = events.slice(0, MAX_CHIPS);
          const overflow = events.length - MAX_CHIPS;
          const isSel    = selectedDate === dateStr;

          return (
            <div
              key={dateStr}
              onClick={() => {
                if (events.length > 0) setSelectedDate(isSel ? null : dateStr);
              }}
              className={`rounded-lg p-1 min-h-[72px] flex flex-col transition-colors ${
                events.length > 0 ? 'cursor-pointer' : 'cursor-default'
              } ${isToday ? 'ring-2 ring-terracota ring-offset-1' : ''} ${
                isSel
                  ? 'bg-slate-100'
                  : events.length > 0
                  ? 'hover:bg-slate-50'
                  : ''
              }`}
            >
              <span
                className={`text-[11px] font-semibold leading-none mb-1 ${
                  isToday ? 'text-terracota' : 'text-slate-600'
                }`}
              >
                {day}
              </span>
              <div className="space-y-0.5 flex-1 overflow-hidden">
                {visible.map((ev) => (
                  <span
                    key={ev.id}
                    className={`block text-[9px] leading-tight truncate rounded px-1 py-0.5 ${TYPE_CHIP[ev.type]}`}
                  >
                    {ev.label}
                  </span>
                ))}
                {overflow > 0 && (
                  <span className="block text-[9px] text-slate-400 leading-tight pl-1">
                    +{overflow} más
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Detail panel ────────────────────────────────────────────────────── */}
      {selectedDate && selectedEvents.length > 0 && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-navy capitalize">
              {formatLongDate(selectedDate)}
            </h3>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-slate-400 hover:text-slate-600 text-lg leading-none transition-colors"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
          <ul className="space-y-2.5">
            {selectedEvents.map((ev) => (
              <li key={ev.id} className="flex items-start gap-2.5">
                <span
                  className={`mt-0.5 flex-shrink-0 text-[10px] font-medium rounded px-1.5 py-0.5 whitespace-nowrap ${TYPE_CHIP[ev.type]}`}
                >
                  {TYPE_LABEL[ev.type]}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy leading-tight">{ev.label}</p>
                  {ev.description && (
                    <p className="text-xs text-slate-500 mt-0.5 leading-snug">{ev.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Legend ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 pt-3 border-t border-slate-100">
        <LegendItem color="ring-2 ring-terracota ring-offset-1 bg-transparent rounded-full" label="Hoy" />
        <LegendItem color="bg-blue-200 rounded" label="Festivo" />
        <LegendItem color="bg-amber-200 rounded" label="Efeméride" />
        <LegendItem color="bg-emerald-200 rounded" label="Cumpleaños" />
        <LegendItem color="bg-pink-200 rounded" label="Evento RRHH" />
      </div>

      {/* ── + Evento dialog ──────────────────────────────────────────────────── */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl p-6">
            <h3 className="font-semibold text-navy mb-4">Nuevo evento RRHH</h3>
            <form onSubmit={handleCreateEvent} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Fecha del evento
                </label>
                <input
                  type="date"
                  value={evDate}
                  onChange={(e) => setEvDate(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Título</label>
                <input
                  type="text"
                  value={evTitle}
                  onChange={(e) => setEvTitle(e.target.value)}
                  maxLength={200}
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                  placeholder="Nombre del evento"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
                <textarea
                  value={evBody}
                  onChange={(e) => setEvBody(e.target.value)}
                  required
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 resize-none"
                  placeholder="Detalles del evento..."
                />
              </div>
              {saveErr && <p className="text-xs text-red-500">{saveErr}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowDialog(false); setSaveErr(null); }}
                  className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Guardando…' : 'Guardar evento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-500">
      <span className={`w-2.5 h-2.5 inline-block flex-shrink-0 ${color}`} />
      {label}
    </span>
  );
}
