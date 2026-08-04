'use client';

// 1=Lunes … 7=Domingo (ISO). Default de negocio: lunes a viernes.
export const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5];

const DAYS: { value: number; label: string }[] = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 7, label: 'Dom' },
];

interface WorkDaysPickerProps {
  label?: string;
  value: number[];
  onChange: (days: number[]) => void;
}

export function WorkDaysPicker({ label = 'Días laborales', value, onChange }: WorkDaysPickerProps) {
  function toggle(day: number) {
    const next = value.includes(day) ? value.filter((d) => d !== day) : [...value, day];
    onChange(next.sort((a, b) => a - b));
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {DAYS.map((day) => {
          const active = value.includes(day.value);
          return (
            <button
              key={day.value}
              type="button"
              onClick={() => toggle(day.value)}
              aria-pressed={active}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? 'border-black bg-black text-white'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
              }`}
            >
              {day.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
