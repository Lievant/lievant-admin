# Spec — Matriz de Riesgos: "Dueño" con búsqueda de usuarios y notificación

**Módulo:** SGSI › Matriz de Riesgos
**Autor:** Leonardo Cancino (Databeans)
**Fecha:** 2026-10-13
**Estado:** En implementación
**Antecede:** `docs/specs/sgsi-matriz-riesgos.md` (el dueño era texto libre, D7).

## 1. Objetivo

Que el Dueño de un riesgo sea un usuario activo de la plataforma, elegido con búsqueda por nombre, y que reciba una notificación en la app al asignársele.

## 2. Qué existía y qué faltaba

| Pieza | Estado |
|---|---|
| `EmployeePicker` + `GET /employees/picker` | Existe y sirve con solo JWT, pero busca **empleados** (`employee_records`), devuelve su id (no el de `auth.users`) y filtra con `ILIKE` (distingue acentos). **No reutilizable** para guardar una referencia a un usuario. |
| Búsqueda de usuarios activos sin acentos | No existía → `GET /risks/owner-candidates`. |
| `NotificationsService.create()` | Existe: envía directo a un usuario (sin flujos), tiempo real por socket; el correo es un TODO. Se reutiliza. |
| Campo `owner` | Texto libre (`varchar(200)`). Pasa a copia del nombre + referencia. |

## 3. Decisiones

| # | Decisión | Por qué |
|---|---|---|
| D1 | Dueño = usuario activo de `auth.users`. Nombre mostrado: el del expediente (`employee_records.full_name`) si el usuario está vinculado; si no, `users.name`. | Pedido. |
| D2 | `GET /risks/owner-candidates?q=` protegido con `sgsi.riesgos.write`; mínimo 2 caracteres, máximo 10, solo activos, sin mayúsculas ni acentos. Devuelve solo `{ id, name, email }`. | Los endpoints de empleados/usuarios de RRHH exigen otros permisos o devuelven más datos. |
| D3 | Sin acentos con `translate(lower(...))` en SQL y normalización NFD en el servicio; **no** se depende de la extensión `unaccent`. | Evita una extensión en RDS. |
| D4 | Modelo: `owner_user_id UUID NOT NULL` (FK a `auth.users`) + `owner` se conserva como **copia del nombre** al asignar. | Convención del repo (`technician_name`, `expense_type_name`): el historial no cambia si el usuario se renombra o se da de baja. Tabla y orden usan `owner`. |
| D5 | Migración: se **modifica la 033** (la de la Matriz) porque no ha salido de la máquina local; se rehízo en la BD local con `revert` + `run` (ese `revert` elimina la tabla y sus filas). Idempotente; sin aplicar en staging ni producción. | Evita una 034 para un esquema que aún no existe en ningún ambiente. |
| D6 | El servicio rechaza un `ownerUserId` inexistente o inactivo al crear o al **cambiarlo**; conservar un dueño que luego quedó inactivo no se bloquea. | Pedido. |
| D7 | Notificación en la app: tipo `informativa`; `atencion` si el residual es rojo (> 40). Se envía al crear con dueño y al **cambiar** de dueño (al nuevo). No se notifica al editar otros campos, al eliminar, ni si el dueño es quien hace la acción. Un fallo se registra en el log y no impide guardar. | Pedido. |
| D8 | `actionUrl` a `/sgsi/matriz-riesgos` **solo** si el destinatario tiene `sgsi.riesgos.read` (se evalúa con `userHasPermission`); si no, sin enlace. | Hoy solo SUPER_ADMIN lo tiene: un enlace daría acceso denegado. |

## 4. Contrato de API

- `GET /risks/owner-candidates?q=` (`sgsi.riesgos.write`) → `[{ id, name, email }]`. Va antes de `GET /risks/:id`.
- `POST /risks` y `PATCH /risks/:id`: el campo `owner` (texto) se reemplaza por `ownerUserId` (UUID). Enviar `owner` es un error 400.
- Respuesta de riesgo: `owner` (nombre, copia), `ownerUserId` y `ownerActive` (false si el usuario hoy está inactivo, para mostrar "(inactivo)" al editar).

## 5. Criterios de aceptación

1. Al escribir en Dueño la lista se filtra por nombre (sin mayúsculas ni acentos), solo usuarios activos.
2. El dueño queda ligado por referencia y su nombre se ve en la tabla, el detalle y la edición.
3. Un dueño inexistente o inactivo es rechazado por el API.
4. Al registrar un riesgo el dueño recibe una notificación (`atencion` si el residual es rojo, `informativa` en otro caso); al cambiar el dueño, la recibe el nuevo.
5. No se notifica al editar otros campos, al eliminar ni cuando el dueño es quien registra.
6. Una falla de notificación no impide guardar.
7. El enlace solo existe si el destinatario puede abrirlo.
8. `tsc`, pruebas y build pasan; no hay correo.

## 6. Archivos a tocar

Backend: `migrations/1751000000033-CreateRiskMatrix.ts`, `risks/entities/risk.entity.ts`, `risks/dto/risk.dto.ts`, `risks/risks.service.ts` (+ spec), `risks/risks.controller.ts`, `risks/risks.module.ts`, `risks/risk-owner.util.ts` (+ spec).
Frontend: `sgsi/matriz-riesgos/risks-screen.tsx`, `sgsi/matriz-riesgos/owner-picker.tsx`, proxy `api/risks/owner-candidates/route.ts`.

## 7. Fuera de alcance

Correo (SES), flujos configurables en `/admin/flujos-notificacion`, vista "Mis riesgos asignados", cambios de permisos.
