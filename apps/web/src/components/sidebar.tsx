'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  BellIcon,
  BroadcastIcon,
  BuildingIcon,
  ChartDotsIcon,
  CpuIcon,
  DoorIcon,
  GearIcon,
  HeadsetIcon,
  HomeIcon,
  IdCardIcon,
  LaptopIcon,
  LicenseIcon,
  ListIcon,
  LogoutIcon,
  MegaphoneIcon,
  PeopleIcon,
  PlaneIcon,
  ReportMoneyIcon,
  RobotIcon,
  ShieldLockIcon,
  ShoppingCartIcon,
  SpeakerphoneIcon,
  TableIcon,
  TargetIcon,
  TicketIcon,
  TruckIcon,
  UsersGroupIcon,
  WalletIcon,
} from '@/components/icons';
import type { CurrentUser } from '@/lib/api';

interface SidebarProps {
  user: CurrentUser | null;
}

function hasSection(user: CurrentUser | null, section: string): boolean {
  if (!user) return true;
  if (user.roles.some((r) => r.name === 'SUPER_ADMIN')) return true;
  return user.permissions.some((p) => p.section === section);
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const isSuperAdmin = (user?.roles.some((r) => r.name === 'SUPER_ADMIN') ?? false) || !user;
  const showFinanzas = hasSection(user, 'finanzas');
  const showRrhh = hasSection(user, 'rrhh');
  const showTransformacion = hasSection(user, 'transformacion');
  const showMedios = hasSection(user, 'medios');

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

        {showFinanzas && (
          <>
            <NavLink href="/finanzas" active={pathname.startsWith('/finanzas')}>
              <ReportMoneyIcon className="h-5 w-5" />
              Finanzas
            </NavLink>
            {pathname.startsWith('/finanzas') && (
              <SubMenu>
                <NavSubLink href="/finanzas/proyectos" active={pathname.startsWith('/finanzas/proyectos')}>
                  <ListIcon className="h-4 w-4" />
                  Proyectos
                </NavSubLink>
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
          </>
        )}

        {showMedios && (
          <>
            <NavLink href="/medios" active={pathname === '/medios'}>
              <ChartDotsIcon className="h-5 w-5" />
              Medios
            </NavLink>
            {pathname.startsWith('/medios') && (
              <SubMenu>
                <NavSubLink href="/medios/meta" active={pathname.startsWith('/medios/meta')}>
                  <SpeakerphoneIcon className="h-4 w-4" />
                  Meta Ads
                </NavSubLink>
                <NavSubLink href="/medios/google" active={pathname.startsWith('/medios/google')}>
                  <TargetIcon className="h-4 w-4" />
                  Google Ads
                </NavSubLink>
                <NavSubLink href="/medios/x" active={pathname.startsWith('/medios/x')}>
                  <MegaphoneIcon className="h-4 w-4" />
                  X Ads
                </NavSubLink>
                <NavSubLink
                  href="/medios/presupuestos"
                  active={pathname.startsWith('/medios/presupuestos')}
                >
                  <WalletIcon className="h-4 w-4" />
                  Presupuestos
                </NavSubLink>
                <NavSubLink href="/medios/alertas" active={pathname.startsWith('/medios/alertas')}>
                  <BellIcon className="h-4 w-4" />
                  Alertas
                  <MediaAlertsBadge />
                </NavSubLink>
                <NavSubLink
                  href="/medios/configuracion"
                  active={pathname.startsWith('/medios/configuracion')}
                >
                  <GearIcon className="h-4 w-4" />
                  Configuración
                </NavSubLink>
              </SubMenu>
            )}
          </>
        )}

        {showRrhh && (
          <>
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
          </>
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

        {showTransformacion && (
          <>
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
                <NavSubLink
                  href="/transformacion/reportes"
                  active={pathname.startsWith('/transformacion/reportes')}
                >
                  <TableIcon className="h-4 w-4" />
                  Reportes
                </NavSubLink>
              </SubMenu>
            )}
          </>
        )}

        <SectionLabel>Herramientas</SectionLabel>
        <NavLink href="/herramientas/salas" active={pathname.startsWith('/herramientas/salas')}>
          <DoorIcon className="h-5 w-5" />
          Reserva de salas
        </NavLink>
        <NavLink href="/herramientas/soporte" active={pathname.startsWith('/herramientas/soporte')}>
          <HeadsetIcon className="h-5 w-5" />
          Soporte TI
        </NavLink>
        <NavLink href="/herramientas/isobot" active={pathname.startsWith('/herramientas/isobot')}>
          <RobotIcon className="h-5 w-5" />
          ISOBOT
        </NavLink>
        <NavLink href="/herramientas/vacaciones" active={pathname.startsWith('/herramientas/vacaciones')}>
          <PlaneIcon className="h-5 w-5" />
          Vacaciones
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
          <SidebarAvatar name={user?.name ?? '?'} email={user?.email ?? null} />
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

function SidebarAvatar({ name, email }: { name: string; email: string | null }) {
  const initial = name.slice(0, 1).toUpperCase();
  if (!email) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracota text-sm font-semibold text-white">
        {initial}
      </div>
    );
  }
  return (
    <div className="relative h-9 w-9 shrink-0">
      <img
        src={`/api/users/${encodeURIComponent(email)}/photo`}
        alt={name}
        className="h-9 w-9 rounded-full object-cover"
        onError={(e) => {
          const target = e.currentTarget;
          target.style.display = 'none';
          const fallback = target.nextElementSibling as HTMLElement | null;
          if (fallback) fallback.style.display = 'flex';
        }}
      />
      <div className="hidden h-9 w-9 items-center justify-center rounded-full bg-terracota text-sm font-semibold text-white">
        {initial}
      </div>
    </div>
  );
}

function MediaAlertsBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    fetch('/api/media/alerts/count')
      .then((res) => (res.ok ? res.json() : { count: 0 }))
      .then((data: { count?: number }) => {
        if (active) setCount(data.count ?? 0);
      })
      .catch(() => {
        /* silencioso: sin permisos o backend no disponible */
      });
    return () => {
      active = false;
    };
  }, []);

  if (count <= 0) return null;
  return (
    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
      {count}
    </span>
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
