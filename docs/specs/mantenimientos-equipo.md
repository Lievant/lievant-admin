# Spec — Registro de mantenimientos de equipo

**Módulo:** Transformación Digital › Inventario
**Autor:** Leonardo Cancino (Databeans)
**Fecha:** 2026-09-29
**Estado:** Borrador — pendiente de validación con Paulo
**Paso SDD:** Specify (el *qué*, no el *cómo*)

---

## 1. Contexto

La política interna de Lievant exige dar mantenimiento a cada equipo **cada 6 meses**.
Hoy el sistema no tiene dónde registrar eso:

- `inventory.equipment` guarda los datos del equipo (tipo, marca, serie, asignación, garantía), pero ningún dato de mantenimiento.
- `inventory.equipment_history` **no sirve** para esto: es una tabla de auditoría de cambios de campos (`old_value` / `new_value` / `field_changed`), no una bitácora de servicios.
- El detalle de equipo (`/transformacion/inventario/[id]`) tiene 4 pestañas: Info, Asignación, Historial y Soporte. No hay ninguna de mantenimientos.

Resultado: hoy nadie puede contestar "¿a qué equipos les toca mantenimiento este mes?" sin salirse del sistema.

## 2. Objetivo

Que cualquier equipo del inventario tenga una bitácora de mantenimientos, y que el sistema calcule solo cuándo le toca el siguiente según la regla de 6 meses.

## 3. Decisiones asumidas

No venían en el requerimiento. Las tomé para poder avanzar; **Paulo debería confirmarlas** antes de implementar.

| # | Decisión | Por qué |
|---|---|---|
| D1 | Además de guardar, el sistema **calcula el próximo mantenimiento** y muestra un semáforo (Al día / Por vencer / Vencido). | Sin fecha calculada la regla de "cada 6 meses" no sirve de nada: quedaría como una lista que alguien tiene que revisar a mano. |
| D2 | Se agrega el campo **tipo de mantenimiento** (Preventivo / Correctivo). Solo el preventivo reinicia el reloj de 6 meses. | Si a un equipo se le cambia la pantalla porque se rompió, eso no es el mantenimiento semestral de la política. Sin esta distinción el semáforo miente. |
| D3 | **Sin archivos adjuntos** en esta fase. | No se pidió evidencia. Si después se quiere, se reutiliza el flujo de subida a S3 que ya usa la factura de garantía. |
| D4 | Un equipo sin ningún preventivo registrado sale como **"Sin mantenimiento"**, no como "Vencido". | Si se contara desde la fecha de compra, el día que esto se libere casi todo el parque aparecería en rojo y el semáforo nacería inservible. |
| D5 | Fuera de alcance por ahora: **notificaciones por correo** y **pantalla de reporte** dedicada. | Se pueden agregar después sobre la misma base; meterlas ahora triplica el tamaño del entregable. |

## 4. Alcance

**Dentro**

- Nueva tabla `inventory.equipment_maintenance`.
- Alta, edición, borrado (lógico) y listado de registros por equipo.
- Nueva pestaña **Mantenimientos** en el detalle de equipo.
- Cálculo de próximo mantenimiento y estado (semáforo), visible en el detalle y en el listado de inventario.
- Endpoint de "mantenimientos por vencer".

**Fuera**

- Avisos por correo, reporte dedicado, adjuntos, costo del servicio, proveedor externo.
- Programar u ordenar mantenimientos (esto solo registra lo que ya pasó).

## 5. Modelo de datos

### Tabla nueva: `inventory.equipment_maintenance`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `equipment_id` | uuid NOT NULL | FK → `inventory.equipment(id)` `ON DELETE CASCADE` |
| `maintenance_date` | date NOT NULL | Cuándo se hizo. No puede ser futura. |
| `maintenance_type` | varchar(20) NOT NULL | `'Preventivo'` \| `'Correctivo'`. Default `'Preventivo'`. |
| `technician_id` | uuid NULL | FK → `helpdesk.ticket_assignees(id)` |
| `technician_name` | varchar(200) NOT NULL | Copia del nombre al momento de registrar |
| `observations` | text NULL | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `deleted_at` | timestamptz NULL | Soft delete universal (convención de la casa) |
| `deleted_by` | uuid NULL | |

Índice: `(equipment_id, maintenance_date DESC)`.

**Por qué se guarda `technician_name` además del `technician_id`:** si mañana dan de baja a un técnico del catálogo, los mantenimientos históricos deben seguir diciendo quién los hizo. Es el mismo patrón que ya usa `equipment_history.changed_by_name`.

### Campos derivados (calculados, no almacenados)

- `lastMaintenanceDate` = `MAX(maintenance_date)` de los registros **Preventivos** no borrados del equipo.
- `nextMaintenanceDate` = `lastMaintenanceDate + 6 meses`.
- `maintenanceStatus`: `'sin_mantenimiento'` \| `'vencido'` \| `'por_vencer'` \| `'al_dia'`.

**Por qué derivados y no una columna en `equipment`:** una columna se queda vieja en cuanto alguien edita o borra un registro. Calculándolo, cualquier corrección se refleja sola.

El cálculo debe copiar tal cual el método `warrantyStatus()` que ya está en `inventory.service.ts`: compara contra medianoche local, porque con `new Date()` a secas un mantenimiento que vence hoy caería en "vencido" desde el primer minuto del día. Mismo umbral de aviso (`por_vencer` = faltan 30 días o menos).

## 6. Reglas de negocio

- **RN-1** — Solo un mantenimiento de tipo **Preventivo** reinicia el conteo de 6 meses.
- **RN-2** — Equipo sin ningún preventivo → `sin_mantenimiento`. Nunca `vencido`.
- **RN-3** — `maintenance_date` no puede ser futura.
- **RN-4** — El técnico debe existir y estar **activo** (`is_active = true`) en `helpdesk.ticket_assignees` al momento de registrar. Uno inactivo puede aparecer en registros viejos, pero no se puede elegir en uno nuevo.
- **RN-5** — Borrado lógico. Nunca `DELETE` físico.
- **RN-6** — Cada alta, edición y borrado escribe también un renglón en `inventory.equipment_history` (patrón de la casa: toda modificación al equipo queda auditada).
- **RN-7** — Aplica a **todos** los equipos, sin importar tipo ni estatus.
- **RN-8** — El "+6 meses" se suma por **mes calendario con tope a fin de mes**, no por 180 días ni con `setMonth()` a secas. Último preventivo 2026-08-31 → próximo **2027-02-28** (no 2027-03-03). `Date.setMonth()` de JavaScript desborda al mes siguiente; el `+ interval '6 months'` de Postgres sí hace el tope solo. Cuando el cálculo se haga en TypeScript hay que topar el día manualmente.

## 7. Contrato de API

Prefijo global: `/api/v1`. Controller: `inventory.controller.ts`.

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/inventory/equipment/maintenance-due?days=30` | `transformacion` · `inventario` · `read` |
| `GET` | `/inventory/equipment/:id/maintenance` | `transformacion` · `inventario` · `read` |
| `POST` | `/inventory/equipment/:id/maintenance` | `transformacion` · `inventario` · `write` |
| `PATCH` | `/inventory/equipment/:id/maintenance/:maintenanceId` | `transformacion` · `inventario` · `write` |
| `DELETE` | `/inventory/equipment/:id/maintenance/:maintenanceId` | `transformacion` · `inventario` · `write` |

> ⚠️ **Trampa de ruteo:** `equipment/maintenance-due` tiene que declararse **antes** que `equipment/:id` en el controller. Si va después, Nest lo resuelve como `:id = "maintenance-due"` y truena buscando un uuid. El controller actual ya ordena así `equipment/stats` y `equipment/warranty-expiring`; hay que respetar ese orden.

El selector de técnicos consume el endpoint genérico de catálogos que **ya existe**, no hace falta uno nuevo:

```
GET /api/v1/catalogs/ticket_assignees/active
```

(`ticket_assignees` es la entidad que en `/admin/catalogos` aparece como **"Técnicos de soporte TI"**.)

## 8. Frontend

- Nueva pestaña **Mantenimientos** en `equipment-detail-screen.tsx` — hoy el estado es `'info' | 'assignment' | 'history' | 'support'`, se agrega `'maintenance'`.
- Nuevo archivo `maintenance-tab.tsx`, hermano de `support-tab.tsx`: tabla de registros + botón "Registrar mantenimiento" + diálogo con los 4 campos (fecha, tipo, técnico, observaciones).
- Encabezado del detalle: badge con el semáforo y la fecha del próximo mantenimiento.
- Listado de inventario: columna con el semáforo, para poder filtrar los vencidos de un vistazo.

## 9. Criterios de aceptación

Esto es lo que define "terminado". Si algo de aquí no pasa, no está hecho.

1. En el detalle de cualquier equipo existe la pestaña **Mantenimientos**.
2. Al registrar un mantenimiento se piden fecha, tipo, técnico y observaciones; el técnico se elige de una lista que sale del catálogo de Técnicos de soporte TI.
3. Un técnico marcado como inactivo **no** aparece en la lista para elegir.
4. Intentar guardar con fecha futura devuelve error de validación y no guarda nada.
5. Registrado un preventivo con fecha 2026-09-29, el equipo muestra próximo mantenimiento **2027-03-29** y estado **Al día**.
6. Un equipo cuyo último preventivo fue hace más de 6 meses muestra **Vencido**.
7. Un equipo cuyo próximo mantenimiento cae dentro de los siguientes 30 días muestra **Por vencer**.
8. Un equipo sin ningún preventivo muestra **Sin mantenimiento** (no "Vencido").
9. Un mantenimiento **Correctivo** aparece en la bitácora pero **no** cambia la fecha del próximo mantenimiento.
10. Borrar un registro lo saca de la lista pero lo conserva en base con `deleted_at`; si era el último preventivo, el semáforo se recalcula solo.
11. Si se da de baja del catálogo al técnico que hizo un mantenimiento, el registro histórico sigue mostrando su nombre.
12. Alta, edición y borrado dejan rastro en el historial del equipo.
13. Un usuario con permiso solo de lectura ve la pestaña pero no el botón de registrar, y el `POST` le responde 403.
14. `GET /inventory/equipment/maintenance-due` devuelve los equipos cuyo próximo mantenimiento cae dentro de los N días.
15. Un preventivo con fecha 2026-08-31 da próximo mantenimiento **2027-02-28** (tope a fin de mes, RN-8).

## 10. Archivos a tocar

**Backend**

- `apps/api/src/database/migrations/1751000000029-CreateEquipmentMaintenance.ts` *(nueva — sigue la numeración; la última es la `...028-CreateAuditModule`)*
- `apps/api/src/modules/inventory/entities/equipment-maintenance.entity.ts` *(nueva)*
- `apps/api/src/modules/inventory/dto/create-maintenance.dto.ts` · `update-maintenance.dto.ts` *(nuevas)*
- `apps/api/src/modules/inventory/inventory.service.ts` *(métodos + `maintenanceStatus()`)*
- `apps/api/src/modules/inventory/inventory.controller.ts` *(5 rutas, cuidando el orden)*
- `apps/api/src/modules/inventory/inventory.module.ts` *(registrar la entidad en `forFeature` y la `TicketAssignee` para validar el técnico)*

**Frontend**

- `apps/web/src/app/(dashboard)/transformacion/inventario/[id]/maintenance-tab.tsx` *(nueva)*
- `apps/web/src/app/(dashboard)/transformacion/inventario/[id]/equipment-detail-screen.tsx`
- `apps/web/src/app/(dashboard)/transformacion/inventario/inventory-screen.tsx`
- `apps/web/src/app/(dashboard)/transformacion/inventario/constants.ts`

**Frontend — infraestructura de datos (añadido durante la implementación).**
El listado original omitía estos archivos, pero como el web app **no tiene un proxy
catch-all** hacia el API (cada endpoint tiene su propio `route.ts`) y los componentes
cliente llaman al backend vía `fetch('/api/...')`, la pestaña no funciona sin ellos:

- `apps/web/src/app/api/inventory/equipment/[id]/maintenance/route.ts` *(nueva — proxy GET/POST)*
- `apps/web/src/app/api/inventory/equipment/[id]/maintenance/[maintenanceId]/route.ts` *(nueva — proxy PATCH/DELETE)*
- `apps/web/src/app/api/catalogs/ticket_assignees/active/route.ts` *(nueva — proxy acotado SOLO a `ticket_assignees/active`, para el selector de técnicos; no es un proxy genérico de catálogos)*
- `apps/web/src/lib/api.ts` *(tipos: `MaintenanceStatus`, `MaintenanceRecord`, `MaintenanceListResponse`, `TechnicianOption`; y `maintenanceStatus`/`nextMaintenanceDate` en `EquipmentSummary`, `lastMaintenanceDate` en `EquipmentDetail`)*

## 11. Dudas abiertas para Paulo

1. **¿Se confirman las decisiones D1–D5 de la sección 3?** Sobre todo D2 (separar preventivo de correctivo) y D4 (arrancar en "Sin mantenimiento").
2. **Equipos dados de baja o en resguardo** — ¿deben seguir apareciendo en el semáforo y en "por vencer", o se excluyen por estatus?
3. **¿Quién captura?** Asumí el permiso normal de escritura de inventario. ¿O el técnico debe poder capturar su propio mantenimiento sin tener acceso al resto del módulo?
4. **Los 6 meses, ¿son fijos para todo el parque** o algunos tipos de equipo llevan otra periodicidad?
5. **¿Hay historial en papel o Excel** que haya que migrar como carga inicial?
