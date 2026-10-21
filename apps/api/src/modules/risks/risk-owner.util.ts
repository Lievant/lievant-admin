import type { NotificationType } from '../notifications/entities/notification.entity';
import { RiskLevel } from './risk-calculation';

export const OWNER_SEARCH_MIN_CHARS = 2;
export const OWNER_SEARCH_MAX_RESULTS = 10;
const MAX_SEARCH_WORDS = 5;

/** Letras con acento que se igualan a su base en la búsqueda (SQL y servicio usan las mismas). */
export const ACCENTED = 'áàäâãéèëêíìïîóòöôõúùüûñç';
export const UNACCENTED = 'aaaaaeeeeiiiiooooouuuunc';

/**
 * Palabras de búsqueda sin mayúsculas ni acentos ("Vázquez" → "vazquez") y con
 * los comodines de LIKE escapados. Menos de 2 caracteres en total → sin búsqueda.
 */
export function normalizeSearchWords(query: string | undefined): string[] {
  const text = (query ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
  if (text.length < OWNER_SEARCH_MIN_CHARS) return [];
  return text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_SEARCH_WORDS)
    .map((word) => word.replace(/[\\%_]/g, (c) => `\\${c}`));
}

const LEVEL_TEXT: Record<RiskLevel, string> = { verde: 'Verde', amarillo: 'Amarillo', rojo: 'Rojo' };

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export interface OwnerNotificationInput {
  actorName: string;
  risk: string;
  residualRisk: number;
  level: RiskLevel;
  /** El destinatario puede abrir la Matriz (tiene `sgsi.riesgos.read`). */
  canOpenMatrix: boolean;
}

/** Contenido de la notificación al dueño; `atencion` si el residual es rojo. */
export function buildOwnerNotification(input: OwnerNotificationInput): {
  title: string;
  message: string;
  type: NotificationType;
  actionUrl: string | null;
} {
  return {
    title: 'Se te asignó un riesgo en la Matriz de Riesgos',
    message:
      `${input.actorName} te registró como dueño del riesgo: “${truncate(input.risk, 140)}”. ` +
      `Riesgo residual: ${input.residualRisk} (${LEVEL_TEXT[input.level]}).`,
    type: input.level === 'rojo' ? 'atencion' : 'informativa',
    // Sin permiso de lectura el enlace llevaría a "acceso denegado".
    actionUrl: input.canOpenMatrix ? '/sgsi/matriz-riesgos' : null,
  };
}
