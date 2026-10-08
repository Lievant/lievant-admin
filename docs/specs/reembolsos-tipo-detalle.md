# Spec — Mis Reembolsos: Tipo de Gasto obligatorio, "i" informativa y Detalle

**Módulo:** Herramientas › Mis Reembolsos
**Autor:** Leonardo Cancino (Databeans)
**Fecha:** 2026-10-05
**Estado:** En implementación
**Referencia:** `docs/specs/gastos-tarjeta-tipo-detalle.md` (mismo comportamiento, sin el bloqueo por factura ni el cambio de "procesar").

## 1. Objetivo

Replicar en reembolsos: Tipo de Gasto obligatorio (sin opción vacía, "Viáticos cliente" por defecto), "i" en el encabezado de Tipo de Gasto con la explicación de cada tipo, y columna "Detalle". (Información empezó como columna y se reemplazó por la "i"; ver sección 9.)

## 2. Decisiones

| # | Decisión | Por qué |
|---|---|---|
| D1 | **Detalle reutiliza `expenses.expense_lines.notes`** (TEXT, nullable). Sin migración. | Ya existía en entidad, DTO y servicio, pero ninguna pantalla lo capturaba ni mostraba. Evita una columna duplicada. |
| D2 | El DTO limita `notes` a 500 caracteres (`@MaxLength(500)`). La columna sigue siendo TEXT. | Mismo límite que Detalle en tarjetas. |
| D3 | Mismo catálogo `catalogs.expense_types` (4 tipos, sin renombrar). "Viáticos cliente" es `sort_order` 1. | El catálogo es compartido con tarjetas. |
| D4 | El mapa tipo → texto y la "i" de Tipo de Gasto viven en `apps/web/src/components/expense-type-info.tsx` (`ExpenseTypeHint`), compartido con tarjetas. | Una sola fuente, sin copiar y pegar. |
| D5 | Sin constraint NOT NULL en BD para `expense_type_id`; la obligatoriedad vive en DTO + servicio. Líneas históricas sin tipo no se tocan; al editarlas se preselecciona "Viáticos cliente". | No hay backfill. |
| D6 | Fuera de alcance: bloqueo de envío por factura, flujo de procesado, renombrar catálogo, enrutamiento por tipo. | El envío, la autorización y las notificaciones de reembolsos no dependen del tipo de gasto (verificado). |

## 3. Modelo

Sin cambios de esquema. `notes` ya existe (`1751000000010-CreateExpenseReportsModule`).

## 4. Reglas de negocio

- RN-1: crear/editar reporte exige `expenseTypeId` en cada línea, existente y activo en el catálogo.
- RN-2: `notes` (Detalle) se guarda recortado; vacío → null.
- RN-3: el Excel incluye la columna DETALLE junto a TIPO DE GASTO (sin Información).

## 5. Contrato de API

- `ExpenseLineDto`: `expenseTypeId` (UUID, **requerido**), `notes?` (string, máx. 500).
- Respuesta de línea: sin cambios (`notes` ya se devolvía).

## 6. Criterios de aceptación

1. Nuevo reporte: Tipo de Gasto sin opción vacía, arranca en "Viáticos cliente", 4 tipos.
2. API sin Tipo de Gasto o con uno inexistente → rechazado.
3. No hay columna "Información"; el encabezado de Tipo de Gasto tiene una "i" cuyo panel muestra los 4 textos.
4. El panel de la "i" se abre con hover, foco y clic/tap, se cierra con Escape o clic fuera, y no se recorta dentro de la tabla con scroll.
5. Columna "Detalle": se guarda y reaparece al reabrir y editar; vacío es válido.
6. El Excel incluye Detalle.
7. Reembolsos y líneas antiguas abren sin errores.
8. Envío y procesado de reembolsos igual que antes.
9. Gastos de Tarjeta no cambió.
10. `tsc` de la API y `npm run build -w apps/web` pasan.

## 7. Archivos a tocar

Backend: `expenses/dto/expense-report.dto.ts`, `expenses/expenses.service.ts`, `expenses/expenses.service.spec.ts`.
Frontend: `components/expense-type-info.tsx` (nuevo), `mis-gastos-tarjeta/card-shared.tsx`, `mis-reembolsos/expense-report-form.tsx`, `mis-reembolsos/expense-report-detail.tsx`, `lib/api.ts`. Proxy routes: ninguna nueva.

## 8. Bloqueo de envío sin adjunto

**Regla.** `PATCH /expenses/:id/submit` (único camino `draft → submitted`, `expenses.service.ts` `submitReport`) rechaza con 400 si alguna línea no tiene adjunto. Una línea tiene adjunto si `has_invoice = true` **y** `invoice_s3_key` no es nulo; imagen y documento cuentan igual (los formatos los fija el flujo de subida existente, sin restricciones nuevas). Los adjuntos son por línea y hoy no existe endpoint para borrarlos: un adjunto "quitado" (sin key) no cuenta.

**Contrato de error (mismo que tarjetas).** `{ statusCode: 400, error, message, linesWithoutInvoice: [{ position, vendor, lineDate }] }`. El helper `linesWithoutInvoice` vive en `apps/api/src/common/invoice-lines.ts` y tarjetas lo re-exporta.

**Frontend.** Botón "Enviar para autorización" deshabilitado, con mensaje "N de M líneas sin adjunto (#…)", en el formulario (alta y edición) y en el detalle. Mensaje compartido: `components/missing-attachment.ts`.

**Alcance.** Los reportes enviados o procesados no se tocan; un borrador sin adjuntos queda bloqueado hasta adjuntar. Sin migración.

**Criterios.** (1) Con líneas sin adjunto no se envía: botón y API lo impiden listando las líneas. (2) Con todas adjuntas se envía igual que antes. (3) Adjunto sin key no cuenta. (4) Imagen y documento cuentan igual. (5) Reportes enviados/procesados no cambian. (6) Tarjetas igual. (7) `tsc`, pruebas y build pasan.

**Archivos.** `common/invoice-lines.ts`, `expenses.service.ts` (+ spec), `credit-cards.service.ts` (re-export), `components/missing-attachment.ts`, `expense-report-form.tsx`, `expense-report-detail.tsx`.

## 9. Actualización: "Información" ya no es columna

Se eliminó la columna "Información" de formulario y detalle. El encabezado de Tipo de Gasto lleva ahora una "i" con un panel (portal, posición fija) que lista los cuatro tipos con el formato "**Nombre** - texto". Textos en `components/expense-type-info.tsx`, única fuente. En alta y edición se quitaron las "i" de los encabezados de la tabla (Proveedor, Subtotal, Extras y Factura); se conservan las de los campos del formulario (Autorizador y Motivo). El Excel nunca llevó Información.
