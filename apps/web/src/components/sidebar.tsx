'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { MODULES, modulesForRoles } from '@/lib/modules';
import { HomeIcon, LogoutIcon, ModuleIconView } from '@/components/icons';
import type { CurrentUser } from '@/lib/api';

interface SidebarProps {
  user: CurrentUser | null;
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const roleNames = user?.roles.map((role) => role.name) ?? [];
  const modules = modulesForRoles(roleNames);

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-navy text-slate-200">
      <div className="flex h-16 items-center gap-2 border-b border-white/10 px-6">
        <span className="text-lg font-bold tracking-tight text-white">
          Lievant<span className="text-terracota">.</span>
        </span>
        <span className="text-xs font-medium text-slate-400">Admin</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <NavLink href="/dashboard" active={pathname === '/dashboard'}>
          <HomeIcon className="h-5 w-5" />
          Inicio
        </NavLink>

        <p className="mt-4 px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Módulos
        </p>
        {modules
          .filter((mod) => mod.id !== 'admin')
          .map((mod) => (
            <NavLink key={mod.id} href={mod.href} active={pathname.startsWith(mod.href)}>
              <ModuleIconView icon={mod.icon} className="h-5 w-5" />
              {mod.name}
            </NavLink>
          ))}

        {modules.some((mod) => mod.id === 'admin') && (
          <>
            <p className="mt-4 px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Administración
            </p>
            {MODULES.filter((mod) => mod.id === 'admin').map((mod) => (
              <NavLink key={mod.id} href={mod.href} active={pathname.startsWith(mod.href)}>
                <ModuleIconView icon={mod.icon} className="h-5 w-5" />
                {mod.name}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracota text-sm font-semibold text-white">
            {(user?.name ?? '?').slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user?.name ?? 'Invitado'}</p>
            <p className="truncate text-xs text-slate-400">{user?.email ?? 'Sesión no iniciada'}</p>
          </div>
        </div>
        <Link
          href="/login"
          className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-navy-light hover:text-white"
        >
          <LogoutIcon className="h-5 w-5" />
          Cerrar sesión
        </Link>
      </div>
    </aside>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-terracota text-white'
          : 'text-slate-300 hover:bg-navy-light hover:text-white',
      )}
    >
      {children}
    </Link>
  );
}
