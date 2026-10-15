# Spec — Herramientas › Gestión de Contraseñas (TIC-RE-17): visible para todos, alcance por jerarquía, sin exportar

**Módulo:** Herramientas › Gestión de Contraseñas (`/herramientas/passwords`)
**Autor:** Leonardo Cancino (Databeans)
**Fecha:** 2026-10-15
**Estado:** En implementación

## 1. Qué existía

- Es una bóveda **administrada por el líder** (migración `…027`): el líder registra las cuentas (aplicación, usuario, contraseña cifrada) de sus **subordinados directos**; solo él crea, edita, revoca y revela la contraseña (tope de 10 por hora, bitácora en `passwords.reveal_log` y log de seguridad).
- La persona dueña de la cuenta no veía nada: `list` filtraba por `employee.direct_report_to_id = yo`.
- La opción del menú exigía ser jefe **y** el permiso `herramientas.passwords.read` (sembrado solo para SUPER_ADMIN y DIRECTOR).
- "Exportar Excel" era solo cliente (`exportExcel` en `passwords-screen.tsx`, librería `xlsx`); no hay endpoint. Ningún otro módulo lo usa.
- La jerarquía ya vive en el propio servicio (`teamQuery`: `direct_report_to_id`, activos, sin auto-referencia); Vacaciones usa el mismo campo.

## 2. Decisiones (confirmadas con el usuario)

| # | Decisión |
|---|---|
| D1 | **El jefe sigue gestionando** las cuentas de sus subordinados directos (crear, editar, revocar, revelar). La persona **lee las suyas** (las que su jefe le asignó) y puede revelarlas con el mismo tope y bitácora; sin botones de escritura. |
| D2 | Alcance: **propia + subordinados directos activos** (un nivel). Pares, indirectos e inactivos: 403. |
| D3 | Se quita el permiso de `GET /passwords` y `GET /passwords/:id/reveal`; el alcance lo fija el servicio. Los endpoints de escritura conservan `herramientas.passwords.write`. Sin migración. |
| D4 | Se elimina "Exportar Excel" (botón, función y la importación de `xlsx` de esta pantalla). La librería `xlsx` se conserva: otras pantallas la usan. |
| D5 | Ver una contraseña: la propia persona, su jefe actual (subordinado directo **activo**) o SUPER_ADMIN. Se retira el acceso del "líder que la asignó" cuando ya no es su jefe. |

## 3. Matriz de acceso

| Quien llama | Lista / revela sus propias cuentas | Lista / revela las de un subordinado directo activo | Pares, indirectos, inactivos u otros | Crear / editar / revocar |
|---|---|---|---|---|
| Colaborador | Sí (solo lectura) | — | 403 | No |
| Jefe | Sí (solo lectura) | Sí | 403 | Sí, sobre sus subordinados, con `write` |
| SUPER_ADMIN | Sí | Revelar sí (sin cambio); listar solo su alcance | — | Sin cambio |
| Sin registro de empleado | `[]` (estado vacío) | `[]` | — | 403 (sin cambio) |

## 4. Contrato de API

- `GET /passwords?employeeId=` (sin permiso): por defecto la propia persona; con `employeeId` solo si es ella misma o un subordinado directo activo, si no **403** genérico ("No tienes acceso a la información de esta persona.").
- `GET /passwords/visible-people` (nuevo): `[{ id, fullName, isMe }]` con la propia persona y sus subordinados directos activos. Nada más.
- `GET /passwords/:id/reveal` (sin permiso): según D5.
- Sin cambios: `team-employees`, `is-manager`, `applications`, escritura.

## 5. Criterios de aceptación

1. Colaborador y jefe ven "Gestión de Contraseñas" en Herramientas.
2. Un colaborador solo obtiene su información; pedir la de otra persona devuelve 403 aunque el id se mande a mano.
3. Un jefe ve la suya y la de sus subordinados directos activos, y no a pares, indirectos ni inactivos.
4. Selector con búsqueda; por defecto "Yo"; sin subordinados solo el nombre.
5. En "Yo" la pantalla es de solo lectura; en un subordinado conserva las acciones del jefe.
6. No existe "Exportar Excel".
7. Vacaciones y otros módulos igual; `tsc`, pruebas y build pasan.

## 6. Archivos a tocar

Backend: `passwords.controller.ts`, `passwords.service.ts`, `dto/password.dto.ts` (sin cambios de forma), `passwords.service.spec.ts` (nuevo).
Frontend: `herramientas/passwords/page.tsx`, `passwords-screen.tsx`, `person-select.tsx` (nuevo), `components/sidebar.tsx`, `lib/api.ts`, proxy `api/passwords/visible-people/route.ts`.

## 7. Fuera de alcance

Cambiar cómo se guardan o cifran las contraseñas, jerarquía de varios niveles, exportaciones, vistas masivas, cambios en Vacaciones.
