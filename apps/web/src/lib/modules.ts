export type SystemRole =
  | 'SUPER_ADMIN'
  | 'ADMIN_FINANZAS'
  | 'ADMIN_RRHH'
  | 'ADMIN_NOMINA'
  | 'CUENTA_MANAGER'
  | 'VIEWER';

export type ModuleIcon = 'finance' | 'people' | 'payroll' | 'accounts' | 'reports' | 'admin';

export interface ModuleDef {
  id: string;
  name: string;
  description: string;
  href: string;
  icon: ModuleIcon;
  roles: SystemRole[];
}

export const MODULES: ModuleDef[] = [
  {
    id: 'finanzas',
    name: 'Finanzas',
    description: 'Proveedores, pagos y reportes financieros.',
    href: '/finanzas',
    icon: 'finance',
    roles: ['SUPER_ADMIN', 'ADMIN_FINANZAS'],
  },
  {
    id: 'rrhh',
    name: 'RRHH',
    description: 'Gestión de personal y procesos de talento humano.',
    href: '/rrhh',
    icon: 'people',
    roles: ['SUPER_ADMIN', 'ADMIN_RRHH'],
  },
  {
    id: 'nomina',
    name: 'Nómina',
    description: 'Procesamiento de nómina y pagos a empleados.',
    href: '/nomina',
    icon: 'payroll',
    roles: ['SUPER_ADMIN', 'ADMIN_NOMINA'],
  },
  {
    id: 'cuentas',
    name: 'Cuentas',
    description: 'Clientes y cuentas asignadas.',
    href: '/cuentas',
    icon: 'accounts',
    roles: ['SUPER_ADMIN', 'CUENTA_MANAGER'],
  },
  {
    id: 'reportes',
    name: 'Reportes',
    description: 'Indicadores y reportes generales de la operación.',
    href: '/reportes',
    icon: 'reports',
    roles: ['SUPER_ADMIN', 'VIEWER', 'ADMIN_FINANZAS', 'ADMIN_RRHH', 'CUENTA_MANAGER'],
  },
  {
    id: 'admin',
    name: 'Administración',
    description: 'Usuarios, roles y permisos del sistema.',
    href: '/admin',
    icon: 'admin',
    roles: ['SUPER_ADMIN'],
  },
];

export function modulesForRoles(roleNames: string[]): ModuleDef[] {
  if (roleNames.length === 0) return MODULES;
  return MODULES.filter((mod) => mod.roles.some((role) => roleNames.includes(role)));
}
