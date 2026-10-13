# Spec — SGSI: Matriz de Riesgos (TIC-RE-08)

**Módulo:** SGSI › Matriz de Riesgos
**Autor:** Leonardo Cancino (Databeans)
**Fecha:** 2026-10-12
**Estado:** En implementación
**Referencia de datos:** `docs/specs/catalogos-matriz-riesgos.json` (catálogos, escalas y 7 riesgos de ejemplo de TIC-RE-08 v00).

## 1. Objetivo

Reemplazar el Excel TIC-RE-08 por un submódulo de SGSI: tabla ordenable con los campos clave y alta, consulta, edición y baja lógica de riesgos.

## 2. Decisiones

| # | Decisión | Por qué |
|---|---|---|
| D1 | Tabla de 8 columnas: Categoría, Riesgo, Valor de riesgo, Riesgo residual (con semáforo), Dueño, Estado de la acción, Fecha estimada de solución, Activo afectado. | Pedido. El resto vive en el formulario y el detalle. |
| D2 | Semáforo del residual: verde `≤ 20`, amarillo `> 20 y ≤ 40`, rojo `> 40`, con color **y texto**. | El Excel tenía 20/40 y 20.83/41.67; se usa 20/40. |
| D3 | Sin migración de datos, seed ni importador. | Son 7 riesgos y se cargan a mano. |
| D4 | Permisos `sgsi.riesgos.read` y `sgsi.riesgos.write` (write = crear, editar, eliminar), solo para SUPER_ADMIN. | Pedido; convención de las migraciones `…013` y `…030`. |
| D5 | Valor de riesgo y residual se calculan **solo en el backend** al guardar y se persisten (para ordenar y consultar). El API ignora cualquier valor que mande el cliente. | Fuente única de verdad. |
| D6 | La fórmula vive en `risk-calculation.ts` (API, con pruebas). El frontend tiene un espejo mínimo solo para la vista previa en vivo; una prueba de paridad en el API compara ambos en toda la rejilla de entradas. | No existe `packages/` compartido y el Dockerfile de la API copia solo `apps/api`. |
| D7 | Dueño: texto libre obligatorio. | Los dueños reales pueden no estar en la lista de empleados; `EmployeePicker` no admite valores libres. |
| D8 | Amenaza, Vulnerabilidad y Categoría: `<input list>` + `<datalist>` (sugerencias del catálogo y texto libre), el mismo patrón que el Macroproceso de ISOBOT. | No existe un select con búsqueda y valor libre en el repo. |
| D9 | Activo afectado: texto libre; el catálogo de tipos de activo es orientativo. | Pedido. |
| D10 | Fecha estimada de solución: `date` opcional. Fecha de reporte: opcional; si falta al crear, hoy en hora de México. | En el Excel venía como texto. |
| D11 | Migración **`1751000000033`** (la 032 ya la tomó inventario en `develop` y `staging`). | Confirmado con el usuario. |

## 3. Modelo de datos (`sgsi.risks`)

`id` UUID PK · `category` varchar(100) · `threat` varchar(300) · `vulnerability` varchar(300) · `affected_asset` varchar(200) · `risk` text — todos NOT NULL.
`vulnerability_score`, `severity_score`, `probability_score` smallint NOT NULL con CHECK 1..5 · `risk_value` smallint NOT NULL CHECK 1..125 (calculado).
`control` text NOT NULL · `control_efficacy` numeric(2,1) NOT NULL CHECK en {0.1…0.5} · `residual_risk` numeric(5,2) NOT NULL CHECK 0.1..62.5 (calculado).
`reported_at` date · `mitigation_strategy` text · `actions` text · `estimated_resolution_date` date — opcionales.
`owner` varchar(200) NOT NULL · `action_status` varchar(20) NOT NULL con CHECK a los 5 estados (`No iniciado`, `Pendiente`, `Iniciado`, `En proceso`, `Resuelto`).
Auditoría: `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`, `deleted_by`. Borrado lógico por `deleted_at`.

**Obligatorios:** categoría, riesgo, amenaza, vulnerabilidad, activo afectado, los tres puntajes, control, eficacia, dueño y estado. **Opcionales:** fecha de reporte, estrategia de mitigación, acciones y fecha estimada.

## 4. Reglas de negocio

- Valor de riesgo = Vulnerabilidad × Severidad × Probabilidad (1..125).
- Riesgo residual = Valor × Eficacia, redondeado a 2 decimales (4·4·3·0.3 = 14.4, no 14.399999…).
- Semáforo según D2.

## 5. Contrato de API (permiso por ruta)

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/risks` | `sgsi.riesgos.read` — todos los activos, sin paginar |
| GET | `/risks/:id` | `sgsi.riesgos.read` |
| POST | `/risks` | `sgsi.riesgos.write` |
| PATCH | `/risks/:id` | `sgsi.riesgos.write` |
| DELETE | `/risks/:id` | `sgsi.riesgos.write` (baja lógica) |

Respuesta de riesgo: campos camelCase + `riskValue`, `residualRisk` (números) y `level` (`verde|amarillo|rojo`). Validación estricta (`whitelist` + `forbidNonWhitelisted`): enviar `riskValue`/`residualRisk` es un error 400.

## 6. Menú y rutas

SGSI pasa a grupo desplegable (patrón de Transformación Digital): "Administración ISOBOT" (`/sgsi/isobot`, `sgsi.isobot.write`, pantalla sin cambios) y "Matriz de Riesgos" (`/sgsi/matriz-riesgos`, `sgsi.riesgos.read`). El grupo se ve si hay al menos un hijo visible y enlaza al primero.

## 7. Criterios de aceptación

1. SGSI se despliega con "Administración ISOBOT" y "Matriz de Riesgos" según permisos; sin ninguno, no se ve el grupo.
2. La tabla muestra las 8 columnas y cada encabezado alterna ascendente/descendente.
3. Valor y residual se calculan en el backend con redondeo a 2 decimales; semáforo 20/40 con color y texto.
4. Ver, crear, editar y eliminar (baja lógica); acciones de escritura solo con `write`.
5. Amenaza y Vulnerabilidad ofrecen sugerencias y aceptan texto libre.
6. Las validaciones rechazan valores fuera de rango.
7. La migración 033 está lista e idempotente, con instrucciones; no se aplicó.
8. ISOBOT (admin y chat) igual que antes.
9. `tsc`, pruebas y build pasan.

## 8. Archivos a tocar

Backend: `migrations/1751000000033-CreateRiskMatrix.ts`, módulo `modules/risks/` (entidad, DTOs, `risk-calculation.ts`, servicio, controlador, módulo, specs), `app.module.ts`, `database/data-source.ts`.
Frontend: `components/sidebar.tsx`, `sgsi/matriz-riesgos/` (página, pantalla, modales, catálogos, espejo de la fórmula), proxy routes `api/risks/...`.

## 9. Fuera de alcance

Importador y seed, exportación a Excel, gráficas, filtros avanzados, historial de cambios, catálogos administrables, selector de empleados para el dueño.
