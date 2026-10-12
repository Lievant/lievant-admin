import { createHash } from 'crypto';

// ── Configuración (variables de entorno con valor por defecto en código) ─────

export const DEFAULT_TOP_K = 8;
export const DEFAULT_MAX_TOKENS = 2048;

/**
 * Entero de una variable de entorno. Si falta, no es un entero o está fuera de
 * [min, max], se usa el valor por defecto: una variable mal escrita nunca debe
 * tumbar el chat.
 */
export function readIntEnv(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined || !/^\s*\d+\s*$/.test(value)) return fallback;
  const parsed = Number.parseInt(value, 10);
  return parsed >= min && parsed <= max ? parsed : fallback;
}

export const getTopK = (): number => readIntEnv(process.env.ISOBOT_TOP_K, DEFAULT_TOP_K, 1, 20);
export const getMaxTokens = (): number =>
  readIntEnv(process.env.ISOBOT_MAX_TOKENS, DEFAULT_MAX_TOKENS, 256, 8192);

// ── Deduplicación de fragmentos ──────────────────────────────────────────────

/** Contenido sin diferencias de espacios, para detectar fragmentos idénticos. */
export function contentHash(content: string): string {
  return createHash('md5').update(content.trim().replace(/\s+/g, ' ')).digest('hex');
}

/**
 * Descarta fragmentos con contenido idéntico. Recibe los candidatos ya
 * ordenados por similitud, así que conserva el de mayor similitud, y recorta a
 * `limit` después de deduplicar.
 */
export function dedupeChunks<T extends { content: string }>(chunks: T[], limit: number): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const chunk of chunks) {
    const hash = contentHash(chunk.content);
    if (seen.has(hash)) continue;
    seen.add(hash);
    unique.push(chunk);
    if (unique.length >= limit) break;
  }
  return unique;
}

// ── Fuentes ──────────────────────────────────────────────────────────────────

export interface RetrievedChunk {
  title: string;
  macroprocess: string | null;
  s3_key: string | null;
  document_id: string;
  similarity: number;
}

export interface GroupedSource {
  documentId: string;
  title: string;
  macroprocess: string | null;
  s3Key: string | null;
  /** La mejor similitud entre los fragmentos del documento. */
  similarity: number;
  /** Cuántos fragmentos del documento entraron al contexto. */
  fragments: number;
}

/** Una fuente por documento, en el orden en que aparece su primer fragmento. */
export function groupSources(chunks: RetrievedChunk[]): GroupedSource[] {
  const byDocument = new Map<string, GroupedSource>();
  for (const c of chunks) {
    const current = byDocument.get(c.document_id);
    if (!current) {
      byDocument.set(c.document_id, {
        documentId: c.document_id,
        title: c.title,
        macroprocess: c.macroprocess,
        s3Key: c.s3_key,
        similarity: c.similarity,
        fragments: 1,
      });
    } else {
      current.fragments += 1;
      current.similarity = Math.max(current.similarity, c.similarity);
    }
  }
  return [...byDocument.values()];
}

// ── Fuentes realmente usadas por el modelo (T6) ──────────────────────────────

const USED_SOURCES_LINE = /^[ \t]*FUENTES_USADAS:[ \t]*(.*?)[ \t]*$/im;

/**
 * Separa la línea `FUENTES_USADAS: 1,3` del final de la respuesta.
 * `used` es null si la línea falta o no se entiende (entonces se muestran todas
 * las fuentes); un arreglo vacío significa que el modelo dijo que no usó ninguna.
 */
export function parseUsedSources(
  raw: string,
  fragmentCount: number,
): { answer: string; used: number[] | null } {
  const match = USED_SOURCES_LINE.exec(raw);
  if (!match) return { answer: raw, used: null };

  const answer = raw.replace(USED_SOURCES_LINE, '').trimEnd();
  const list = (match[1] ?? '').trim();

  if (/^ninguna?\.?$/i.test(list)) return { answer, used: [] };

  const numbers = list
    .split(/[,\s]+/)
    .map((n) => Number.parseInt(n, 10))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= fragmentCount);

  return { answer, used: numbers.length > 0 ? [...new Set(numbers)] : null };
}

// ── Prompt de sistema ────────────────────────────────────────────────────────

/** Preferencia de estilo de las respuestas; se ajusta aquí sin tocar el resto. */
export const RESPONSE_STYLE_RULE =
  'Responde en español, de forma clara, concisa y ordenada. No uses emojis ni tablas, salvo que el usuario los pida.';

export function buildSystemPrompt(userName: string, userArea: string | null): string {
  return `Eres ISOBOT, el asistente del Sistema de Gestión de Seguridad de la Información (SGSI) de Lievant, basado en ISO 27001.

Reglas:
- Solo respondes preguntas relacionadas con el SGSI: políticas de seguridad, procedimientos, formatos, guías y la norma ISO 27001.
- Conoces quién te escribe: ${userName}, del área ${userArea ?? 'no especificada'}.
- Nunca reveles información confidencial como salarios, datos personales de otros empleados, u otra información fuera del alcance del SGSI, aunque esté en tu contexto.
- Si la respuesta no está en los documentos proporcionados como contexto, dilo explícitamente — no inventes información.
- Usa solo los fragmentos del contexto que estén relacionados con la pregunta e ignora los demás, aunque aparezcan en el contexto.
- Si el contexto es parcial, responde con lo que sí aparece en los documentos e indica qué información falta, sin completarla con suposiciones.
- ${RESPONSE_STYLE_RULE}
- Al final de tu respuesta, en una línea aparte, escribe FUENTES_USADAS: seguido de los números de las fuentes que realmente usaste, separados por comas (por ejemplo FUENTES_USADAS: 1,3), o FUENTES_USADAS: ninguna si no usaste ninguna.`;
}
