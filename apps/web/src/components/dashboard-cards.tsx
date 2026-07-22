import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// ─── StatCard ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value?: string | number;
  href: string;
  description?: string;
  className?: string;
}

export function StatCard({ label, value = '—', href, description, className }: StatCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md',
        className,
      )}
    >
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="text-3xl font-bold text-navy">{value}</p>
      {description && (
        <p className="mt-1 text-xs text-slate-400">{description}</p>
      )}
    </Link>
  );
}

// ─── ModuleCard ───────────────────────────────────────────────────────────────

interface ModuleCardProps {
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
  accentClass?: string;
}

export function ModuleCard({
  title,
  description,
  href,
  icon,
  accentClass = 'text-navy bg-slate-100',
}: ModuleCardProps) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
          accentClass,
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-navy group-hover:text-terracota transition-colors">
          {title}
        </p>
        <p className="mt-0.5 text-sm text-slate-500">{description}</p>
      </div>
      <span className="ml-auto text-slate-300 group-hover:text-terracota transition-colors">→</span>
    </Link>
  );
}

// ─── ComingSoonBadge ──────────────────────────────────────────────────────────

export function ComingSoonBadge() {
  return (
    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-600">
      Próximamente
    </span>
  );
}
