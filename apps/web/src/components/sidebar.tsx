'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  BroadcastIcon,
  BuildingIcon,
  CpuIcon,
  DoorIcon,
  HomeIcon,
  IdCardIcon,
  LaptopIcon,
  LicenseIcon,
  ListIcon,
  LogoutIcon,
  PeopleIcon,
  ReportMoneyIcon,
  ShieldLockIcon,
  ShoppingCartIcon,
  SpeakerphoneIcon,
  TableIcon,
  TicketIcon,
  TruckIcon,
  UsersGroupIcon,
} from '@/components/icons';
import type { CurrentUser } from '@/lib/api';

interface SidebarProps {
  user: CurrentUser | null;
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const isSuperAdmin = (user?.roles.some((r) => r.name === 'SUPER_ADMIN') ?? false) || !user;

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

        <SectionLabel>Módulos</SectionLabel>

        <NavLink href="/finanzas" active={pathname.startsWith('/finanzas')}>
          <ReportMoneyIcon className="h-5 w-5" />
          Finanzas
        </NavLink>
        {pathname.startsWith('/finanzas') && (
          <SubMenu>
            <NavSubLink href="/finanzas/clientes" active={pathname.startsWith('/finanzas/clientes')}>
              <BuildingIcon className="h-4 w-4" />
              Clientes
            </NavSubLink>
            <NavSubLink href="/finanzas/proveedores" active={pathname.startsWith('/finanzas/proveedores')}>
              <TruckIcon className="h-4 w-4" />
              Proveedores
            </NavSubLink>
            <NavSubLink href="/finanzas/reportes" active={pathname.startsWith('/finanzas/reportes')}>
              <TableIcon className="h-4 w-4" />
              Reportes
            </NavSubLink>
          </SubMenu>
        )}

        <NavLink href="/rrhh" active={pathname.startsWith('/rrhh')}>
          <PeopleIcon className="h-5 w-5" />
          RRHH
        </NavLink>
        {pathname.startsWith('/rrhh') && (
          <SubMenu>
            <NavSubLink href="/rrhh/empleados" active={pathname.startsWith('/rrhh/empleados')}>
              <IdCardIcon className="h-4 w-4" />
              Empleados
            </NavSubLink>
            <NavSubLink href="/rrhh/reportes" active={pathname.startsWith('/rrhh/reportes')}>
              <TableIcon className="h-4 w-4" />
              Reportes
            </NavSubLink>
          </SubMenu>
        )}

        <NavLink href="/ecommerce" active={pathname.startsWith('/ecommerce')}>
          <ShoppingCartIcon className="h-5 w-5" />
          Ecommerce
        </NavLink>

        <NavLink href="/marketing" active={pathname.startsWith('/marketing')}>
          <SpeakerphoneIcon className="h-5 w-5" />
          Marketing Digital
        </NavLink>

        <NavLink href="/omnicanalidad" active={pathname.startsWith('/omnicanalidad')}>
          <BroadcastIcon className="h-5 w-5" />
          Omnicanalidad
        </NavLink>

        <NavLink href="/transformacion" active={pathname.startsWith('/transformacion')}>
          <CpuIcon className="h-5 w-5" />
          Transformación Digital
        </NavLink>
        {pathname.startsWith('/transformacion') && (
          <SubMenu>
            <NavSubLink
              href="/transformacion/licenciamientos"
              active={pathname.startsWith('/transformacion/licenciamientos')}
            >
              <LicenseIcon className="h-4 w-4" />
              Maestro de Licenciamientos
            </NavSubLink>
            <NavSubLink
              href="/transformacion/inventario"
              active={pathname.startsWith('/transformacion/inventario')}
            >
              <LaptopIcon className="h-4 w-4" />
              Inventario Tecnológico
            </NavSubLink>
            <NavSubLink
              href="/transformacion/tickets"
              active={pathname.startsWith('/transformacion/tickets')}
            >
              <TicketIcon className="h-4 w-4" />
              Tickets de Soporte
            </NavSubLink>
          </SubMenu>
        )}

        <SectionLabel>Herramientas</SectionLabel>
        <NavLink href="/herramientas/salas" active={pathname.startsWith('/herramientas/salas')}>
          <DoorIcon className="h-5 w-5" />
          Reserva de salas
        </NavLink>

        {isSuperAdmin && (
          <>
            <SectionLabel>Configuración</SectionLabel>
            <NavLink href="/admin/usuarios" active={pathname.startsWith('/admin/usuarios')}>
              <UsersGroupIcon className="h-5 w-5" />
              Usuarios
            </NavLink>
            <NavLink href="/admin/permisos" active={pathname.startsWith('/admin/permisos')}>
              <ShieldLockIcon className="h-5 w-5" />
              Permisos
            </NavLink>
            <NavLink href="/admin/catalogos" active={pathname.startsWith('/admin/catalogos')}>
              <ListIcon className="h-5 w-5" />
              Catálogos
            </NavLink>
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
        <a
          href="/api/auth/logout"
          className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-navy-light hover:text-white"
        >
          <LogoutIcon className="h-5 w-5" />
          Cerrar sesión
        </a>
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </p>
  );
}

function SubMenu({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 space-y-1 border-l border-white/10 pl-3">{children}</div>;
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

function NavSubLink({
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
        'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
        active
          ? 'bg-terracota/20 font-medium text-white'
          : 'text-slate-400 hover:bg-navy-light hover:text-white',
      )}
    >
      {children}
    </Link>
  );
}
