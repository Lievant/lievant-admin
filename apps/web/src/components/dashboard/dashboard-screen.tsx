'use client';

import { useState } from 'react';
import type { Announcement, CurrentUser, DashboardData } from '@/lib/api';
import Link from 'next/link';
import { AnnouncementsCard } from './announcements-card';
import { BirthdaysCard } from './birthdays-card';
import { BookingsCard } from './bookings-card';
import { CalendarWidget } from './calendar-widget';
import { PendingApprovalsCard } from './pending-approvals-card';
import { QuoteWidget } from './quote-widget';

// ── helpers ──────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function formatDate() {
  return new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function hasSectionPerm(user: CurrentUser | null, section: string): boolean {
  if (!user) return false;
  if (user.roles.some((r) => r.name === 'SUPER_ADMIN')) return true;
  return user.permissions.some((p) => p.section === section);
}

// ── parent modules ────────────────────────────────────────────────────────────

interface SectionChip {
  label: string;
  href: string;
  section: string;
}

const SECTION_CHIPS: SectionChip[] = [
  { label: 'Finanzas',              href: '/finanzas',       section: 'finanzas' },
  { label: 'RRHH',                  href: '/rrhh',           section: 'rrhh' },
  { label: 'Transformación Digital', href: '/transformacion', section: 'transformacion' },
  { label: 'Herramientas',          href: '/herramientas',   section: 'herramientas' },
];

const SUPER_ADMIN_CHIPS: SectionChip[] = [
  { label: 'Ecommerce',     href: '/ecommerce',     section: '' },
  { label: 'Marketing',     href: '/marketing',     section: '' },
  { label: 'Omnicanalidad', href: '/omnicanalidad', section: '' },
  { label: 'Configuración', href: '/admin/usuarios', section: '' },
];

// ── photo placeholder ─────────────────────────────────────────────────────────

function PhotoPlaceholder({ name, email }: { name: string; email?: string | null }) {
  const abbr = name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  if (email) {
    return (
      <DashboardPhoto name={name} email={email} abbr={abbr} />
    );
  }

  return <WireframePhoto abbr={abbr} />;
}

function DashboardPhoto({ name, email, abbr }: { name: string; email: string; abbr: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <WireframePhoto abbr={abbr} />;
  return (
    <img
      src={`/api/users/${encodeURIComponent(email)}/photo`}
      alt={name}
      className="flex-shrink-0 rounded-xl object-cover"
      style={{ width: 100, minHeight: 120, height: 120 }}
      onError={() => setFailed(true)}
    />
  );
}

function WireframePhoto({ abbr }: { abbr: string }) {
  return (
    <div
      className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-terracota/40 bg-terracota-bg text-terracota select-none"
      style={{ width: 100, minHeight: 120 }}
    >
      <svg
        viewBox="0 0 60 72"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-14 h-14 opacity-40"
        aria-hidden="true"
      >
        <circle cx="30" cy="22" r="13" stroke="currentColor" strokeWidth="2" strokeDasharray="4 2" />
        <path
          d="M6 66 Q6 46 30 42 Q54 46 54 66"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="4 2"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-xs font-bold mt-1 tracking-wide">{abbr}</span>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

interface Props {
  user: CurrentUser | null;
  dashboardData: DashboardData | null;
  announcements: Announcement[];
}

export function DashboardScreen({ user, dashboardData, announcements }: Props) {
  const isSuperAdmin = user?.roles.some((r) => r.name === 'SUPER_ADMIN') ?? false;
  const canManage =
    isSuperAdmin || (user?.permissions.some((p) => p.section === 'rrhh' && p.module === 'comunicados' && p.action === 'write') ?? false);

  const visibleSections: SectionChip[] = isSuperAdmin
    ? [...SECTION_CHIPS, ...SUPER_ADMIN_CHIPS]
    : SECTION_CHIPS.filter((s) => s.section === 'herramientas' || hasSectionPerm(user, s.section));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-5">

      {/* ── Header: 3 tercios ─────────────────────────────────────────────── */}
      <header className="grid grid-cols-3 gap-6 rounded-xl border border-slate-200 bg-white px-6 py-5">

        {/* Tercio izquierdo — foto + identidad */}
        <div className="flex items-center gap-4">
          <PhotoPlaceholder name={user?.name ?? 'Invitado'} email={user?.email ?? null} />
          <div className="min-w-0">
            <p className="text-xs text-slate-400 capitalize">{formatDate()}</p>
            <p className="text-xl font-medium text-navy leading-snug mt-0.5">
              {greeting()},<br />
              <span className="font-semibold">{user?.name ?? 'Invitado'}</span>
            </p>
            <p className="text-xs text-slate-500 mt-1 truncate">
              {user?.email ?? ''}
            </p>
          </div>
        </div>

        {/* Tercio central — frase del día */}
        <div className="flex items-center justify-center border-x border-slate-100 px-4">
          <QuoteWidget />
        </div>

        {/* Tercio derecho — accesos directos por sección */}
        <div className="pl-2">
          <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
            Mis módulos
          </p>
          {visibleSections.length === 0 ? (
            <p className="text-xs text-slate-400">Sin módulos asignados.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {visibleSections.map((chip) => (
                <Link
                  key={chip.href}
                  href={chip.href}
                  className="inline-flex items-center rounded-md border border-terracota/30 bg-terracota-bg px-3 py-1.5 text-xs font-medium text-terracota-dark hover:bg-terracota hover:text-white transition-colors"
                >
                  {chip.label}
                </Link>
              ))}
            </div>
          )}
        </div>

      </header>

      {!user && (
        <div className="rounded-lg border border-terracota/30 bg-terracota-bg px-4 py-3 text-sm text-terracota-dark">
          No se pudo verificar la sesión con la API. Mostrando vista previa.
        </div>
      )}

      {/* ── Aprobaciones pendientes (solo si el usuario tiene reportes con solicitudes) ── */}
      <PendingApprovalsCard />

      {/* ── Grid 2 cols ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BookingsCard bookings={dashboardData?.todayBookings ?? []} />
        <BirthdaysCard
          today={dashboardData?.todayBirthdays ?? []}
          upcoming={dashboardData?.upcomingBirthdays ?? []}
        />
      </div>

      {/* ── Tablón ──────────────────────────────────────────────────────── */}
      <AnnouncementsCard initialAnnouncements={announcements} canManage={canManage} />

      {/* ── Calendario ──────────────────────────────────────────────────── */}
      <CalendarWidget
        announcements={announcements}
        canCreateEvents={canManage}
        userLocation={user?.location ?? null}
      />

    </div>
  );
}
