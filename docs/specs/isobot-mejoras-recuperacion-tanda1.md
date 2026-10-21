# Spec — ISOBOT: Tanda 1 de mejoras de recuperación y respuesta

**Módulo:** Herramientas › ISOBOT (chat)
**Autor:** Leonardo Cancino (Databeans)
**Fecha:** 2026-10-12
**Estado:** En implementación
**Origen:** diagnóstico de solo lectura de `isobot.service.ts` (top-k fijo en 5, sin umbral, duplicados, prompt sin instrucción de relevancia, `max_tokens` 1024, una fuente por fragmento).

## 1. Objetivo

Que ISOBOT traiga más fragmentos útiles sin repetidos, responda sin cortarse y muestre las fuentes por documento.

## 2. Decisiones

| # | Decisión | Por qué |
|---|---|---|
| D1 | Prompt de sistema en `buildSystemPrompt()` (`isobot-retrieval.util.ts`); conserva todas las reglas previas y agrega relevancia, contexto parcial y estilo. El estilo vive en la constante `RESPONSE_STYLE_RULE`. | Fácil de ajustar sin tocar el flujo. |
| D2 | `ISOBOT_MAX_TOKENS` (256-8192, por defecto 2048) y `ISOBOT_TOP_K` (1-20, por defecto 8), leídas con `process.env` como el resto del módulo; valor inválido o ausente → por defecto. | No hace falta tocar infraestructura. |
| D3 | `search()` pide `2k` candidatos, deduplica por `md5` del contenido normalizado (trim y espacios colapsados) conservando el de mayor similitud, y recorta a `k`. Un `limit` explícito gana sobre la variable. `WHERE d.is_active` y `<=>` no cambian. | Los duplicados no ocupan lugares del contexto. |
| D4 | `sources` pasa a una entrada por documento, con la mejor `similarity` y `fragments`. | Un chip por documento. |
| D5 | T6 implementado: la llamada al modelo no es streaming, así que se le pide terminar con `FUENTES_USADAS: 1,3`; la línea se quita de la respuesta y las fuentes se filtran a esas. Línea ausente o no interpretable → todas las fuentes; `ninguna` → sin fuentes. | Seguro: el fallback es el comportamiento anterior. |
| D6 | Si `stop_reason = 'max_tokens'` se deja un `logger.warn`; el usuario no ve cambios. | Diagnóstico. |

## 3. Contrato de `sources`

Antes (una entrada por fragmento): `{ documentId, title, macroprocess, s3Key, similarity }`.
Después (una por documento): `{ documentId, title, macroprocess, s3Key, similarity /* mejor */, fragments }`.

Los mensajes guardados antes no tienen `fragments`: el frontend agrupa por `documentId` al renderizar (cada entrada vieja cuenta como 1 fragmento).

## 4. Criterios de aceptación

1. El prompt incluye relevancia, contexto parcial y respuesta concisa, y conserva alcance SGSI, no inventar y confidencialidad.
2. `max_tokens` 2048 por defecto y configurable; `warn` si se corta.
3. Top-k 8 por defecto y configurable; sin variables no hay error.
4. Dos documentos con contenido idéntico no ocupan dos lugares del contexto.
5. `sources` por documento con `fragments` y mejor `similarity`; el frontend muestra un chip por documento con tooltip y tolera mensajes antiguos.
6. Ingesta, embeddings, índices, permisos y migraciones sin cambios.
7. `tsc`, pruebas y build pasan.

## 5. Archivos a tocar

`isobot/isobot-retrieval.util.ts` (nuevo), `isobot/isobot.service.ts`, `isobot/entities/message.entity.ts`, specs correspondientes, `.env.example`, `herramientas/isobot/isobot-screen.tsx`.

## 6. Fuera de esta tanda

- **Tanda 2:** umbral de similitud, calibrado con datos reales de staging (10-15 preguntas).
- **Tanda 3:** enviar el historial de la conversación al modelo.
- Hash de documento al subir, búsqueda híbrida, `ivfflat` (`lists`, `probes`).
