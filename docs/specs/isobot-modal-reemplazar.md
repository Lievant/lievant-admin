# Spec — ISOBOT: el modal de "Reemplazar documento" igual al de "Subir documento"

**Módulo:** SGSI › ISOBOT (`/sgsi/isobot`)
**Autor:** Leonardo Cancino (Databeans)
**Fecha:** 2026-10-09
**Estado:** En implementación

## 1. Objetivo

Que Reemplazar abra el mismo modal que Subir (mismo diseño y campos: archivo, título, macroproceso y categoría), con el título "Reemplazar documento" y el botón "Reemplazar", con los campos prellenados con los datos actuales y editables.

## 2. Decisiones

| # | Decisión | Por qué |
|---|---|---|
| D1 | "Nombre" es **`title`** (el campo "Título" del modal de subir). `file_name` no se edita. | `file_name` es `UNIQUE` y es la clave del upsert de Subir; el nombre del archivo ya sale del archivo mismo. Editar `title` no toca la restricción, ni el `s3_key`, ni el upsert. |
| D2 | Un solo componente `DocumentModal` con `modo: 'subir' \| 'reemplazar'`; no se copia el markup. | R1. Cambian título, botón, mensaje de reindexación y valores iniciales. |
| D3 | Título, macroproceso y categoría vacíos o ausentes **conservan** el valor actual; con valor, lo reemplazan. | Como pidió el requerimiento. Consecuencia: en un reemplazo no se puede dejar un campo en blanco. |
| D4 | Las opciones de macroproceso son las mismas del modal de subir (`/api/isobot/admin/macroprocesses`); categoría es texto libre. | Mismo origen que Subir. |
| D5 | No cambia la extracción, la fragmentación, los embeddings, la búsqueda, el chat, la transaccionalidad ni el borrado de S3. | Fuera de alcance. |

## 3. Contrato de API

`PUT /isobot/admin/documents/:id/register` (permiso `sgsi.isobot.write`, sin cambios): el DTO ya aceptaba `title`, `macroprocess` y `category` opcionales; ahora el servicio los usa. Sin migración ni columnas nuevas.

El `UPDATE` de la rama de reemplazo de `indexar()` agrega `title`, `macroprocess` y `category` con `COALESCE(nuevo, actual)`.

## 4. Criterios de aceptación

1. Reemplazar abre un modal con el mismo diseño y campos que Subir, titulado "Reemplazar documento", con botón "Reemplazar".
2. Título, macroproceso y categoría aparecen prellenados; el archivo es obligatorio (.pdf, .docx, .xlsx, 20 MB).
3. Tras reemplazar, los cambios quedan guardados y se ven en la lista.
4. Si solo cambia el archivo, los metadatos se conservan.
5. El modal de Subir sigue titulado "Subir documento" y se comporta igual.
6. Reindexación, mensajes de error y permisos no cambian.
7. `tsc`, pruebas y build pasan.

## 5. Archivos a tocar

Backend: `isobot/isobot-ingestion.service.ts` (+ `isobot-ingestion.service.spec.ts`).
Frontend: `sgsi/isobot/isobot-admin-screen.tsx`. Proxy routes: ninguna nueva (se reutiliza `api/isobot/admin/documents/[id]/register`).
