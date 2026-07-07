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

---

## Sesión 7 — 26-27 de junio de 2026
**Objetivos:** Dashboard de inicio, gestión documental de clientes, resiliencia del API

### Lo que se construyó

- **Dashboard "Mi día en Lievant"** (`ca923ec`):
  - Header en 3 tercios: foto de perfil (wireframe placeholder), saludo personalizado con hora del día, frase motivacional en español
  - 30 frases motivacionales en español, rotación diaria por día del año (sin API externa, sin dependencia)
  - Card "Mis reservas de hoy" y "Cumpleaños del día y semana"
  - Tablón de comunicados: publicación por RRHH/SUPER_ADMIN, actualización optimista sin reload de página
  - Calendario laboral interactivo: 54 efemérides (México, Colombia, EE.UU., internacionales), semana Lun-Dom, chips de color por categoría, panel de detalle al click
  - 5 categorías de eventos: Hoy (terracota), Festivo (azul), Efeméride (ámbar), Cumpleaños (verde), Evento RRHH (rosa)
  - Botón "+ Evento" en calendario para RRHH con campo de fecha específica
  - Módulos padre según permisos reales del usuario

- **Entidad `auth.announcements`** (`ca923ec`):
  - Comunicados con título, cuerpo, autor, fecha de evento opcional (`event_date`)
  - Endpoints: `GET/POST/DELETE /auth/announcements`
  - Aparecen en el calendario si tienen `eventDate` definido

- **Resiliencia del API** (`ca923ec`):
  - `GET /health` endpoint público sin auth: `{ status, timestamp, uptime }`
  - Hook `useApiHealth`: polling cada 30s, degrada a 'offline' tras 2 fallos
  - `ApiHealthBanner`: banner sticky, invisible cuando ok, amarillo en degradado, rojo con botón reintentar
  - `apiFetchWithRetry`: 3 reintentos con backoff exponencial (1s → 2s → 4s), solo errores de red

- **Sistema de catálogos de documentos consolidado**:
  - Migración `1719200000000-ConsolidateDocumentTypes`: columnas `description`, `applies_to`, `is_required` en `catalogs.document_types`
  - Una sola tabla para los 3 tipos: `applies_to = 'client' | 'vendor' | 'employee'`
  - 22 tipos para clientes, 7 para proveedores (con `is_required`), 13 para empleados migrados de `employee_document_types`
  - Fix error Server/Client Component: íconos como strings Tabler en lugar de componentes React en `CATALOG_CONFIGS`
  - Vista admin muestra todos los ítems (activos e inactivos), vista pública `/active` solo activos
  - Error 500 en nombre duplicado → 409 ConflictException con mensaje descriptivo

- **Estado real de documentos en clientes**:
  - `docStatus` calculado comparando documentos obligatorios del catálogo vs docs subidos
  - Badge correcto: verde "Completo", naranja "Incompleto", gris "Sin requeridos"
  - Filtro `docStatus` en lista de clientes (reemplaza filtro AM, columna AM eliminada)
  - Fix: solo clientes `ACTIVE` en el reporte de documentos faltantes

- **Reporte de documentos faltantes** (`3ad15e2`):
  - Endpoint `GET /clients/reports/missing-documents`
  - Tabla con filas expandibles, barra de progreso, buscador
  - Exportación a Excel (.xlsx)
  - Sidebar Finanzas: subitem "Reportes" agregado

- **Dashboard ejecutivo de Finanzas con datos reales**:
  - Clientes activos (total real desde BD)
  - Sin documentos completos (clientes activos con expediente incompleto)
  - Proveedores activos
  - OC abiertas (0 placeholder, pendiente flujo completo)
  - Fix: `PaginatedResult<T>` incluye `total: number` desde `qb.getCount()`

- **112 clientes clasificados por industria**:
  - 22 categorías: Calzado y Moda (28), Aeropuertos e Infraestructura (13), Servicios Profesionales (12), Comercio y Distribución (10), Tecnología y Digital (8), entre otras
  - Clasificación basada en análisis semántico de nombres de empresa
  - UPDATE via psql local con JOIN correcto `client_records → companies`
  - Catálogo `catalogs.industries` sincronizado con los 22 valores exactos de la BD

- **Bitácora técnica creada** (`0c736d7`):
  - Documento `docs/bitacora-tecnica.md` en el repositorio
  - Registro cronológico de todas las sesiones desde el inicio del proyecto

### Decisiones técnicas
- **Frases en español hardcodeadas**: ZenQuotes no tiene API en español. Las 30 frases se seleccionan por `dayOfYear % 30` — cambian cada día, son consistentes durante el día, sin dependencia externa
- **Efemérides hardcodeadas**: más confiable que depender de una API externa. Se pueden mover a BD en el futuro sin cambiar la arquitectura
- **Retry solo en errores de red**: los errores HTTP 4xx/5xx son intencionales. Solo `TypeError` de red se reintenta con backoff exponencial
- **Un solo `document_types` con `applies_to`**: elimina la duplicación entre `document_types` y `employee_document_types`. Gestión centralizada desde Configuración

### Problemas y soluciones
- **Error `Functions cannot be passed to Client Components`**: íconos React pasados como props desde Server a Client Component en `CATALOG_CONFIGS`. Solución: cambiar a strings Tabler (`'ti-folder'`) y renderizar con `<i className={...} />`
- **Build Amplify job #33 fallido**: comillas literales `"` en JSX en `quote-widget.tsx`. Solución: reemplazar por `&ldquo;` y `&rdquo;`
- **API staging desactualizado**: la imagen de ECS tenía 2 días de atraso — todos los cambios del backend no estaban desplegados. Solución: build manual y push a ECR + `force-new-deployment`. **Deuda técnica**: falta pipeline CI/CD para automatizar esto con cada push a staging
- **Commits en staging en lugar de develop**: flujo corregido con cherry-pick. Se agrega verificación automática de rama antes de cada commit como paso estándar

### Pendientes para próxima sesión
1. **Pipeline CI/CD para Docker**: GitHub Actions que haga build/push automático de la imagen API a ECR con cada push a staging — elimina el deploy manual que causó el desajuste de hoy
2. **Documentación pública de la aplicación**: guía de usuario para cada módulo, accesible desde el sistema (tipo "Help Center" o wiki interna)
3. **Optimización de operación de RRHH**: definir qué procesos de RRHH se pueden digitalizar/automatizar con el sistema (onboarding, gestión de vacaciones, alertas de contratos por vencer, etc.)
4. **Tutorial de Paulina**: validar que el tutorial generado (`tutorial-paulina-finanzas.md`) cubre todas sus necesidades para la carga de documentos
5. **Foto de perfil en empleados**: funcionalidad de upload de foto para el dashboard

---

## Sesión 8 — 27 de junio de 2026
**Objetivos:** Corrección de discrepancias staging vs develop, sincronización de datos

### Lo que se construyó

- **Separación de tipos de documentos en catálogos** (`f00920f`):
  - 3 entradas independientes: document_types_client, document_types_vendor, document_types_employee
  - Campo `filter: { appliesTo }` en `CatalogConfig` inyectado automáticamente al crear/editar
  - Fix íconos como strings Tabler (`a7d9a4e`) — resuelve error recurrente "Functions cannot be passed to Client Components"
  - Fix URL `document-types` → `document_types` (guión bajo) en `api.ts` (`8f1c744`)
  - Fix `@Query('appliesTo')` en `catalogs.controller.ts` + filtro en `catalogs.service.ts`

- **Sincronización de datos en staging** (via Lambda one-off):
  - 112 industrias aplicadas en `clients.companies` de staging
  - Catálogo `catalogs.industries` limpiado y reseedado con 22 valores exactos
  - 4 tipos de documento de cliente marcados como obligatorios: Constancia fiscal (RFC), NDA, Acta constitutiva, Identificación oficial (sort_order 1-4)
  - Tipos no obligatorios ordenados: Contrato maestro (5), Poder notarial (6), Adendum (7), Otro (8)

- **Rebuild manual del API de staging**: imagen Docker reconstruida y pusheada a ECR, ECS force redeployed para tomar los cambios del backend

### Problemas encontrados y causa raíz

| Problema | Causa raíz | Solución aplicada |
|---|---|---|
| Industrias no visibles en staging | UPDATEs de BD solo se aplicaron en dev, nunca en staging | Lambda one-off con los 112 UPDATEs |
| Todos los clientes "Sin requeridos" | `is_required = false` en todos los tipos de cliente en staging | Lambda one-off con UPDATEs de is_required |
| Desplegable de tipos vacío en upload | URL `document-types` con guión en lugar de `document_types` con guión bajo | Fix en api.ts |
| Error 400 en catálogo | `isCatalogEntityName('document-types')` retorna false | Fix URL + @Query appliesTo en controller |
| Error "Functions cannot be passed" | Íconos React como componentes en nuevas entradas de constants.ts | Íconos como strings Tabler |
| API staging desactualizado | Sin pipeline CI/CD — imagen Docker se actualiza manualmente | Rebuild manual (deuda técnica pendiente) |

### Proceso de trabajo establecido — Mejores prácticas

A partir de esta sesión se adopta el siguiente proceso:

**Al inicio de cada sesión:**
1. Verificar sincronización develop ↔ staging: `git log origin/staging..origin/develop --oneline`
2. Confirmar fecha de la imagen del API en ECS: `aws ecr describe-images --repository-name lievant-admin-staging-api --query "imageDetails[0].imagePushedAt"`
3. Listar migraciones pendientes en staging

**Durante la sesión:**
- Todo el desarrollo va a `develop` — nunca commitear directamente a `staging`
- Agrupar cambios en "olas" temáticas (fixes, módulo completo, funcionalidades)
- Documentar migraciones y seeds de BD pendientes para aplicar en staging al cierre
- Verificar en local antes de cualquier merge

**Al cerrar la sesión (checklist de cierre):**
1. `git merge develop → staging` + `git push origin staging`
2. Rebuild imagen Docker + push ECR + force redeploy ECS staging
3. Lambda one-off para migraciones/seeds pendientes en BD staging
4. Verificar build Amplify (SUCCEED)
5. Smoke test en staging: login, módulo principal del día, datos correctos
6. Actualizar bitácora técnica

**Regla de oro:** Si algo funciona en local pero no en staging, verificar en este orden:
1. ¿El código llegó a staging? (`git diff origin/staging origin/develop`)
2. ¿Amplify desplegó el commit correcto? (job status + commitId)
3. ¿La imagen del API es reciente? (fecha en ECR)
4. ¿Los datos de BD están sincronizados? (Lambda diagnóstico)

---

## Pipeline CI/CD — Requerimientos para GitHub Actions

### Objetivo
Automatizar el rebuild y redeploy del API de staging con cada push a la rama `staging`, eliminando el proceso manual que causó las discrepancias de hoy.

### Lo que necesitamos

**1. GitHub Actions workflow** (archivo `.github/workflows/deploy-staging-api.yml`):
- Trigger: `push` a rama `staging`
- Steps: checkout → build Docker → push ECR → force redeploy ECS
- Tiempo estimado de implementación: 1 sesión

**2. Credenciales AWS en GitHub Secrets**:
```
AWS_ACCESS_KEY_ID      → credencial de un IAM user dedicado para CI/CD
AWS_SECRET_ACCESS_KEY  → secreto del mismo user
AWS_REGION             → us-east-1
ECR_REPOSITORY         → lievant-admin-staging-api
ECS_CLUSTER            → lievant-admin-staging-cluster
ECS_SERVICE            → lievant-admin-staging-api
```

**3. IAM User dedicado para CI/CD** (principio de mínimo privilegio):
Permisos necesarios:
- `ecr:GetAuthorizationToken`
- `ecr:BatchCheckLayerAvailability`
- `ecr:PutImage`
- `ecr:InitiateLayerUpload`
- `ecr:UploadLayerPart`
- `ecr:CompleteLayerUpload`
- `ecs:UpdateService`
- `ecs:DescribeServices`

**4. Configurar en GitHub**:
- Settings → Secrets and variables → Actions → New repository secret
- Agregar cada secret listado arriba

### Workflow propuesto
```yaml
name: Deploy API to Staging
on:
  push:
    branches: [staging]
    paths:
      - 'apps/api/**'
      - 'package.json'
      - 'package-lock.json'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v2
      
      - name: Build and push Docker image
        run: |
          docker build -f apps/api/Dockerfile -t ${{ secrets.ECR_REPOSITORY }}:latest .
          docker push 966001266524.dkr.ecr.us-east-1.amazonaws.com/${{ secrets.ECR_REPOSITORY }}:latest
      
      - name: Force ECS redeploy
        run: |
          aws ecs update-service \
            --cluster ${{ secrets.ECS_CLUSTER }} \
            --service ${{ secrets.ECS_SERVICE }} \
            --force-new-deployment
```

### Pasos para implementarlo
1. Paulo crea el IAM user de CI/CD con los permisos listados y genera las credenciales
2. Paulo agrega los secrets en GitHub (Settings → Secrets → Actions)
3. Wosniack crea el archivo `.github/workflows/deploy-staging-api.yml`
4. Primer push a staging dispara el workflow automáticamente

---

## Sesión 9 — 27 de junio de 2026 (tarde/noche)
**Objetivos:** Módulo HelpDesk TI, fixes de documentos, mejoras RRHH, CI/CD

### Lo que se construyó

- **Módulo HelpDesk TI completo** (`c5dab1d`):
  - Schema `helpdesk`: tickets (31 columnas), ticket_history, ticket_attachments, categories (8), subcategories (50)
  - 128 tickets históricos importados desde Microsoft Lists (dic 2025 - jun 2026)
  - 5 permisos granulares en `auth.permissions`
  - Backend: HelpdeskService + Controller con 10 endpoints
  - Frontend: dashboard KPIs en `/transformacion`, lista con semáforo SLA, formulario con autocomplete de empleados, detalle con panel TD
  - SLAs: P1=4h, P2=8h, P3=24h, P4=72h con semáforo verde/amarillo/rojo
  - `requesterName/Area` tomado automáticamente del perfil del usuario en sesión

- **Pipeline CI/CD GitHub Actions** (`48288fb`):
  - Workflow `deploy-staging-api.yml`: trigger en push a staging con cambios en `apps/api/`
  - Steps: checkout → AWS credentials → ECR login → Docker build → push (`:latest` + `:sha`) → ECS force redeploy → wait stable
  - IAM user `lievant-cicd-github` con `AmazonEC2ContainerRegistryPowerUser` + `AmazonECS_FullAccess`
  - 6 secrets configurados en GitHub Actions

- **Fix selectores tipos de documentos** (`30fcce3`):
  - Empleados: endpoint `/employee-document-types` legacy → `/document_types/active?appliesTo=employee`
  - Proveedores: selector hardcodeado → fetch dinámico a `/document_types/active?appliesTo=vendor`
  - Nueva proxy route `/api/catalogs/document-types/route.ts` que pasa query string completo

- **Fix unique constraint document_types** (`30fcce3`):
  - `UNIQUE(name)` global → `UNIQUE(name, applies_to)` compuesto
  - Permite mismo nombre de documento en diferentes entidades
  - 7 tipos de vendor completos con sort_order 1-7

- **Normalización S3_BUCKET** (`570893b`):
  - `AWS_S3_BUCKET` → `S3_BUCKET` en los 3 storage services (employee, vendor, client)
  - `get()` con fallback silencioso → `getOrThrow()` para fail-fast
  - Task definition ECS staging revision 4: `JWT_EXPIRY=1h` + `S3_BUCKET` correcto

- **Permisos S3 en ECS staging**:
  - IAM policy `StagingDatalakeS3Access` adjunta al rol `lievant-admin-staging-ecs-task`
  - Permisos: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:ListBucket` en el bucket de staging

- **Mejoras RRHH** (`4483fc8`):
  - Columna "Documentos" en lista de empleados (completo/incompleto/sin requeridos)
  - Filtro `docStatus` en `/rrhh/empleados`
  - Stats dinámicos: `computeStats()` ahora aplica los mismos filtros que `findAll()`
  - Dashboard RRHH con datos reales (empleados activos, cumpleaños, contratos por vencer)
  - Reporte "Contratos por vencer" en `/rrhh/reportes/contratos` con filtro de días y exportación Excel
  - Más ancho en contenido: `max-w-7xl px-8` → `max-w-screen-2xl px-6` en 29 páginas

- **125 empleados en staging**: reemplazados completamente desde dev via Lambda one-off

### Problemas y soluciones

| Problema | Causa raíz | Solución |
|---|---|---|
| Upload documentos falla en staging | `AWS_S3_BUCKET` en código vs `S3_BUCKET` en ECS + sin permisos IAM | Normalizar variable + policy IAM en task role |
| Sesión expira cada 15 min en staging | `JWT_EXPIRY` no configurado en task definition ECS | Agregar `JWT_EXPIRY=1h` en revision 4 |
| Staging con 92 empleados vs 125 en dev | Seed solo se ejecutó en dev | Lambda one-off que reemplaza todos desde dev |
| Lambda Pending muy largo | JSON inválido con backticks + datos embebidos en handler | Usar archivo `employees.json` separado con `require()` |
| Contraseña hardcodeada en seed script | Script de emergencia para staging | Descartar archivo, nunca commitear |

### Proceso de cierre establecido (ejecutado hoy)

1. ✅ Commits en develop
2. ✅ Merge develop → staging
3. ✅ GitHub Actions despliega API automáticamente
4. ✅ Amplify despliega frontend automáticamente
5. ✅ Lambda one-off para datos de BD
6. ✅ Verificar Amplify SUCCEED + ECS Running=1

### Deuda técnica pendiente

1. **AWS SES para notificaciones por email**: pendiente definir dominio dedicado (ej. `noreply@admin.lievant.com`)
2. **Documentación pública**: Help Center / guía de usuario por módulo
3. **Optimización RRHH**: onboarding digital, alertas automáticas
4. **Foto de perfil empleados**: upload de foto para el dashboard
5. **Drift Terraform staging**: task definition :4 creada via CLI, no reflejada en Terraform

---

## Sesión 10 — 28 de junio de 2026
**Objetivos:** Fotos de perfil M365, galería de fotos RRHH, rediseño pantalla permisos

### Lo que se construyó

- **Fotos de perfil Microsoft Graph** (`f4f3865`):
  - `GraphTokenService.getUserPhoto()`: llama a `GET /users/{email}/photo/$value` con Client Credentials
  - `GET /auth/users/:email/photo`: proxy sin auth, cachea en Redis 1h como base64
  - Proxy route frontend `/api/users/[email]/photo`
  - Foto M365 en lista de empleados, detalle de empleado, sidebar y dashboard
  - Fallback a iniciales en todos los casos si la foto falla
  - Permisos Azure AD agregados: `User.ReadBasic.All` + `User.Read.All` (Application, admin consent)
  - `MICROSOFT_CLIENT_SECRET` en AWS Secrets Manager (`staging/api/microsoft-client-secret-K8fgf4`)
  - Task definition ECS staging rev 6 con secret reference + `MICROSOFT_CLIENT_ID` + `AZURE_AD_TENANT_ID`

- **Galería de fotos de empleados** (`f4f3865`):
  - Migración `AddEmployeePhotos`: tabla `employees.employee_photos` con índice parcial único en `is_profile`
  - `EmployeePhotosService`: upload con `sharp` (1200px, JPEG 88%), máximo 10 fotos por empleado, soft delete
  - 4 endpoints: GET lista, POST upload, PATCH marcar perfil, DELETE
  - Tab "Fotos" en detalle del empleado con grid, badge "Perfil" terracota, botones hover
  - `sharp` movido correctamente a `dependencies` (no devDependencies) — fix para staging

- **Rediseño pantalla de permisos** (`73af794`):
  - Nueva UI de 2 paneles: buscador de usuarios (izquierda) + matriz de permisos (derecha)
  - Búsqueda con debounce 300ms, foto M365 en resultados
  - Chips de permiso: verde heredado (punteado), verde override (sólido), gris inactivo, rojo revocado
  - Batch save — "Guardar cambios" activo solo cuando hay cambios pendientes
  - Contador por sección: "X/Y permisos activos"
  - Nuevos endpoints: `GET /auth/users/search`, `GET /auth/users/:id/effective-permissions`
  - Regla permanente establecida: foto M365 en toda lista/selector de usuarios

- **37 permisos en BD** (dev + staging):
  - HelpDesk: tickets.read, tickets.write, tickets.gestion.read/write, tickets.reportes.read
  - Fotos: empleados.fotos.read/write
  - Reportes: finanzas.reportes.read, rrhh.reportes.contratos.read
  - TD: licenciamientos.read, inventario.read
  - Admin: permisos.write
  - SUPER_ADMIN tiene los 37 permisos

### Decisiones técnicas
- **JPEG 88% en lugar de WebP**: la diseñadora descarga fotos para trabajar en herramientas de diseño (Photoshop, Canva) — JPEG es universalmente compatible sin conversión
- **sharp en dependencies no devDependencies**: sharp es una dependencia runtime (se ejecuta en el servidor al procesar imágenes), no de desarrollo
- **Foto M365 como estándar de perfil**: en lugar de gestionar una foto de perfil propia en la plataforma, se usa directamente la foto de M365 que el usuario ya tiene actualizada

### Problemas y soluciones
| Problema | Causa | Solución |
|---|---|---|
| Fotos M365 rotas en local | `MICROSOFT_CLIENT_SECRET=local-placeholder` en .env | Crear secret real en Azure AD |
| Upload fotos falla en staging | `sharp` no estaba en la imagen Docker | Mover sharp a dependencies + rebuild |
| Permisos incompletos | Cada nuevo módulo agregaba permisos solo en dev | Lambda one-off + proceso establecido |

### Agente de manuales — planificado
Se planificó un agente Claude dedicado exclusivamente a crear manuales de usuario interactivos en HTML. Prompt definido. Flujo: screenshots del sistema → agente produce HTML interactivo → se sube a `/public/manuales/`. Prioridad de manuales: 1) Subir documentos clientes (Paulina), 2) Crear cliente nuevo, 3) Gestionar empleados (Claudia), 4) Abrir ticket soporte (todos), 5) Gestionar tickets (Daniel), 6) Reservar sala.

### Pendientes para próxima sesión
1. Crear sección "Ayuda / Manuales" en el sistema (sin permisos, accesible para todos)
2. Primer manual interactivo: Paulina — cómo subir documentos de clientes
3. Continuar robusteciendo módulos existentes según feedback de usuarios

---

## Sesión 11 — 28 de junio de 2026 (tarde)
**Objetivos:** Dashboard HelpDesk tipo Power BI, catálogo técnicos, filtro SLA, columnas ordenables

### Lo que se construyó

- **Dashboard ejecutivo HelpDesk** (`dfd76a0`):
  - Filtro de fechas (desde/hasta) con botón Aplicar, default últimos 6 meses
  - 4 KPI cards con comparativa vs período anterior (↑↓ %)
  - 6 gráficos Recharts: barras por categoría, dona por estado, línea tendencia mensual, barras tickets por mes, barras horizontales top 10 solicitantes, barras prioridad con colores semáforo
  - Backend: `getStats(from?, to?)` con Promise.all para performance
  - Colores consistentes: terracota #C2714F, navy #0F1623, azul #185FA5

- **Catálogo de técnicos asignables** (`dfd76a0`):
  - Tabla `helpdesk.ticket_assignees`: nombre, email, rol, is_active, sort_order
  - Columna `assignee_id` en `helpdesk.tickets`
  - Seed: Daniel Martínez (Técnico TI) + Paulo Ossa (Director TD)
  - Panel TD en detalle de ticket: select de técnico desde catálogo

- **Filtro SLA en lista de tickets** (`dfd76a0`):
  - Quitar filtros fecha_desde/fecha_hasta de la lista
  - Nuevo filtro: ok / warning (75-100% SLA) / overdue (vencido)
  - Cálculo en backend según prioridad P1/P2/P3/P4 y tiempo transcurrido

- **Ordenamiento por columnas transversal** (`dfd76a0`):
  - Hook `useSortableColumns<T>` reutilizable (client-side, página actual)
  - Componente `SortableHeader` con indicadores ▲▼⇅
  - Aplicado en: tickets, clientes, empleados

### Decisiones técnicas
- **Recharts en lugar de Chart.js**: ya instalado en el proyecto, mejor integración con React, más fácil de personalizar con colores del sistema
- **Ordenamiento client-side**: para no agregar complejidad al backend con parámetros de sort en cada endpoint. Suficiente para páginas paginadas de ≤100 registros
- **Catálogo de técnicos separado de empleados**: permite asignar a terceros (proveedores externos de soporte) que no son empleados del sistema

### Pendientes para próxima sesión
1. Sección "Ayuda / Manuales" en el sistema
2. Primer manual interactivo: Paulina — subir documentos de clientes
3. Agregar catálogo ticket_assignees a la UI de Catálogos
4. Notificaciones por email (pendiente dominio SES)

---

## Sesión 12 — 28 de junio de 2026 (noche)
**Objetivos:** Fixes HelpDesk, catálogo técnicos, formulario rediseñado, asignaciones

### Lo que se construyó

- **Catálogo de técnicos de soporte TI** (`feat(helpdesk)`):
  - Tabla `helpdesk.ticket_assignees` integrada a `/admin/catalogos`
  - CRUD completo desde UI: nombre, email, rol/cargo
  - Seed: Daniel Martínez (Técnico TI) + Paulo Ossa (Director TD)

- **Campo "Asignado a" operativo**:
  - `findAll()` hace batch-fetch de nombres por `assignee_id`
  - Columna "Asignado a" en lista de tickets muestra nombre del técnico
  - 128 tickets históricos asignados a Daniel Martínez en dev y staging

- **Rediseño formulario nuevo ticket**:
  - Bloque "Apertura por TD" movido al inicio del formulario
  - Badge de tickets abiertos al seleccionar colaborador
  - ID del equipo: ahora opcional (preparado para inventario tecnológico)
  - Campo "Asignado a" al final, visible solo para TD/SUPER_ADMIN
  - Nuevo orden: Colaborador → Categoría → Subcategoría → ID equipo → Descripción → Impacto → Asignado a

### Pendientes confirmados para próxima sesión
1. Notificaciones por email (AWS SES) + Teams via Microsoft Graph
2. Inventario tecnológico (equipos por empleado, ID equipo desde desplegable)
3. Sección "Ayuda / Manuales" en el sistema
4. Primer manual interactivo: Paulina — subir documentos de clientes

---

## Sesión 13 — 29 de junio de 2026
**Objetivos:** Módulo inventario tecnológico, seed en staging, mapa BD, planificación capa operativa

### Lo que se construyó

- **Módulo Inventario Tecnológico completo** (`4f4a89e`):
  - Schema `inventory`: equipment, equipment_history, equipment_types (18), equipment_brands (27), equipment_statuses (10)
  - IDs: TEC-YYYY-NNN consecutivo + `legacyId` para IDs anteriores (AD046, M092, etc.)
  - 416 equipos históricos importados desde Microsoft Lists
  - `assigned_to_employee_id` FK → employees.employee_records (cruzado por email)
  - 9 endpoints: CRUD, asignar/desasignar empleado, stats, catálogos
  - Frontend: lista con 9 filtros + tabla ordenable (useSortableColumns), detalle 3 tabs (Información, Asignación, Historial)
  - Foto M365 del empleado asignado en la lista
  - 3 permisos: inventario.read/write/delete asignados a SUPER_ADMIN

- **Fixes TypeORM** (`93fafaa`):
  - Problema raíz: TypeORM 0.3.x resuelve `alias.x` como entity property path cuando el alias está registrado
  - Solución definitiva: usar relación `@ManyToOne` con `leftJoinAndSelect('e.assignedEmployee', 'emp')` en lugar de SQL manual con `addSelect`
  - Fix adicional: `created_at` eliminado de `TicketAssignee` entity (columna no existía en staging)

- **Mapa de BD generado** (`db_map_lievant.html`):
  - 8 schemas, 40 tablas documentadas visualmente
  - Relaciones pendientes marcadas: clients ↔ projects, projects ↔ employees, projects ↔ vendors

- **Staging sincronizado**:
  - Schema inventory migrado via Lambda one-off
  - 416 equipos seeded (0 emails sin match — todos vinculados a empleados)
  - Todos los empleados correctamente asociados a sus equipos

### Decisiones técnicas
- **IDs con legacyId**: los equipos existentes mantienen su ID original (AD046, M092) en `legacy_id` para referencia mientras se hace la transición a los nuevos TEC-YYYY-NNN con marquillas físicas
- **Área/ubicación del equipo vs del empleado**: el equipo tiene sus propios campos area/location que pueden diferir del empleado (equipo en sala, equipo prestado, etc.)
- **TypeORM leftJoinAndSelect vs SQL manual**: TypeORM 0.3.x con QueryBuilder requiere usar relaciones definidas en entidades para JOINs — el SQL manual con `addSelect` falla silenciosamente con aliases conocidos

### Planificación — Capa operativa (próxima fase)

**Contexto:** Lievant usa Cor (lievant.cor.works) para gestión de proyectos y registro de tiempos. El objetivo es:
1. **Fase 1**: Crear schema `projects` en Lievant Admin como entidad central
2. **Fase 2**: Sincronización con API de Cor (API key disponible)
3. **Fase 3**: Reemplazar Cor completamente con Lievant Admin

**Estructura propuesta del schema `projects`:**
- `projects`: vinculado a clients + marcas + unidad de negocio + `corProjectId`
- `project_members`: empleados asignados por proyecto
- `project_billing`: rentabilidad (horas × valor/hora vs valor del proyecto)
- Unidades de negocio: Ecommerce, Marketing Digital, Omnicanalidad (cada una con pantallas propias)

**Pendiente**: explorar API de Cor para mapear campos antes de crear el schema

---

## Sesión 14 — 1 de julio de 2026
**Objetivos:** Inventario staging, exploración API Cor, homologación clientes, schema integración

### Lo que se construyó

- **Fix Amplify build** (`f7ee30d`):
  - `<a href>` → `<Link>` en new-equipment-form.tsx — Next.js bloqueaba el build
  - Build #56: SUCCEED

- **Exploración API Cor** (`https://api.projectcor.com/v1`):
  - Auth: OAuth2 Client Credentials → Bearer JWT (~1h TTL)
  - Base64(apiKey:secret) en header Authorization
  - Entidades disponibles: clientes (300), proyectos (9 visibles), tareas (429), usuarios (100), horas (805 entradas / 2,082.5 hrs / ~$595K costo)
  - Limitación: API key de Paulo tiene role_id=2, ve solo sus proyectos. Para ver toda la agencia se necesita API key de Antonio Torres (role_id=1 / Owner)
  - ⚠️ `subscription_status: pendingpayment` detectado en la cuenta de Cor

- **Homologación de clientes Lievant Admin ↔ Cor**:
  - Análisis de 5 clientes de proyectos activos en Cor
  - **Cuadra** (CLI-0010) ↔ Cor ID 45470 — MATCH EXACTO ✅
  - **Interpiel Exotic** (CLI-0063) ↔ Cor ID 186856 — MATCH EXACTO ✅
  - **Lievant Studio** — cliente interno, no aplica
  - **Dislicores** — no existía en Lievant Admin (ver decisión arquitectónica abajo)

- **Migración AddCorIntegrationFields** (`a4af587`):
  - `cor_synced_at TIMESTAMPTZ` en client_records
  - `cor_sync_status VARCHAR(20)` DEFAULT 'pending' en client_records
  - Índice parcial en cor_id

- **Migración AddClientBillingFields** (`d87f7b5`):
  - `billing_client_id UUID FK` en client_records — para cuando facturación ≠ beneficiario
  - `end_client_notes TEXT` en client_records
  - `cor_client_id VARCHAR(50)` en brands
  - `is_end_client BOOLEAN` en brands
  - `notes TEXT` en brands

- **Caso Dislicores resuelto**:
  - SM Digital ya existía como CLI-0102
  - Marca "Dislicores" creada bajo SM Digital con `cor_client_id=196727`, `is_end_client=true`

### Decisiones arquitectónicas importantes

**Lievant Admin como Source of Truth:**
- Lievant Admin es el sistema de registro central (no Cor, no CONTPAQi, no CRM)
- Flujo: crear en Lievant Admin → sincronizar a Cor via webhook
- Cor solo se usa para registro de horas (por ahora) y lectura de rentabilidad

**Modelo cliente final vs cliente contable:**
- `client_records` = quien facturamos (cliente contable/fiscal)
- `brands.is_end_client = true` = quien recibe el servicio (cliente final)
- Ejemplo: SM Digital (cliente contable) → Dislicores (marca, cliente final)
- `billing_client_id` en client_records para casos donde beneficiario tiene su propio registro

**Jerarquía de clientes:**
- Grupo → Empresa (fiscal) = client_records
- Marca con `is_end_client=true` = beneficiario final del servicio en casos especiales

### Pendientes para próxima sesión
1. Lambda one-off para migraciones en staging (AddCorIntegrationFields + AddClientBillingFields)
2. Actualizar cor_id en staging: CLI-0010=45470, CLI-0063=186856
3. API key de Antonio Torres para ver todos los proyectos de la agencia
4. Schema `projects` en Finanzas — entidad central para capa operativa
5. Webhook para replicar clientes/proyectos de Lievant Admin → Cor
6. Sincronizador de horas Cor → Lievant Admin para rentabilidad

---

## Sesión 15 — 2 de julio de 2026
**Objetivos:** Fix creación empleados, ajustes RRHH, inventario tecnológico, módulo de proyectos

### Lo que se construyó

- **Fix race condition displayId empleados** (`ef86ad3`):
  - `CREATE SEQUENCE employees.employee_display_id_seq START 126`
  - `generateDisplayId()` usa `nextval()` atómico en lugar de `SELECT MAX+1`
  - Mismo fix aplicado en `inventory.equipment_display_id_seq`
  - Fix doble submit en formulario con `disabled={isPending}`

- **Ajustes RRHH** (`3dad13e`):
  - Campo "Reporta A" con autocomplete `EmployeePicker` + foto M365 + FK `direct_report_to_id`
  - Backfill automático: 104 empleados vinculados por nombre
  - Normalización a MAYÚSCULAS: BD + service + inputs CSS
  - Fix registro PRACTICANTE → EMP-0126, seed valida formato `/^EMP-\d+$/`
  - Botón Eliminar (soft delete) para SUPER_ADMIN en empleados, clientes y proveedores con dialog de confirmación + Server Actions

- **Fix eliminar entidades** (`093183f`):
  - Root cause: Client Components no pueden importar valores de `lib/api.ts` (server-only)
  - Fix: Server Actions `deleteEmployeeAction`, `deleteClientAction`, `deleteVendorAction`
  - `revalidatePath()` automático — elemento desaparece sin `router.refresh()`
  - Regla permanente: mutaciones en Client Components → Server Actions en `actions.ts`

- **Ajustes Transformación Digital**:
  - Botón eliminar tickets para SUPER_ADMIN con soft delete
  - Reporte inventario por área: GET `/inventory/equipment/report/by-area`
  - PDF con `window.print()` + CSS de impresión: salto de página por área, `page-break-inside: avoid` por empleado
  - `/transformacion/reportes`: índice de reportes TD
  - Sidebar: "Reportes" en Transformación Digital

- **Módulo de Proyectos en Finanzas** (`8ece555`):
  - Schema `projects`: 7 tablas (project_records, members, business_units, financials, billing_milestones, documents, history)
  - IDs: PRY-XXXX (secuencia) + `cor_project_id` + `pm_code` alfanumérico (50 chars)
  - Tipos: `one_time` | `recurring` | `variable`
  - 5 permisos: proyectos.read/write/delete + financiero.read/write
  - 5 tipos de documento: Alta del proyecto + Cotización (obligatorios) + Contrato, Brief, Entregable
  - 4 proyectos seeded desde Cor (Interpiel, Dislicores, Cuadra x2)
  - Backend: 12 endpoints, ProjectStorageService (S3)
  - Frontend: lista filtrable + ordenable (7 columnas), detalle 6 tabs
  - 5 áreas operativas: Marketing Digital, Marketplaces, Performance, Fullcommerce, Omnicanalidad
  - PM con foto M365, EmployeePicker para equipo
  - Tabs Rentabilidad y Dashboard Operativo como placeholders para fase futura

- **CI/CD GitHub Actions restaurado**:
  - Secrets AWS regenerados y reconfigurados en GitHub
  - `workflow_dispatch` agregado al workflow para disparar manualmente
  - Todos los workflows en verde

### Problemas y soluciones

| Problema | Causa | Solución |
|---|---|---|
| Internal Server Error al crear empleado | Race condition en `generateDisplayId()` — dos requests leen el mismo MAX | Secuencia PostgreSQL con `nextval()` atómico |
| "No se pudo eliminar" en staging | Client Component importaba valor de `lib/api.ts` (server-only) → 401 silencioso | Server Actions con `revalidatePath()` |
| GitHub Actions no disparaba | Secrets AWS borrados — fallo silencioso en paso "Configure AWS credentials" | Regenerar credenciales IAM + reconfigurar secrets |
| Build Amplify #59 fallido | `import { deleteEmployee }` de `lib/api.ts` en Client Component arrastra `next/headers` | Fetch inline en Client Components |

### Pendientes para próxima sesión
1. API key de Antonio Torres para ver todos los proyectos en Cor
2. Webhook Lievant Admin → Cor para replicar clientes y proyectos
3. Tab Rentabilidad: conectar con API de Cor para horas registradas
4. Buscador de clientes que incluya marcas (ej: buscar "Dislicores")
5. Tab Proyectos en detalle de clientes y empleados
6. Notificaciones por email para recordatorios de facturación

---

## Sesión 16 — 5 de julio de 2026
**Objetivos:** Fix KPI RRHH, Soporte TI colaboradores, adjuntos tickets, Maestro de Licencias

### Lo que se construyó

- **Fix KPI "Nuevos ingresos" RRHH**:
  - Antes: filtraba por `created_at` (fecha de registro en sistema) en frontend con limit 100
  - Ahora: `computeStats()` calcula por `seniority_date` del mes actual en backend con SQL directo
  - Elimina query extra `listEmployees({ limit: 100 })` del frontend

- **Módulo Soporte TI para colaboradores** (`feat(herramientas)`):
  - GET `/inventory/equipment/my` — equipos asignados al usuario autenticado
  - `/herramientas/soporte`: vista "Mis tickets" con filtro estado y semáforo SLA
  - `/herramientas/soporte/nuevo`: formulario colaborador con equipo desde inventario
  - Campo equipo muestra nombre legible (Laptop Dell — TEC-2026-001) en lugar de UUID
  - Pantalla de confirmación con TIC-YYYY-NNN al crear ticket
  - Sidebar: "Soporte TI" en sección Herramientas

- **Adjuntos en tickets** (`feat(helpdesk)`):
  - Tabla `helpdesk.ticket_attachments` con índice
  - `HelpdeskStorageService`: upload a S3 + URL prefirmada 1h TTL
  - POST `/helpdesk/tickets/:id/attachments` (multipart, máx 10MB, JPG/PNG/PDF)
  - Vista TD: sección "Adjuntos" con AttachmentRow + botón Descargar
  - Formulario colaborador: flujo 2 pasos (crear ticket → subir adjunto)
  - Fix columna `name` → `file_name` en dev y staging

- **Módulo Maestro de Licencias** (`feat(licenses)`):
  - Schema `licenses`: tool_catalog (9 herramientas), employee_licenses, tool_assignments
  - 112 empleados con 480 asignaciones importados desde CSV
  - 32 emails no encontrados (cuentas genéricas/compartidas)
  - Backend: 7 endpoints con filtros por herramienta, área, acceso
  - Frontend: lista con badges ✅/❌ por herramienta + 👑 para admins
  - Detalle: toggles de acceso + checkbox superadmin por herramienta
  - Botón "+ Nueva herramienta" para SUPER_ADMIN con modal
  - Nueva herramienta aparece automáticamente como columna en la tabla

### Problemas y soluciones

| Problema | Causa | Solución |
|---|---|---|
| Adjunto falla en staging | Columna `name` en vez de `file_name` en ticket_attachments | Lambda rename + fix en dev |
| KPI nuevos ingresos incorrecto | Usaba `created_at` y limit 100 en frontend | Mover cálculo al backend con `seniority_date` |
| Campo equipo mostraba UUID | `value` del select era `eq.id` en lugar del label | Construir label "Laptop Dell — TEC-2026-001" en handleSubmit |

### Pendientes para próxima sesión
1. Investigación flujo de compras
2. Arquitectura capa operativa
3. Chatbot SGSI
4. Tab Proyectos en detalle de clientes y empleados
5. Notificaciones por email (AWS SES)
6. Webhook Lievant Admin → Cor

---

## Sesión 17 — 5 de julio de 2026 (tarde)
**Objetivos:** ISOBOT chatbot RAG, Maestro de Licencias staging, fixes varios

### Lo que se construyó

- **Módulo ISOBOT — Chatbot RAG para SGSI ISO 27001** (`f068ea9`):
  - pgvector 0.8.0 habilitado (imagen `pgvector/pgvector:pg16`)
  - Schema `isobot`: documents, document_chunks (vector 1536 dims + índice ivfflat), conversations, messages
  - Pipeline RAG completo:
    * OpenAI `text-embedding-3-small` para embeddings
    * Claude `claude-sonnet-4-6` para generar respuestas
    * Búsqueda semántica por similitud coseno en pgvector
  - `IsobotIngestionService`: extracción texto PDF/DOCX/XLSX → chunking 500 tokens → embeddings batch → pgvector
  - Fixes de ingesta: timeout por archivo, batching 100 chunks, límite 1000 filas/50 cols en XLSX
  - 380 documentos procesados → 364 únicos → 1,638 chunks en dev y staging
  - System prompt estricto: solo SGSI e ISO 27001, conoce quién es el usuario y su área, no da info confidencial
  - Frontend: chat estilo WhatsApp, avatar ISOBOT, Markdown renderizado con `react-markdown` + `@tailwindcss/typography`
  - Fuentes clickeables con presigned URL de S3
  - Mensaje de bienvenida personalizado con nombre del usuario
  - Sidebar: ISOBOT en sección HERRAMIENTAS con ícono ti-robot
  - OPENAI_API_KEY + ANTHROPIC_API_KEY en Secrets Manager staging (task definition rev 7)

- **Fix Markdown ISOBOT** (`e33c7df`):
  - `react-markdown` v10 + `@tailwindcss/typography` instalados
  - Respuestas con negritas, listas, encabezados, separadores renderizados correctamente

- **Seed ISOBOT staging via Lambda**:
  - JSONs subidos a S3 (`isobot-seed/`) para evitar límite de 50MB de Lambda
  - Remapeo UUID dev → staging por file_name para foreign keys correctas
  - 364 documentos + 1,638 chunks cargados en staging

### Arquitectura técnica ISOBOT

```
Usuario pregunta
      ↓
Embedding de la pregunta (OpenAI text-embedding-3-small)
      ↓  
pgvector busca top-5 chunks más similares (coseno)
      ↓
System prompt + chunks contexto + perfil usuario
      ↓
Claude claude-sonnet-4-6 genera respuesta en Markdown
      ↓
Respuesta + fuentes documentales con link S3
```

### Documentos del SGSI indexados
- 14 macroprocesos (Dirección, TI, Compras, RRHH, Medios, etc.)
- 380 archivos procesados (27 PDF, 134 DOCX, 219 XLSX)
- Excluidos: carpetas Obsoletos/Obsoleto (8 archivos)
- Archivo problemático: MED-PR-01 XLSX con 16,384 columnas con formato → resuelto con límite 50 cols

### Pendientes fase 2 ISOBOT
1. Panel de administración para subir/reemplazar/eliminar documentos sin código
2. Sección "Contexto de empresa" — texto base que ISOBOT siempre tiene disponible
3. Log de conversaciones para análisis de preguntas frecuentes
4. Alertas ISOBOT integradas al tablón del dashboard
