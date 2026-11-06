'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertIcon,
  BellIcon,
  BuildingIcon,
  CloseIcon,
  CheckIcon,
  ChartDotsIcon,
  CreditCardIcon,
  CpuIcon,
  DoorIcon,
  GearIcon,
  HeadsetIcon,
  HomeIcon,
  IdCardIcon,
  KeyIcon,
  LaptopIcon,
  LayersIcon,
  LicenseIcon,
  ListIcon,
  LogoutIcon,
  MegaphoneIcon,
  PeopleIcon,
  PhoneIcon,
  PlaneIcon,
  ReportMoneyIcon,
  RobotIcon,
  ShieldLockIcon,
  SitemapIcon,
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
  /** id del panel, para `aria-controls` de la hamburguesa (solo móvil). */
  id?: string;
  /** Solo móvil y tablet: panel abierto. En escritorio el sidebar siempre está a la vista. */
  open?: boolean;
  /** Cierra el panel (X y clic en un enlace). Solo móvil y tablet. */
  onClose?: () => void;
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

export function Sidebar({ user, id, open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const isManager = useIsTeamManager();
  const showFinanzas = hasSection(user, 'finanzas');
  const showRrhh = hasSection(user, 'rrhh');
  // Headcount es confidencial: solo SUPER_ADMIN y overrides individuales.
  const showHeadcount = hasModule(user, 'rrhh', 'headcount', 'read');
  const showRiac = hasModule(user, 'rrhh', 'capacitaciones', 'read');
  const showMatrizPuestos = hasModule(user, 'rrhh', 'matriz-puestos', 'read');
  const showSolicitudesPuesto = hasModule(user, 'rrhh', 'solicitudes-puesto', 'read');
  const showOkrsReport = hasModule(user, 'rrhh', 'okrs', 'read');
  const showTransformacion = hasSection(user, 'transformacion');
  const showHerramientasCatalogo = hasModule(user, 'transformacion', 'herramientas', 'read');
  const showAsignaciones = hasModule(user, 'transformacion', 'asignaciones', 'read');
  const showSimCards = hasModule(user, 'transformacion', 'sim-cards', 'read');
  const showAuditoriaEquipos = hasModule(user, 'transformacion', 'auditoria-equipos', 'read');
  const showMedios = hasSection(user, 'medios');
  // SGSI es un módulo, no una herramienta: administrar el sistema de gestión no
  // es lo mismo que consultarlo desde ISOBOT, y su permiso vive fuera de 'admin'
  // para poder delegarlo sin dar usuarios, roles y catálogos.
  const showSgsiIsobot = hasModule(user, 'sgsi', 'isobot', 'write');
  const showSgsiRiesgos = hasModule(user, 'sgsi', 'riesgos', 'read');
  // El grupo se ve si el usuario puede ver al menos uno de sus hijos.
  const showSgsi = showSgsiIsobot || showSgsiRiesgos;
  const showModulos = showFinanzas || showRrhh || showMedios || showSgsi || showTransformacion;

  // Herramientas: cada link se controla por su módulo y la sección entera se
  // oculta si el usuario no conserva ninguno.
  const showNotificaciones = hasModule(user, 'herramientas', 'notificaciones', 'read');
  const showReembolsos = hasModule(user, 'herramientas', 'reembolsos', 'read');
  const showReembolsosFinanzas = hasModule(user, 'finanzas', 'reembolsos', 'read');
  const showGastosTarjeta = hasModule(user, 'herramientas', 'gastos-tarjeta', 'read');
  const showTarjetasFinanzas = hasModule(user, 'finanzas', 'tarjetas', 'read');
  const showSalas = hasModule(user, 'herramientas', 'salas');
  const showSoporte = hasModule(user, 'herramientas', 'tickets');
  const showIsobot = hasModule(user, 'herramientas', 'isobot');
  const showVacaciones = hasModule(user, 'herramientas', 'vacaciones', 'read');
  // Gestión de Vacaciones no cuelga de un permiso: lo habilita tener gente a
  // cargo. Por eso entra también en showHerramientas —un jefe sin ningún otro
  // módulo de herramientas se quedaría sin la sección y sin el link.
  const showGestionVacaciones = isManager;
  // Solicitud de Puesto es para líderes: misma regla que Gestión de Vacaciones (tener gente a cargo).
  const showSolicitudPuesto = isManager;
  // Mis OKRs (evaluación del líder) también es para líderes: misma regla.
  const showMisOkrs = isManager;
  // Contraseñas (TIC-RE-17) es visible para todos: cada quien ve la suya y un
  // jefe también la de sus subordinados directos; el alcance lo fija el API.
  const showPasswords = true;
  // Mi Información (solo lectura de mi propio expediente) es para cualquier usuario.
  const showMiInformacion = true;
  const showOrgChartInTools = !showRrhh;
  const showHerramientas =
    showNotificaciones ||
    showReembolsos ||
    showGastosTarjeta ||
    showSalas ||
    showSoporte ||
    showIsobot ||
    showVacaciones ||
    showGestionVacaciones ||
    showSolicitudPuesto ||
    showMisOkrs ||
    showPasswords ||
    showMiInformacion ||
    showOrgChartInTools;

  // Configuración: basta un permiso de section 'admin', no ser SUPER_ADMIN.
  const showUsuarios = hasModule(user, 'admin', 'usuarios');
  const showPermisos = hasModule(user, 'admin', 'roles');
  const showCatalogos = hasModule(user, 'admin', 'catalogos');
  const showFlujos = hasModule(user, 'admin', 'configuracion', 'write');
  const showCategoriasTickets = hasModule(user, 'admin', 'helpdesk-categorias', 'read');
  const showLogs = hasModule(user, 'admin', 'audit', 'read');
  const showAnalytics = hasModule(user, 'admin', 'analytics', 'read');
  const showAdmin =
    showUsuarios ||
    showPermisos ||
    showCatalogos ||
    showFlujos ||
    showCategoriasTickets ||
    showLogs ||
    showAnalytics;

  return (
    // Escritorio (lg): el sidebar de siempre, en el flujo. Debajo de lg es un panel
    // fijo que entra desde la izquierda; cerrado queda invisible (sin foco ni lector).
    <aside
      id={id}
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-black text-white transition-[transform,visibility] duration-200 motion-reduce:transition-none',
        'lg:static lg:z-auto lg:h-screen lg:w-64 lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:visible lg:transition-none',
        open ? 'translate-x-0 visible' : '-translate-x-full invisible',
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-6">
        <img src="/images/lievant-isotipo.png" alt="Lievant" className="h-8 w-auto" />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar Menú"
            className="flex h-9 w-9 items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav
        className="flex-1 space-y-1 overflow-y-auto px-3 py-4"
        onClick={(e) => {
          // Tocar un enlace cierra el panel (aunque sea la misma ruta, donde no hay cambio de ruta que lo cierre).
          if (onClose && (e.target as HTMLElement).closest('a')) onClose();
        }}
      >
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
                {showTarjetasFinanzas && (
                  <NavSubLink
                    href="/finanzas/tarjetas"
                    active={pathname.startsWith('/finanzas/tarjetas')}
                  >
                    <CreditCardIcon className="h-4 w-4" />
                    Tarjetas de Lievant
                  </NavSubLink>
                )}
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
                {showReembolsosFinanzas && (
                  <NavSubLink
                    href="/finanzas/reembolsos"
                    active={pathname.startsWith('/finanzas/reembolsos')}
                  >
                    <WalletIcon className="h-4 w-4" />
                    Reembolsos
                  </NavSubLink>
                )}
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
                <NavSubLink href="/rrhh/organigrama" active={pathname.startsWith('/rrhh/organigrama')}>
                  <SitemapIcon className="h-4 w-4" />
                  Organigrama
                </NavSubLink>
                {showMatrizPuestos && (
                  <NavSubLink href="/rrhh/matriz-puestos" active={pathname.startsWith('/rrhh/matriz-puestos')}>
                    <LayersIcon className="h-4 w-4" />
                    Matriz de Puestos
                  </NavSubLink>
                )}
                {showSolicitudesPuesto && (
                  <NavSubLink href="/rrhh/solicitudes-puesto" active={pathname.startsWith('/rrhh/solicitudes-puesto')}>
                    <TableIcon className="h-4 w-4" />
                    Solicitudes de Puesto
                  </NavSubLink>
                )}
                <NavSubLink
                  href="/rrhh/reportes"
                  active={
                    pathname.startsWith('/rrhh/reportes') &&
                    !pathname.startsWith('/rrhh/reportes/headcount') &&
                    !pathname.startsWith('/rrhh/reportes/riac') &&
                    !pathname.startsWith('/rrhh/reportes/okrs')
                  }
                >
                  <TableIcon className="h-4 w-4" />
                  Reportes
                </NavSubLink>
                {showHeadcount && (
                  <NavSubLink
                    href="/rrhh/reportes/headcount"
                    active={pathname.startsWith('/rrhh/reportes/headcount')}
                  >
                    <UsersGroupIcon className="h-4 w-4" />
                    Headcount
                  </NavSubLink>
                )}
                {showRiac && (
                  <NavSubLink href="/rrhh/reportes/riac" active={pathname.startsWith('/rrhh/reportes/riac')}>
                    <IdCardIcon className="h-4 w-4" />
                    RIAC
                  </NavSubLink>
                )}
                {showOkrsReport && (
                  <NavSubLink href="/rrhh/reportes/okrs" active={pathname.startsWith('/rrhh/reportes/okrs')}>
                    <TableIcon className="h-4 w-4" />
                    OKRs
                  </NavSubLink>
                )}
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

        {showSgsi && (
          <>
            {/* No existe una página /sgsi: el grupo lleva al primer hijo visible. */}
            <NavLink
              href={showSgsiIsobot ? '/sgsi/isobot' : '/sgsi/matriz-riesgos'}
              active={pathname.startsWith('/sgsi')}
            >
              <ShieldLockIcon className="h-5 w-5" />
              SGSI
            </NavLink>
            {pathname.startsWith('/sgsi') && (
              <SubMenu>
                {showSgsiIsobot && (
                  <NavSubLink href="/sgsi/isobot" active={pathname.startsWith('/sgsi/isobot')}>
                    <RobotIcon className="h-4 w-4" />
                    Administración ISOBOT
                  </NavSubLink>
                )}
                {showSgsiRiesgos && (
                  <NavSubLink
                    href="/sgsi/matriz-riesgos"
                    active={pathname.startsWith('/sgsi/matriz-riesgos')}
                  >
                    <AlertIcon className="h-4 w-4" />
                    Matriz de Riesgos
                  </NavSubLink>
                )}
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
                {showHerramientasCatalogo && (
                  <NavSubLink
                    href="/transformacion/herramientas-catalogo"
                    active={pathname.startsWith('/transformacion/herramientas-catalogo')}
                  >
                    <LayersIcon className="h-4 w-4" />
                    Catálogo de Herramientas
                  </NavSubLink>
                )}
                {showAsignaciones && (
                  <NavSubLink
                    href="/transformacion/asignaciones"
                    active={pathname.startsWith('/transformacion/asignaciones')}
                  >
                    <LicenseIcon className="h-4 w-4" />
                    Asignaciones
                  </NavSubLink>
                )}
                <NavSubLink
                  href="/transformacion/inventario"
                  // Excluye /colaboradores para que no queden los dos sub-items
                  // marcados a la vez.
                  active={
                    pathname.startsWith('/transformacion/inventario') &&
                    !pathname.startsWith('/transformacion/inventario/colaboradores')
                  }
                >
                  <LaptopIcon className="h-4 w-4" />
                  Inventario Tecnológico
                </NavSubLink>
                <NavSubLink
                  href="/transformacion/inventario/colaboradores"
                  active={pathname.startsWith('/transformacion/inventario/colaboradores')}
                >
                  <IdCardIcon className="h-4 w-4" />
                  Colaboradores y Responsivas
                </NavSubLink>
                {showSimCards && (
                  <NavSubLink
                    href="/transformacion/sim-cards"
                    active={pathname.startsWith('/transformacion/sim-cards')}
                  >
                    <PhoneIcon className="h-4 w-4" />
                    Líneas Telefónicas
                  </NavSubLink>
                )}
                {showAuditoriaEquipos && (
                  <NavSubLink
                    href="/transformacion/auditoria-equipos"
                    active={pathname.startsWith('/transformacion/auditoria-equipos')}
                  >
                    <CheckIcon className="h-4 w-4" />
                    Auditoría de Equipos
                  </NavSubLink>
                )}
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
            {showMiInformacion && (
              <NavLink href="/herramientas/mi-informacion" active={pathname.startsWith('/herramientas/mi-informacion')}>
                <IdCardIcon className="h-5 w-5" />
                Mi Información
              </NavLink>
            )}
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
            {showReembolsos && (
              <NavLink
                href="/herramientas/mis-reembolsos"
                active={pathname.startsWith('/herramientas/mis-reembolsos')}
              >
                <WalletIcon className="h-5 w-5" />
                Mis Reembolsos
              </NavLink>
            )}
            {showGastosTarjeta && (
              <NavLink
                href="/herramientas/mis-gastos-tarjeta"
                active={pathname.startsWith('/herramientas/mis-gastos-tarjeta')}
              >
                <CreditCardIcon className="h-5 w-5" />
                Mis Gastos de Tarjeta
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
                active={pathname === '/herramientas/vacaciones' || pathname.startsWith('/herramientas/vacaciones/')}
              >
                <PlaneIcon className="h-5 w-5" />
                Vacaciones
              </NavLink>
            )}
            {showGestionVacaciones && (
              <NavLink
                href="/herramientas/gestion-vacaciones"
                active={pathname.startsWith('/herramientas/gestion-vacaciones')}
              >
                <UsersGroupIcon className="h-5 w-5" />
                Gestión de Vacaciones
              </NavLink>
            )}
            {showSolicitudPuesto && (
              <NavLink href="/herramientas/solicitud-puesto" active={pathname.startsWith('/herramientas/solicitud-puesto')}>
                <IdCardIcon className="h-5 w-5" />
                Solicitud de Puesto
              </NavLink>
            )}
            {showMisOkrs && (
              <NavLink href="/herramientas/mis-okrs" active={pathname.startsWith('/herramientas/mis-okrs')}>
                <TableIcon className="h-5 w-5" />
                Mis OKRs
              </NavLink>
            )}
            {showPasswords && (
              <NavLink
                href="/herramientas/passwords"
                active={pathname.startsWith('/herramientas/passwords')}
              >
                <KeyIcon className="h-5 w-5" />
                Gestión de Contraseñas
              </NavLink>
            )}
            {/* El organigrama es para cualquier usuario autenticado: quien ve el grupo RRHH lo tiene ahí. */}
            {showOrgChartInTools && (
              <NavLink href="/rrhh/organigrama" active={pathname.startsWith('/rrhh/organigrama')}>
                <SitemapIcon className="h-5 w-5" />
                Organigrama
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
            {showCategoriasTickets && (
              <NavLink
                href="/admin/categorias-tickets"
                active={pathname.startsWith('/admin/categorias-tickets')}
              >
                <TicketIcon className="h-5 w-5" />
                Categorías de Tickets
              </NavLink>
            )}
            {showLogs && (
              <NavLink href="/admin/logs" active={pathname.startsWith('/admin/logs')}>
                <ListIcon className="h-5 w-5" />
                Logs y Auditoría
              </NavLink>
            )}
            {showAnalytics && (
              <NavLink href="/admin/analytics" active={pathname.startsWith('/admin/analytics')}>
                <ChartDotsIcon className="h-5 w-5" />
                Analytics de Uso
              </NavLink>
            )}
            {showFlujos && (
              <NavLink
                href="/admin/flujos-notificacion"
                active={pathname.startsWith('/admin/flujos-notificacion')}
              >
                <BellIcon className="h-5 w-5" />
                Flujos de notificación
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

/**
 * ¿El usuario tiene colaboradores a cargo? No se deduce de los permisos, así
 * que la responde la API. Falla en silencio a false: el sidebar debe pintarse
 * igual aunque el backend no conteste.
 */
function useIsTeamManager(): boolean {
  const [isManager, setIsManager] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/vacations/team/is-manager')
      .then((res) => (res.ok ? res.json() : { isManager: false }))
      .then((data: { isManager?: boolean }) => {
        if (active) setIsManager(data.isManager ?? false);
      })
      .catch(() => {
        /* silencioso: sin sesión válida o backend no disponible */
      });
    return () => {
      active = false;
    };
  }, []);

  return isManager;
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
