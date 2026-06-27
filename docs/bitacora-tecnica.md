# Bitácora Técnica — Lievant Admin
**Proyecto:** Sistema Administrativo Centralizado — Transformación Digital  
**Stack:** Next.js 15 · NestJS 10 · PostgreSQL 16 · AWS · Terraform  
**Repositorio:** github.com/Lievant/lievant-admin  
**Agente técnico:** Wosniack (Claude)  
**Período:** Junio 2026 — en curso

---

## Convenciones de este documento

- Cada sesión de desarrollo queda registrada cronológicamente
- Los commits relevantes se referencian por hash corto
- Las decisiones de arquitectura no triviales se documentan con contexto y trade-offs
- Los problemas y sus soluciones quedan registrados para referencia futura

---

## Sesión 1 — Semana del 9 de junio de 2026
**Objetivos:** Establecer infraestructura base y módulos fundacionales

### Lo que se construyó
- Infraestructura AWS completa con Terraform: VPC, RDS PostgreSQL 16, ECS Fargate, ECR, Amplify, Cognito, S3, DynamoDB, Secrets Manager
- Autenticación SSO con Microsoft 365 via AWS Cognito (SAML 2.0 / OIDC)
- Módulo 0 — Autenticación: usuarios, roles (SUPER_ADMIN, ADMIN_FINANZAS, ADMIN_RRHH, ADMIN_NOMINA, CUENTA_MANAGER, VIEWER), permisos a nivel de módulo
- Módulo 1 — Clientes: directorio con jerarquía Grupo → Empresa → Marca, tabs General/Financiero/Contactos/Documentos, integración S3 para documentos
- Entidad Empleados: expediente digital con tabs General/Datos Personales/Compensación/Vacaciones/Familia y Baja
- 112 clientes activos importados desde CONTPAQi (seed desde Excel)
- Ambientes dev y staging configurados

### Decisiones técnicas
- **Monorepo con Turborepo**: tipos TypeScript compartidos, builds con caché, code review unificado
- **Next.js App Router**: Server Components reducen JS al cliente; layouts anidados simplifican permisos
- **Schemas separados en PostgreSQL**: `auth`, `clients`, `vendors`, `hr`, `employees` — aislamiento absoluto y Row Level Security
- **Lambda one-off para operaciones de BD**: patrón establecido para migraciones y seeds cuando RDS está en VPC privada sin acceso directo
- **Soft delete universal**: `deleted_at + deleted_by` en todas las tablas. Nunca DELETE en producción

### Problemas y soluciones
- **Token de Microsoft 365 no disponible desde Cognito**: Cognito actúa como broker OIDC y no reenvía el access_token de Microsoft. Solución: Client Credentials flow para Microsoft Graph API, independiente del SSO del usuario
- **Dominio staging con Cloudflare**: registros DNS no propagaban correctamente por proxy de Cloudflare activo. Solución temporal: migrar staging a subdominio de siocore.ai en GoDaddy

---

## Sesión 2 — Semana del 16 de junio de 2026
**Objetivos:** Módulo de Proveedores completo

### Lo que se construyó
- **Módulo 2 — Proveedores** (`5295d08`):
  - Schema `vendors` con 7 tablas: vendors, vendor_products, purchase_orders, po_line_items, invoices, payments, vendor_documents
  - Flujo completo: OC (Borrador → Aprobada → Cerrada) → Factura → Pago con comprobante
  - Numeración automática de OCs: formato `OC-YYYY-NNN`
  - Datos bancarios (CLABE) preparados para cifrado KMS
  - 7 categorías de proveedores seeded en `catalogs.vendor_categories`
  - Frontend: lista con filtros, detalle con 5 tabs, 3 dialogs (crear OC, registrar factura, registrar pago)
  - Upload de archivos a S3 con `vendor-storage.service.ts`

### Decisiones técnicas
- **Categorías en catálogo existente**: las categorías de proveedores viven en el schema `catalogs` junto con otros catálogos del sistema, no en `vendors`. Permite gestión centralizada desde la sección de Configuración
- **OC siempre viene autorizada**: el sistema no automatiza el flujo de requisición → aprobación porque hay dependencias externas (WhatsApp, Teams). El jefe de compras crea la OC ya autorizada
- **Rol JEFE_COMPRAS pendiente**: por ahora ADMIN_FINANZAS tiene acceso completo. Se reevaluará cuando los permisos granulares estén implementados

---

## Sesión 3 — Semana del 22 de junio de 2026
**Objetivos:** Módulo de Reserva de Salas + infraestructura Microsoft Graph

### Lo que se construyó
- **Infraestructura Microsoft Graph** (`f70b98a`):
  - Cognito IdP actualizado: scopes `offline_access` y `Calendars.ReadWrite` agregados
  - Permisos Azure AD: delegados + aplicación `Calendars.ReadWrite` configurados
  - `GraphTokenService`: Client Credentials flow para crear/eliminar eventos en Outlook Calendar
  - `RedisModule/RedisService`: módulo global con ioredis para caché de tokens
  - ECS task definition actualizada con `AZURE_AD_TENANT_ID`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`

- **Módulo Reserva de Salas** (`6f2ca5d`):
  - Schema `rooms` con 6 tablas: countries, cities, offices, rooms, bookings, office_admins
  - Seeds: 3 países (MX/CO/US), 5 ciudades (León, CDMX, Guadalajara, Medellín, Charlotte), 5 oficinas
  - Reservas individuales y recurrentes (máx. 3 meses, RRULE semanal)
  - Límite configurable por sala (default 4h; más tiempo requiere aprobación admin)
  - Integración automática con Outlook Calendar al confirmar reserva
  - Visibilidad pública: cualquier usuario ve quién reservó y el motivo
  - Nuevo sidebar: sección "Herramientas" con Reserva de Salas

### Decisiones técnicas
- **Client Credentials vs Delegated flow**: se eligió Client Credentials porque evita la pantalla de consentimiento por usuario y permite crear eventos en nombre de cualquier colaborador del tenant usando solo el email. Trade-off: permiso amplio a nivel de aplicación, mitigado porque el client_secret está en Secrets Manager
- **Correo de confirmación via AWS SES**: el evento de Outlook se crea via Graph (notificación nativa). El correo formal del sistema sale de SES porque ya está configurado y no requiere scope adicional de M365
- **Un solo NAT Gateway**: patrón de menor costo; si la AZ del NAT falla, las subnets privadas pierden salida a internet temporalmente

### Problemas y soluciones
- **Amplify sin repositorio GitHub conectado**: Terraform creó la app Amplify en modo manual. GitHub requiere GitHub App token (no PAT clásico) para la integración vía API. Solución: conexión manual desde consola de AWS Amplify
- **Next.js SSR en Amplify con monorepo**: `output: standalone` es incompatible con el adaptador nativo SSR de Amplify. Solución: usar `baseDirectory: apps/web/.next` sin standalone, dejando que Amplify gestione el empaquetado SSR internamente
- **ECS sin imagen en ECR**: el servicio de staging intentaba arrancar sin imagen. Solución: build Docker desde la máquina local y push manual a ECR como primer despliegue
- **Redis sin configurar en staging**: `REDIS_URL` no existía como variable de entorno, crasheando el API al boot. Solución: hacer RedisModule tolerante a ausencia de REDIS_URL con degradación graciosa a cache en memoria

---

## Sesión 4 — 22-23 de junio de 2026
**Objetivos:** Staging funcional + mejoras generales

### Lo que se construyó
- **Staging completamente operativo**:
  - NAT Gateway agregado via Terraform a VPC de staging (resolvió acceso a Secrets Manager desde ECS)
  - Docker image construida y pusheada a ECR de staging
  - SSL configurado para conexión TypeORM → RDS: `ssl: { rejectUnauthorized: false }` en producción
  - Migraciones y seeds aplicados en BD de staging via Lambda one-off
  - URL operativa: `staging.d2jtkp67ko44vp.amplifyapp.com`

- **Sistema de permisos granular 3 niveles** (`f26fc80`):
  - Tabla `auth.user_permissions`: overrides por usuario (granted=true/false)
  - Columna `section` en `auth.permissions`: estructura `section → module → action`
  - 24 permisos seeded con matriz de asignación por rol
  - `PermissionsGuard`: SUPER_ADMIN bypasa todo, overrides de usuario tienen precedencia sobre rol
  - `@RequirePermission(section, module, action)` decorator
  - Hook `usePermission()` en frontend
  - `UserProvider`: contexto React client para el dashboard
  - Pantalla `/admin/permisos`: gestión de permisos por rol (acordeón) y por usuario (tabla triestado: Heredar/Conceder/Revocar)

- **Favicon isotipo Lievant** (`17ecd66`): isotipo blanco sobre fondo terracota (#C2714F), generado desde PDF en múltiples tamaños (16, 32, 48, 128, 180, 192, 512px)

- **Reestructura de navegación** (`f26fc80`):
  - Sidebar reorganizado: Módulos (Finanzas, RRHH, Ecommerce, Marketing, Omnicanalidad, Transformación Digital), Herramientas, Configuración
  - Páginas placeholder para módulos futuros con mensaje "en desarrollo"
  - Administración renombrada a Configuración

### Decisiones técnicas
- **Permisos en BD por request, no en JWT**: permite revocar permisos sin esperar expiración del token. El JWT solo lleva roles como antes. El guard consulta Redis (o BD si Redis no está) para los permisos del usuario
- **Tabla user_permissions con campo granted**: permite tanto conceder permisos adicionales al usuario (granted=true) como revocar permisos heredados del rol (granted=false). El override de usuario siempre tiene precedencia

### Problemas y soluciones
- **Drift de Terraform en staging**: cambios aplicados via CLI directo (dominio siocore.ai, variables de entorno ECS) quedaron fuera del estado de Terraform. Pendiente: reconciliar el código Terraform con el estado real de AWS antes del próximo `terraform apply` completo
- **Error `next/headers` en Client Components**: `upload-document-dialog.tsx` importaba valores de `api.ts` que usa `next/headers` (server-only). Solución: proxy route para catálogos en `/api/catalogs/employee-document-types` y cambiar import a `import type` en el Client Component

---

## Sesión 5 — 24 de junio de 2026
**Objetivos:** Generación de documentos RRHH + seed de empleados + dashboards

### Lo que se construyó
- **Generación de documentos RRHH** (`3470bbb`):
  - 5 plantillas `.docx` procesadas con marcadores `{{CAMPO}}`: contrato determinado, contrato indeterminado, convenio de prácticas, confidencialidad, no competencia
  - `DocumentsService`: descarga plantilla de S3, reemplaza marcadores con datos del empleado (EmployeeRecord + PersonalData + Compensation), genera `.docx` con `docx-templates`
  - Conversión de salarios a letras en español (formato "PESOS XX/100 M.N.")
  - Endpoint `GET /employees/:id/documents/:docType` protegido por permisos RRHH
  - Frontend: dialog con selección de tipo de contrato, campos extra para prácticas, descarga en paralelo con Promise.all
  - Plantillas almacenadas en S3: `lievant-admin-dev-datalake/templates/hr/`

- **Dashboards de módulos padre** (`153016f`):
  - Componentes reutilizables: `StatCard`, `ModuleCard`, `ComingSoonBadge`
  - Dashboards ejecutivos para Finanzas, RRHH, Ecommerce, Marketing, Omnicanalidad, Transformación Digital
  - Stat cards con placeholders listos para conectar datos reales

- **Módulo Reportes RRHH** (`153016f`):
  - Índice de reportes en `/rrhh/reportes`
  - Reporte de cumpleaños: filtro por mes, ordenamiento (fecha/nombre/área), resaltado de hoy y próximos 7 días
  - Exportación a Excel (xlsx) y PDF (window.print())
  - Endpoint `GET /employees/reports/birthdays` con JOIN a `personal_data`

- **Seed de 78 empleados** (`153016f`):
  - Script `003-employees-headcount.seed.ts` lee Excel `Preuba_1.xlsx` via librería xlsx
  - Crea `EmployeeRecord + PersonalData + Compensation` por empleado
  - Idempotente por `corporateEmail`
  - 189 filas procesadas → 78 empleados creados, 64 inválidos (sin nombre o email)

- **Tab Documentos en empleados** (`7aa1ea1`):
  - Entidad `employee_documents` en schema `employees`
  - 13 tipos de documento en `catalogs.employee_document_types`
  - Upload a S3 bajo `employees/{employeeId}/docs/`
  - Mismo patrón que documentos de clientes y proveedores

- **Filtros de empleados normalizados** (`7aa1ea1`):
  - company_code, division y location normalizados via UPDATE SQL directo
  - Valores del seed (mayúsculas, códigos cortos) alineados con catálogos del sistema

### Decisiones técnicas
- **Plantillas en S3, no en código**: cuando un documento necesita actualizarse, solo se reemplaza el archivo en S3 sin redeploy. Las plantillas tienen marcadores `{{CAMPO}}` en formato docx-templates
- **Client Credentials para Graph Calendar**: transparente para el usuario, sin pantalla de consentimiento adicional. El app token se cachea en Redis 55 min
- **Seed lee directamente el Excel**: en lugar de hardcodear los datos, el seed usa la librería `xlsx` para leer el archivo fuente. Facilita re-ejecuciones con nuevas versiones del head count

---

## Sesión 6 — 25-26 de junio de 2026
**Objetivos:** Dashboard "Mi día en Lievant" + resiliencia del API

### Lo que se construyó
- **Dashboard "Mi día en Lievant"** (`ca923ec`):
  - Header en 3 tercios: foto de perfil (wireframe placeholder), saludo personalizado con hora del día, frase en español
  - 30 frases motivacionales en español, rotación diaria por día del año (sin API externa)
  - Card "Mis reservas de hoy": reservas del usuario del día actual
  - Card "Cumpleaños": hoy y próximos 7 días con avatares de iniciales
  - Tablón de comunicados: publicación por RRHH/SUPER_ADMIN, actualización optimista sin reload
  - Calendario laboral interactivo: 54 efemérides (México, Colombia, EE.UU., internacionales), lunes-domingo, chips de color por categoría, panel de detalle al click
  - 5 categorías de eventos: Hoy, Festivo, Efeméride, Cumpleaños, Evento RRHH
  - Botón "+ Evento" en calendario para RRHH: crea comunicado con fecha específica
  - Mis módulos: solo secciones padre según permisos del usuario

- **Entidad `auth.announcements`**:
  - Comunicados con título, cuerpo, autor, fecha de evento opcional
  - Endpoints: `GET/POST/DELETE /auth/announcements`
  - Aparecen en el calendario si tienen `eventDate` definido

- **Endpoint `GET /employees/dashboard`**:
  - Reservas del día del usuario actual
  - Cumpleaños de hoy y próximos 7 días
  - Un solo endpoint para todo el dashboard (performance)

- **Resiliencia del API** (`ca923ec`):
  - `GET /health` endpoint público en el API (sin auth): `{ status, timestamp, uptime }`
  - Hook `useApiHealth`: polling cada 30s, degrada a 'offline' tras 2 fallos consecutivos
  - `ApiHealthBanner`: banner sticky top-0, invisible cuando ok, amarillo en degradado, rojo con botón reintentar
  - `apiFetchWithRetry`: hasta 3 reintentos con backoff exponencial (1s → 2s → 4s) solo en errores de red

### Decisiones técnicas
- **Frases en español hardcodeadas (no API externa)**: ZenQuotes no tiene soporte en español. Las 30 frases se seleccionan por `dayOfYear % 30`, cambian cada día y son consistentes durante el día sin dependencia externa
- **Calendario con efemérides locales**: en lugar de depender de una API de efemérides (que puede tener outages o costos), las 54 efemérides están hardcodeadas. Se pueden agregar más sin redeploy si se mueven a BD en el futuro
- **Retry solo en errores de red, no en 4xx/5xx**: los errores HTTP son intencionales (permisos, validaciones), no tiene sentido reintentar. Solo errores `TypeError` de red se reintentan

### Problemas y soluciones
- **`next/headers` en Client Components (recurrente)**: patrón establecido definitivamente: cualquier Client Component que necesite datos del API debe usar proxy routes en `/app/api/` que lean las cookies del servidor, nunca importar directamente de `lib/api.ts`

---

## Estado actual del sistema

### Módulos completados
| Módulo | Estado | Ambiente |
|--------|--------|----------|
| Autenticación M365 SSO | ✅ Completo | Staging activo |
| Usuarios, roles y permisos granulares | ✅ Completo | Staging activo |
| Clientes (Finanzas) | ✅ Completo | Staging activo |
| Proveedores (Finanzas) | ✅ Completo | Staging activo |
| Empleados (RRHH) | ✅ Completo | Staging activo |
| Reportes RRHH (cumpleaños) | ✅ Completo | Staging activo |
| Reserva de Salas | ✅ Completo | Staging activo |
| Generación de documentos RRHH | ✅ Completo | Staging activo |
| Dashboard "Mi día en Lievant" | ✅ Completo | Staging activo |
| Nómina | 🔲 Planificado | — |
| Integraciones CONTPAQi/Dynamics | 🔲 Planificado | — |
| Transformación Digital (submódulos) | 🔲 Planificado | — |

### Infraestructura AWS activa
| Servicio | Dev | Staging |
|----------|-----|---------|
| Amplify (frontend) | ✅ | ✅ staging.d2jtkp67ko44vp.amplifyapp.com |
| ECS Fargate (API) | ⚠️ Sin imagen | ✅ Running:1 |
| RDS PostgreSQL | ✅ | ✅ Con migraciones y datos |
| NAT Gateway | ✅ | ✅ |
| ECR | ✅ Vacío | ✅ Con imagen |
| Cognito | ✅ Compartido con staging | — |
| S3 Data Lake | ✅ | ✅ |
| Redis (ElastiCache) | ❌ No configurado | ❌ No configurado |

### Deuda técnica pendiente
1. **Drift de Terraform en staging**: dominio siocore.ai, variables ECS y task definition aplicados via CLI. El código Terraform no refleja el estado real de AWS
2. **Redis en staging/prod**: aún no hay ElastiCache configurado. El sistema degrada graciosamente (cache en memoria), pero tokens de Graph se pierden en cada reinicio de ECS
3. **Pipeline CI/CD completo**: el despliegue de la imagen Docker al ECS requiere build y push manual. Falta configurar GitHub Actions para automatizarlo
4. **Foto de perfil en empleados**: placeholder wireframe en el dashboard. Funcionalidad de upload de foto pendiente
5. **ECS dev sin imagen**: el servicio de dev está en Pending por falta de imagen en ECR. No afecta el desarrollo local pero genera costos innecesarios de ALB
6. **Dominio siocore.ai**: la asociación de dominio en Amplify sigue en FAILED. Se usa el dominio amplifyapp.com como temporal

### Patrones establecidos (referencia para nuevos módulos)
- **Lambda one-off**: para operaciones de BD cuando RDS está en VPC privada. Patrón: crear rol IAM → Lambda en subnets privadas → invocar → eliminar
- **Proxy routes**: Client Components nunca importan `lib/api.ts` directamente. Usan `/app/api/[recurso]/route.ts` que lee cookies del servidor
- **Seed idempotente**: siempre verificar existencia antes de insertar. Usar campo único (email, contpaqId, etc.) como clave de idempotencia
- **Soft delete universal**: `deleted_at + deleted_by` en todas las tablas. El método `remove()` hace soft delete, no DELETE SQL
- **Storage service por módulo**: cada módulo tiene su propio `[module]-storage.service.ts` que sube a S3 bajo `[module]/{id}/docs/`
