# Módulo 0 — Autenticación & Administración

**Estado:** En desarrollo  
**Responsable:** Paulo Ossa / Databeans

## Descripción

El Módulo 0 es la base del sistema. Define quién puede acceder, a qué puede acceder y qué puede hacer. Ningún otro módulo puede estar en producción sin el Módulo 0 completo.

## Endpoints

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| GET | /api/v1/auth/me | Usuario actual | JWT |
| POST | /api/v1/auth/refresh | Renovar token | Refresh token |
| DELETE | /api/v1/auth/logout | Cerrar sesión | JWT |
| GET | /api/v1/users | Listar usuarios | JWT + SUPER_ADMIN |
| POST | /api/v1/users | Crear usuario | JWT + SUPER_ADMIN |
| PATCH | /api/v1/users/:id | Editar usuario | JWT + SUPER_ADMIN |
| DELETE | /api/v1/users/:id | Desactivar usuario | JWT + SUPER_ADMIN |
| GET | /api/v1/roles | Listar roles | JWT + SUPER_ADMIN |
| POST | /api/v1/roles | Crear rol | JWT + SUPER_ADMIN |
| PATCH | /api/v1/roles/:id/permissions | Asignar permisos | JWT + SUPER_ADMIN |

## Roles del sistema

| Rol | Descripción |
|---|---|
| SUPER_ADMIN | Control total del sistema. Solo Paulo Ossa. |
| ADMIN_FINANZAS | Módulos financieros: proveedores, nómina, reportes. |
| ADMIN_RRHH | Módulo RRHH. No puede ver nómina. |
| ADMIN_NOMINA | Solo módulo nómina. Schema aislado. |
| CUENTA_MANAGER | Clientes y cuentas asignadas. |
| VIEWER | Lectura general sin edición. |

## Permisos granulares

Los permisos se configuran en 3 niveles:

1. **Nivel módulo:** si el usuario puede acceder al módulo
2. **Nivel acción:** read / write / admin por módulo
3. **Nivel campo:** qué campos puede ver dentro del módulo

## Schema de base de datos (auth)

```sql
-- Usuarios
CREATE TABLE auth.users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       VARCHAR(255) UNIQUE NOT NULL,
  name        VARCHAR(255) NOT NULL,
  cognito_id  VARCHAR(255) UNIQUE,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ,
  created_by  UUID,
  updated_by  UUID
);

-- Roles
CREATE TABLE auth.roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) UNIQUE NOT NULL, -- SUPER_ADMIN, etc.
  description TEXT,
  color       VARCHAR(20),
  is_system   BOOLEAN DEFAULT false,        -- Roles del sistema no se pueden borrar
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Permisos por módulo
CREATE TABLE auth.permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module      VARCHAR(100) NOT NULL,        -- clients, vendors, hr, etc.
  action      VARCHAR(100) NOT NULL,        -- read, write, admin, delete
  field       VARCHAR(100),                 -- null = nivel módulo/acción
  description TEXT
);

-- Asignación rol → permisos
CREATE TABLE auth.role_permissions (
  role_id       UUID REFERENCES auth.roles(id),
  permission_id UUID REFERENCES auth.permissions(id),
  PRIMARY KEY (role_id, permission_id)
);

-- Asignación usuario → roles
CREATE TABLE auth.user_roles (
  user_id UUID REFERENCES auth.users(id),
  role_id UUID REFERENCES auth.roles(id),
  PRIMARY KEY (user_id, role_id)
);
```
