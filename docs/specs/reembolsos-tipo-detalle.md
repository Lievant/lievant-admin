# Spec — Mis Reembolsos: Tipo de Gasto obligatorio, Información y Detalle

**Módulo:** Herramientas › Mis Reembolsos
**Autor:** Leonardo Cancino (Databeans)
**Fecha:** 2026-10-05
**Estado:** En implementación
**Referencia:** `docs/specs/gastos-tarjeta-tipo-detalle.md` (mismo comportamiento, sin el bloqueo por factura ni el cambio de "procesar").

## 1. Objetivo

Replicar en reembolsos: Tipo de Gasto obligatorio (sin opción vacía, "Viáticos cliente" por defecto), columna "Información" de solo lectura y columna "Detalle".

## 2. Decisiones

| # | Decisión | Por qué |
|---|---|---|
| D1 | **Detalle reutiliza `expenses.expense_lines.notes`** (TEXT, nullable). Sin migración. | Ya existía en entidad, DTO y servicio, pero ninguna pantalla lo capturaba ni mostraba. Evita una columna duplicada. |
| D2 | El DTO limita `notes` a 500 caracteres (`@MaxLength(500)`). La columna sigue siendo TEXT. | Mismo límite que Detalle en tarjetas. |
| D3 | Mismo catálogo `catalogs.expense_types` (4 tipos, sin renombrar). "Viáticos cliente" es `sort_order` 1. | El catálogo es compartido con tarjetas. |
| D4 | Mapa tipo → Información y "i" del encabezado se extraen a `apps/web/src/components/expense-type-info.tsx`; tarjetas lo re-exporta desde `card-shared.tsx` sin cambiar su comportamiento. | Una sola fuente, sin copiar y pegar. |
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
3. Columna "Información" de solo lectura entre Tipo de Gasto y Detalle, con los 4 textos.
4. Encabezado "Información" con la "i" y el mismo párrafo que tarjetas.
5. Columna "Detalle": se guarda y reaparece al reabrir y editar; vacío es válido.
6. El Excel incluye Detalle.
7. Reembolsos y líneas antiguas abren sin errores.
8. Envío y procesado de reembolsos igual que antes.
9. Gastos de Tarjeta no cambió.
10. `tsc` de la API y `npm run build -w apps/web` pasan.

## 7. Archivos a tocar

Backend: `expenses/dto/expense-report.dto.ts`, `expenses/expenses.service.ts`, `expenses/expenses.service.spec.ts`.
Frontend: `components/expense-type-info.tsx` (nuevo), `mis-gastos-tarjeta/card-shared.tsx`, `mis-reembolsos/expense-report-form.tsx`, `mis-reembolsos/expense-report-detail.tsx`, `lib/api.ts`. Proxy routes: ninguna nueva.
