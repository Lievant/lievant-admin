'use client';

import type { DashboardBirthday, DashboardUpcomingBirthday } from '@/lib/api';

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

function Avatar({ name, isToday }: { name: string; isToday: boolean }) {
  return (
    <span
      className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
        isToday
          ? 'border-2 border-black bg-zinc-50 text-black'
          : 'bg-slate-100 text-slate-600'
      }`}
    >
      {initials(name)}
    </span>
  );
}

interface Props {
  today: DashboardBirthday[];
  upcoming: DashboardUpcomingBirthday[];
}

export function BirthdaysCard({ today, upcoming }: Props) {
  const hasAny = today.length > 0 || upcoming.length > 0;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-navy text-sm mb-3">Cumpleaños</h2>

      {!hasAny ? (
        <p className="text-xs text-slate-400 py-4 text-center">Sin cumpleaños esta semana.</p>
      ) : (
        <div className="space-y-3">
          {today.length > 0 && (
            <div>
              <p className="text-xs font-medium text-black mb-1.5">Hoy</p>
              <ul className="space-y-1.5">
                {today.map((b) => (
                  <li key={b.id} className="flex items-center gap-2">
                    <Avatar name={b.fullName} isToday />
                    <div className="min-w-0">
                      <p className="text-sm text-navy truncate">{b.fullName}</p>
                      <p className="text-xs text-slate-400">{b.area ?? b.division ?? ''}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {upcoming.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1.5">Próximos 7 días</p>
              <ul className="space-y-1.5">
                {upcoming.map((b) => (
                  <li key={b.id} className="flex items-center gap-2">
                    <Avatar name={b.fullName} isToday={false} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-navy truncate">{b.fullName}</p>
                      <p className="text-xs text-slate-400">{b.area ?? b.division ?? ''}</p>
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      en {b.daysUntil}d
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
