# Plan de implementación — Registro de mantenimientos de equipo

**Base:** `origin/develop` (Fase 0: `git reset --hard origin/develop`, rama `dev/leonardo`, 0/0 contra develop).
**Spec:** `docs/specs/mantenimientos-equipo.md` (fuente de verdad).
**Fecha:** 2026-09-29.

Este plan es el resultado de la Fase 1 (investigación del código). Cada tarea trae su
criterio de verificación y los criterios de aceptación de la spec (1–15) que cubre.

---

## Hallazgos de la investigación (con ruta y línea)

1. **Migraciones** — `1751000000026-AddEquipmentWarranty.ts` y `1751000000028-CreateAuditModule.ts`:
   usan `queryRunner.query()` con SQL crudo, `IF NOT EXISTS`, índices `DESC`, y `down()` que
   revierte en orden inverso (drop índices → drop columnas/tablas). La clase se nombra
   `<Nombre><timestamp>` con `name = '<Nombre><timestamp>'`.
   - Última migración en la base (`ls` sobre HEAD == origin/develop): `1751000000028-CreateAuditModule.ts`.
   - **La nueva será `1751000000029-CreateEquipmentMaintenance.ts`.**
   - `data-source.ts:172` carga migraciones por glob (`migrations/*{.js,.ts}`) → la nueva se
     detecta sola. Las entidades en `data-source.ts` están listadas **explícitamente**, pero
     esa lista solo la usa el CLI de migraciones (SQL crudo), no necesita la entidad nueva.

2. **Historial (RN-6)** — `inventory.service.ts`: el patrón para escribir en `equipment_history`
   es `this.historyRepo.save(this.historyRepo.create({ equipmentId, changedById: userId,
   changedByName: userName, action, fieldChanged?, oldValue?, newValue?, notes? }))`.
   - Alta: `create()` líneas 435-443, `action: 'CREADO'`.
   - Edición: `update()` líneas 525-541, `action: 'EDITADO'` (una fila por campo).
   - Asignar/Desasignar: `action: 'ASIGNADO' | 'DESASIGNADO'`.
   - Reutilizaré este patrón con acciones tipo `MANTENIMIENTO_*`.

3. **Semáforo (garantía → mantenimiento)** — `warrantyStatus()` en `inventory.service.ts:236`,
   constante `WARRANTY_WARNING_DAYS = 30` en la línea 17. Compara contra **medianoche local**
   (`today.setHours(0,0,0,0)`) y calcula días con `Math.round(diff / 86_400_000)`.
   `maintenanceStatus()` seguirá exactamente este patrón. Helper `toDateString()` (línea 25)
   formatea DATE en local (no `toISOString`).

4. **DTOs** — `create-equipment.dto.ts`: usan `class-validator` (`@IsNotEmpty`, `@IsString`,
   `@IsOptional`, `@IsDateString`, `@IsUUID`, `@IsNumber` + `@Type(() => Number)`). El
   `ValidationPipe` global tiene `whitelist` + `forbidNonWhitelisted` → **todo campo necesita
   decorador**. `update-*.dto` usa `PartialType(create)` de `@nestjs/mapped-types`.
   - Para tipo restringido usaré `@IsIn(['Preventivo','Correctivo'])`.
   - Para "fecha no futura" (RN-3) usaré un validador de fecha ≤ hoy (`@IsDateString` +
     comprobación, o un validador custom simple inline).

5. **Módulo** — `inventory.module.ts:17` registra entidades en `TypeOrmModule.forFeature([...])`.
   `app.module.ts:41` tiene **`autoLoadEntities: true`** → registrar la entidad nueva y
   `TicketAssignee` en `forFeature` basta para el runtime (no hay que tocar `app.module.ts`
   ni `data-source.ts`).
   - **`TicketAssignee` NO crea dependencia circular:** es una entidad plana
     (`helpdesk/entities/ticket-assignee.entity.ts`, sin imports de HelpdeskModule) y
     `catalogs.module` ya la registra en su `forFeature` igual. Importar la clase de entidad
     no importa el módulo.

6. **Orden de rutas** — `inventory.controller.ts`: `equipment/stats` (139), `equipment/warranty-expiring`
   (146), `equipment/report/by-area`, `equipment/search`, `equipment/my`, `equipment/by-employee/:id`
   van **antes** de `equipment` (191) y `equipment/:id` (197). Las rutas anidadas
   `equipment/:id/tickets` etc. van después de `:id` sin problema (sufijo estático).
   - **`equipment/maintenance-due` debe ir en el bloque de arriba (junto a warranty-expiring),
     antes de `equipment/:id`.** Las rutas `equipment/:id/maintenance[...]` van después de `:id`.

7. **Catálogo de técnicos** — `GET /api/v1/catalogs/ticket_assignees/active` (controlador
   `catalogs.controller.ts:14`, servicio `findActive` en `catalogs.service.ts:108`) devuelve el
   arreglo de entidades `TicketAssignee` crudas: **`{ id, name, email, role, isActive, sortOrder }`**,
   ordenado por `sortOrder ASC, name ASC`, filtrado `isActive = true`. El selector usa `id` + `name`.

8. **Frontend** — llamadas al API:
   - Componentes server (page.tsx) usan `apiFetchWithRetry` de `@/lib/api` (directo al backend).
   - Componentes cliente (`support-tab.tsx`, `warranty-card.tsx`, `info-tab.tsx`) usan
     `fetch('/api/inventory/...')` contra **proxy routes de Next** (uno por endpoint; **no hay
     catch-all**). Patrón del proxy: `api/inventory/equipment/[id]/tickets/route.ts` reenvía a
     `${NEXT_PUBLIC_API_URL}` con `Authorization: Bearer <cookie access_token>`.
   - Botón por permiso: `warranty-card.tsx` recibe `canWrite` como prop; hoy `info-tab.tsx:154`
     lo pasa siempre `true`. El listado usa `errorKind === 'forbidden'` → `<NoPermissions/>`.
   - UI: diálogos/tablas/badges con Tailwind + `ScrollableTable` (`@/components/ui/scrollable-table`),
     badges = `<span className="rounded-full px-2 py-0.5 text-xs font-semibold ...">`.
   - Semáforo en listado: patrón `WarrantyBadge` en `inventory-screen.tsx:57`.

9. **Scripts** (`apps/api/package.json`, se corren desde `apps/api`): `migration:run`,
   `migration:revert`, `lint`, `typecheck`, `test`, `dev` (no `start:dev`). Confirmado.
   Frontend (`apps/web/package.json`): pendiente confirmar en Fase 4 (`lint`, `typecheck`/`build`).

---

## ⚠️ Divergencia con la sección 10 de la spec (FRONTEND)

La sección 10 lista solo 4 archivos de frontend. Pero como **no hay proxy catch-all**, un
componente cliente no puede llamar al backend sin su route de Next. Para que la pestaña funcione
de verdad hacen falta archivos **fuera de la sección 10**:

- `apps/web/src/app/api/inventory/equipment/[id]/maintenance/route.ts` *(nuevo — proxy GET/POST)*
- `apps/web/src/app/api/inventory/equipment/[id]/maintenance/[maintenanceId]/route.ts` *(nuevo — proxy PATCH/DELETE)*
- Acceso al catálogo de técnicos desde el cliente: un proxy nuevo
  `apps/web/src/app/api/catalogs/ticket_assignees/active/route.ts` **o** cargar los técnicos en
  el server component y pasarlos como prop (tocaría `[id]/page.tsx`).
- `apps/web/src/lib/api.ts` — tipos (`maintenanceStatus`/`nextMaintenanceDate` en
  `EquipmentSummary`/`EquipmentDetail`) y, opcionalmente, funciones cliente.

**El backend NO diverge**: todo cae dentro de la sección 10 (gracias a `autoLoadEntities`).
Por eso el plan ejecuta primero el backend completo y, al llegar al frontend, se consulta esta
decisión de alcance (condición de parada explícita del encargo).

---

## Plan por tareas

### Backend (Fase 2) — todo dentro de la sección 10

- **B1. Migración `1751000000029-CreateEquipmentMaintenance.ts`.**
  Tabla `inventory.equipment_maintenance` con columnas de la spec §5; FK `equipment_id` →
  `inventory.equipment(id)` `ON DELETE CASCADE`; FK `technician_id` → `helpdesk.ticket_assignees(id)`;
  índice `(equipment_id, maintenance_date DESC)`; `down()` que hace drop de índice y tabla.
  - *Verificación:* `migration:run` aplica sin error; `\d inventory.equipment_maintenance` muestra
    columnas, FKs e índice.  *(cubre base de 1,9,10,14,15)*

- **B2. Entidad `equipment-maintenance.entity.ts`.**
  Mapea la tabla, con `@DeleteDateColumn deleted_at` + `deleted_by` (soft delete, patrón de
  `equipment.entity.ts`).
  - *Verificación:* `typecheck` pasa; el runtime la autocarga (forFeature en B8).  *(10)*

- **B3. DTOs `create-maintenance.dto.ts` / `update-maintenance.dto.ts`.**
  `maintenanceDate` (`@IsDateString` + no futura, RN-3), `maintenanceType`
  (`@IsIn(['Preventivo','Correctivo'])`, RN-8/D2), `technicianId` (`@IsUUID`, opcional según
  validación de activo), `observations` (`@IsOptional @IsString`). Update = `PartialType`.
  - *Verificación:* POST con fecha futura → 400; POST con tipo inválido → 400.  *(3→tipo, 4)*

- **B4. Servicio — CRUD + auditoría en `inventory.service.ts`.**
  `createMaintenance / updateMaintenance / softDeleteMaintenance / listMaintenanceByEquipment`.
  Valida técnico existe y `is_active` (RN-4), copia `technician_name` (spec §5), soft delete
  (RN-5), y escribe en `equipment_history` en alta/edición/borrado (RN-6).
  - *Verificación:* alta crea fila + fila de historial; técnico inactivo → error; borrado pone
    `deleted_at` y agrega historial.  *(2,4,9,10,11,12)*

- **B5. Cálculo de próximo mantenimiento (RN-8) + `maintenanceStatus()`.**
  `lastMaintenanceDate` = MAX(maintenance_date) de Preventivos no borrados; `nextMaintenanceDate`
  = +6 meses **con tope a fin de mes** (helper `addMonthsClamped`); `maintenanceStatus()` clonando
  `warrantyStatus()` (medianoche local, umbral 30 días). Prueba unitaria del caso 2026-08-31→2027-02-28
  y 2026-09-29→2027-03-29.
  - *Verificación:* `npm run test` del spec nuevo pasa (incluye el borde de fin de mes).  *(5,6,7,15)*

- **B6. Aislar D2/D4 en una función pequeña.**
  Una sola función pura (p. ej. `deriveMaintenance(records, today)`) que decide preventivo-vs-correctivo
  (D2) y sin_mantenimiento-vs-vencido (D4), para que cambiarlas cueste una línea.
  - *Verificación:* la lógica de D2/D4 vive en un único lugar con nombre claro.  *(8,9)*

- **B7. Controller — 5 rutas con `@RequirePermission`.**
  `GET equipment/maintenance-due` (read) **antes de `equipment/:id`**; `GET/POST equipment/:id/maintenance`
  (read/write); `PATCH/DELETE equipment/:id/maintenance/:maintenanceId` (write). `ParseUUIDPipe`
  en ids; `@CurrentUser()` para userId/userName.
  - *Verificación:* `GET equipment/maintenance-due` responde lista (no error de uuid); POST sin
    permiso write → 403.  *(13→403, 14, trampa de ruteo)*

- **B8. Módulo — `forFeature`.** Registrar `EquipmentMaintenance` y `TicketAssignee`.
  - *Verificación:* la API levanta sin error de dependencias; endpoints responden.

- **B9. Verificación de backend** (migración local + 5 endpoints + trampa de ruteo). Datos de
  prueba con prefijo `TEST-`.

### Frontend (Fase 3) — requiere aprobación de alcance (ver ⚠️ arriba)

- **F1.** `maintenance-tab.tsx` (nuevo): tabla + botón "Registrar mantenimiento" + diálogo
  (fecha, tipo, técnico, observaciones). Técnicos desde el catálogo.
- **F2.** `equipment-detail-screen.tsx`: agregar `'maintenance'` al tipo de tab + pestaña + badge
  de semáforo y próxima fecha en el encabezado.
- **F3.** `inventory-screen.tsx` + `constants.ts`: columna con el semáforo (patrón `WarrantyBadge`).
- **F4.** Ocultar botón "Registrar" para usuario solo-lectura (criterio 13).
- **F5.** (fuera de §10) proxy routes de mantenimiento + acceso a técnicos + tipos en `lib/api.ts`.

### Validación (Fase 4)
- Tabla de los 15 criterios ejecutados; `lint`/`typecheck`/`test` en `apps/api` y build/lint en
  `apps/web`; `git status` + `git log`.

## Commits (uno por tarea lógica, estilo repo)
`feat(inventario): ...` por B1..B8 agrupados con sentido; frontend por F*; y al final
`docs(inventario): spec y plan de mantenimientos de equipo`. Sin `package-lock.json`, sin push.
