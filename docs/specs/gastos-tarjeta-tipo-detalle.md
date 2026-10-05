# Spec — Gastos de Tarjeta: Tipo de Gasto obligatorio, Detalle y bloqueo de envío

**Módulo:** Herramientas › Mis Gastos de Tarjeta
**Autor:** Leonardo Cancino (Databeans)
**Fecha:** 2026-10-04
**Estado:** En implementación

## 1. Objetivo

Que cada línea de un reporte de tarjeta lleve siempre un Tipo de Gasto, tenga un campo libre "Detalle", y que no se pueda enviar a Finanzas un reporte con líneas sin factura.

## 2. Decisiones

| # | Decisión | Por qué |
|---|---|---|
| D1 | Se **mantiene el catálogo** `catalogs.expense_types`: Viáticos cliente, Costo operativo, Costo de Marketing, Costo de venta / temas comerciales. No se renombra. | El catálogo es compartido con Mis Reembolsos (fuera de alcance). Los nombres difieren de los del requerimiento; el texto de la "i" usa los nombres reales. |
| D2 | "Viáticos cliente" es el primero por `sort_order = 1` y queda preseleccionado. | Verificado en la migración `1751000000010`. |
| D3 | `detail` es opcional (nullable), `VARCHAR(500)`. | No se pidió obligatorio. |
| D4 | Sin constraint NOT NULL en BD para `expense_type_id`. La obligatoriedad vive en DTO + servicio. | Hay líneas históricas con tipo vacío; no se hace backfill ni se rompe su lectura. |
| D5 | Línea con factura = `has_invoice = true` **y** `invoice_s3_key` no nulo. | La factura se guarda por línea en `card_expense_lines`; no hay otros tipos de adjunto. |
| D6 | Una línea histórica sin tipo se abre en edición con "Viáticos cliente" preseleccionado (no hay opción vacía); al guardar queda asignado. | Consecuencia directa de R1. |
| D7 | No se implementa enrutamiento por tipo. `submitReport` y `notifySubmitted` no dependen del tipo de gasto. | Verificado en `credit-cards.service.ts`. |

## 3. Modelo

`expenses.card_expense_lines` + `detail VARCHAR(500) NULL`. Migración `1751000000031-AddCardExpenseLineDetail`, aditiva (`ADD COLUMN IF NOT EXISTS`), `down()` con `DROP COLUMN IF EXISTS`.

## 4. Reglas de negocio

- RN-1: crear/editar reporte exige `expenseTypeId` en cada línea, existente y activo en el catálogo.
- RN-2: `detail` se guarda tal cual (trim; vacío → null) y se devuelve en todas las respuestas.
- RN-3: `POST /credit-cards/reports/:id/submit` rechaza (400) si alguna línea no tiene factura; el error lista las líneas faltantes.
- RN-4: el Excel del reporte incluye la columna DETALLE junto a TIPO DE GASTO.

## 5. Contrato de API

- `CardExpenseLineDto`: `expenseTypeId` (UUID, **requerido**), `detail?` (string, máx. 500).
- Respuesta de línea: añade `detail: string | null`.
- Error de envío (400): `{ message, linesWithoutInvoice: [{ position, vendor, lineDate }] }`.

## 6. Criterios de aceptación

1. Nuevo reporte: Tipo de Gasto sin opción vacía, arranca en "Viáticos cliente".
2. API sin Tipo de Gasto o con uno inexistente → rechazado.
3. Columna "Detalle" a la derecha de Tipo de Gasto; se guarda y reaparece al reabrir y editar.
4. Detalle vacío es válido.
5. Ícono "i" tras "Detalle" con el mismo estilo que el de Factura y el texto informativo.
6. Reporte con líneas sin factura: botón deshabilitado con mensaje y API con error que lista las líneas.
7. Reporte con todas las facturas se envía igual que antes.
8. Reportes antiguos abren sin errores.
9. Excel incluye Detalle.
10. `tsc` de la API y `npm run build -w apps/web` pasan.

## 7. Archivos a tocar

Backend: migración `1751000000031`, `card-expense-line.entity.ts`, `dto/credit-cards.dto.ts`, `credit-cards.service.ts` (+ spec).
Frontend: `lib/api.ts` (tipos), `mis-gastos-tarjeta/nuevo/card-expense-form.tsx`, `card-report-detail.tsx`, `card-shared.tsx` (si aloja la "i"). Proxy routes: ninguna nueva (se reutilizan `api/credit-cards/reports/...`).
