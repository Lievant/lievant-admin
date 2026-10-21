# Spec — Herramientas › Gestión de Contraseñas (TIC-RE-17): visible para todos, cada quien gestiona lo suyo

**Módulo:** Herramientas › Gestión de Contraseñas (`/herramientas/passwords`)
**Autor:** Leonardo Cancino (Databeans)
**Fecha:** 2026-10-15 (revisada el mismo día)
**Estado:** En implementación

## 1. Qué existía

- Bóveda **administrada por el líder** (migración `…027`): el líder registraba las cuentas (aplicación, usuario, contraseña cifrada) de sus subordinados directos; solo él creaba, editaba, revocaba y revelaba (tope de 10 por hora, bitácora en `passwords.reveal_log` y log de seguridad).
- La opción del menú exigía ser jefe **y** el permiso `herramientas.passwords.read` (solo SUPER_ADMIN y DIRECTOR).
- "Exportar Excel" era solo cliente (sin endpoint); ya se eliminó.
- Primera revisión de esta spec (commits `3a99a21`, `a72c502`): leer y revelar pasaron a alcance por servicio (propia + subordinados directos activos), pero crear, editar y revocar seguían siendo solo del jefe.

## 2. Decisiones

| # | Decisión |
|---|---|
| D1 | **Cada persona gestiona sus propias cuentas** (ver, crear, editar, revocar, revelar) y **el jefe, además, las de sus subordinados directos activos**. |
| D2 | Alcance en el API, nunca por el cliente: el titular de la cuenta es el propio usuario (por su expediente) o un subordinado directo activo; cualquier otra persona (par, indirecto, inactivo, ajeno) recibe **403 genérico** que no revela si existe. |
| D3 | Los endpoints de cuentas (`GET`, `POST`, `PATCH`, `DELETE`, `reveal`) dejan de exigir `herramientas.passwords.read/write`. Solo el catálogo de aplicaciones conserva `write`. El permiso **no se borra** de la BD ni de su migración; solo deja de usarse en las cuentas (decidir con Paulo si se retira). |
| D4 | **Sin atajo por rol:** SUPER_ADMIN y DIRECTOR no ganan acceso a cuentas ajenas. Se retira el atajo de SUPER_ADMIN que existía en ver/revelar/editar/revocar y el del "líder que la asignó" cuando ya no es jefe. |
| D5 | Un usuario sin expediente de empleado ligado ve un estado vacío (lectura) y recibe 403 al escribir. |
| D6 | Se conservan: tope de revelado (10 por hora, el mismo para propias y ajenas), bitácora de cada revelado con actor y titular, cifrado actual y que nunca se registre una contraseña. |
| D7 | En las cuentas propias, `manager_id` (quien la asigna) es la propia persona; los avisos de vencimiento le llegan a ella una sola vez. |

## 3. Matriz de acceso

| Endpoint | Propia persona | Jefe sobre subordinado directo activo | Par, indirecto, inactivo o ajeno | Sin expediente |
|---|---|---|---|---|
| `GET /passwords` | Sus cuentas | Las del subordinado (`?employeeId=`) | 403 | `[]` |
| `GET /passwords/visible-people` | Ella misma (`isMe`) | Ella + sus subordinados | — | `[]` |
| `GET /passwords/:id/reveal` | Sí | Sí | 403 | 403 |
| `POST /passwords` | Sí (a su nombre) | Sí (a nombre del subordinado) | 403 | 403 |
| `PATCH /passwords/:id` | Sí | Sí | 403 | 403 |
| `DELETE /passwords/:id` (revocar) | Sí | Sí | 403 | 403 |
| Catálogo de aplicaciones (crear/editar/desactivar) | `herramientas.passwords.write` | ídem | ídem | ídem |

## 4. Contrato de API

Sin cambios de forma. Antes: crear/editar/revocar exigían `herramientas.passwords.write` y solo valían sobre subordinados directos; ver/revelar según la revisión previa. Después: ninguno exige permiso y todos valen para el titular propio o un subordinado directo activo (D2).

## 5. Criterios de aceptación

1. Con el usuario ligado a un expediente la pantalla no muestra "no vinculado" y permite crear, editar, revocar y revelar las cuentas propias.
2. Un subordinado directo activo aparece en el selector y se gestionan sus cuentas; un par o ajeno no aparece y su id a mano devuelve 403.
3. Un usuario sin subordinados ve solo su nombre, sin lista, y gestiona lo propio.
4. Un usuario sin expediente ve el estado vacío con el texto que dice qué hacer y no puede escribir (403).
5. Tope de revelado, bitácora (actor y titular) y cifrado funcionan igual; no se registra ninguna contraseña.
6. No existe "Exportar Excel"; Vacaciones y otros módulos igual; `tsc`, pruebas y build pasan.

## 6. Archivos a tocar

Backend: `passwords.controller.ts`, `passwords.service.ts`, `passwords.service.spec.ts`.
Frontend: `herramientas/passwords/page.tsx`, `passwords-screen.tsx`, `password-dialog.tsx`, `person-select.tsx`.

## 7. Fuera de alcance

Cambiar cómo se guardan o cifran las contraseñas, jerarquía de varios niveles, acceso por rol a datos de otras personas, exportaciones, cambios en Vacaciones.
