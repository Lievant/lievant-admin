'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  BellIcon,
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
  SpeakerphoneIcon,
  TableIcon,
  TargetIcon,
  TicketIcon,
  TruckIcon,
  UsersGroupIcon,
  WalletIcon,
} from '@/components/icons';
import { useNotifications } from '@/hooks/use-notifications';
import type { CurrentUser } from '@/lib/api';

interface SidebarProps {
  user: CurrentUser | null;
}

function isSuperAdmin(user: CurrentUser | null): boolean {
  return user?.roles.some((r) => r.name === 'SUPER_ADMIN') ?? false;
}

// Sin usuario (fallo de /auth/me o sesión aún no resuelta) se muestra todo, para
// que el sidebar no quede vacío por una caída de la API.
function hasSection(user: CurrentUser | null, section: string): boolean {
  if (!user) return true;
  if (isSuperAdmin(user)) return true;
  return user.permissions.some((p) => p.section === section);
}

// `action` es opcional porque no todos los módulos tienen permiso de lectura:
// admin.roles y admin.catalogos solo existen con acción 'write', así que exigir
// 'read' los ocultaría siempre. Sin `action` basta cualquier permiso del módulo.
function hasModule(
  user: CurrentUser | null,
  section: string,
  module: string,
  action?: string,
): boolean {
  if (!user) return true;
  if (isSuperAdmin(user)) return true;
  return user.permissions.some(
    (p) => p.section === section && p.module === module && (!action || p.action === action),
  );
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const showFinanzas = hasSection(user, 'finanzas');
  const showRrhh = hasSection(user, 'rrhh');
  const showTransformacion = hasSection(user, 'transformacion');
  const showMedios = hasSection(user, 'medios');
  const showModulos = showFinanzas || showMedios || showRrhh || showTransformacion;

  // Herramientas: cada link se controla por su módulo y la sección entera se
  // oculta si el usuario no conserva ninguno.
  const showNotificaciones = hasModule(user, 'herramientas', 'notificaciones', 'read');
  const showSalas = hasModule(user, 'herramientas', 'salas');
  const showSoporte = hasModule(user, 'herramientas', 'tickets');
  const showIsobot = hasModule(user, 'herramientas', 'isobot');
  const showVacaciones = hasModule(user, 'herramientas', 'vacaciones', 'read');
  const showHerramientas =
    showNotificaciones || showSalas || showSoporte || showIsobot || showVacaciones;

  // Configuración: basta un permiso de section 'admin', no ser SUPER_ADMIN.
  const showUsuarios = hasModule(user, 'admin', 'usuarios');
  const showPermisos = hasModule(user, 'admin', 'roles');
  const showCatalogos = hasModule(user, 'admin', 'catalogos');
  const showAdmin = showUsuarios || showPermisos || showCatalogos;

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-black text-white">
      <div className="flex h-16 items-center border-b border-white/10 px-6">
        <img src="/images/lievant-isotipo.png" alt="Lievant" className="h-8 w-auto" />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <NavLink href="/dashboard" active={pathname === '/dashboard'}>
          <HomeIcon className="h-5 w-5" />
          Inicio
        </NavLink>

        {showModulos && <SectionLabel>Módulos</SectionLabel>}

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

        {/* Ecommerce, Marketing Digital y Omnicanalidad no tienen módulos ni
            permisos definidos todavía (no existe ninguna fila en
            auth.permissions con esas secciones), así que no se listan. Al
            desarrollarlos, volver a agregarlos envueltos en hasSection(). */}

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

        {showHerramientas && (
          <>
            <SectionLabel>Herramientas</SectionLabel>
            {showNotificaciones && (
              <NavLink
                href="/herramientas/mis-notificaciones"
                active={pathname.startsWith('/herramientas/mis-notificaciones')}
              >
                <BellIcon className="h-5 w-5" />
                Mis Notificaciones
                <UnreadBadge />
              </NavLink>
            )}
            {showSalas && (
              <NavLink href="/herramientas/salas" active={pathname.startsWith('/herramientas/salas')}>
                <DoorIcon className="h-5 w-5" />
                Reserva de salas
              </NavLink>
            )}
            {showSoporte && (
              <NavLink
                href="/herramientas/soporte"
                active={pathname.startsWith('/herramientas/soporte')}
              >
                <HeadsetIcon className="h-5 w-5" />
                Soporte TI
              </NavLink>
            )}
            {showIsobot && (
              <NavLink href="/herramientas/isobot" active={pathname.startsWith('/herramientas/isobot')}>
                <RobotIcon className="h-5 w-5" />
                ISOBOT
              </NavLink>
            )}
            {showVacaciones && (
              <NavLink
                href="/herramientas/vacaciones"
                active={pathname.startsWith('/herramientas/vacaciones')}
              >
                <PlaneIcon className="h-5 w-5" />
                Vacaciones
              </NavLink>
            )}
          </>
        )}

        {showAdmin && (
          <>
            <SectionLabel>Configuración</SectionLabel>
            {showUsuarios && (
              <NavLink href="/admin/usuarios" active={pathname.startsWith('/admin/usuarios')}>
                <UsersGroupIcon className="h-5 w-5" />
                Usuarios
              </NavLink>
            )}
            {showPermisos && (
              <NavLink href="/admin/permisos" active={pathname.startsWith('/admin/permisos')}>
                <ShieldLockIcon className="h-5 w-5" />
                Permisos
              </NavLink>
            )}
            {showCatalogos && (
              <NavLink href="/admin/catalogos" active={pathname.startsWith('/admin/catalogos')}>
                <ListIcon className="h-5 w-5" />
                Catálogos
              </NavLink>
            )}
          </>
        )}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <SidebarAvatar name={user?.name ?? '?'} email={user?.email ?? null} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user?.name ?? 'Invitado'}</p>
            <p className="truncate text-xs text-white/50">{user?.email ?? 'Sesión no iniciada'}</p>
          </div>
        </div>
        <a
          href="/api/auth/logout"
          className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/80 transition-colors hover:bg-zinc-900 hover:text-white"
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
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-black">
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
      <div className="hidden h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-semibold text-black">
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
    <p className="mt-4 mb-1 ml-3 inline-block rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
      {children}
    </p>
  );
}

function SubMenu({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 space-y-1 border-l border-white/10 pl-3">{children}</div>;
}

/**
 * Contador de no leídas del sidebar. Vive en su propio componente para que el
 * WebSocket solo re-renderice el badge y no todo el árbol de navegación.
 */
function UnreadBadge() {
  const { unreadCount } = useNotifications();
  if (unreadCount <= 0) return null;

  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-bold leading-none text-white">
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
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
        active ? 'bg-zinc-800 text-white' : 'text-white hover:bg-zinc-900',
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
          ? 'bg-zinc-800 font-medium text-white'
          : 'text-white/70 hover:bg-zinc-900 hover:text-white',
      )}
    >
      {children}
    </Link>
  );
}
