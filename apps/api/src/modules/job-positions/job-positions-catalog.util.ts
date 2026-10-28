/**
 * Listas cerradas de la Matriz de Puestos (sin base de datos): normalización de Nivel, Categoría y Área,
 * y comparación de áreas contra el catálogo. Se prueba aparte.
 */

export const SENIORITIES = ['junior', 'semi_senior', 'senior'] as const;
export type Seniority = (typeof SENIORITIES)[number];

export const SENIORITY_LABELS: Record<Seniority, string> = {
  junior: 'Junior',
  semi_senior: 'Semi Senior',
  senior: 'Senior',
};

/** Sin acentos, en minúsculas y con espacios simples. */
export function normText(text: string | null | undefined): string {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Clave para comparar áreas: sin mayúsculas, acentos, espacios sobrantes ni puntuación («Marketplace » = «marketplace»). */
export function areaKey(name: string | null | undefined): string {
  return normText(name).replace(/[^a-z0-9]+/g, ' ').trim();
}

// ── Nivel ────────────────────────────────────────────────────────────────────

const ROMAN_TOKENS: [number, string][] = [
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

/** 4 → 'IV' (solo hasta 19; los niveles de puesto no pasan de ahí). */
export function arabicToRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 19) return '';
  let rest = n;
  let out = '';
  for (const [value, symbol] of ROMAN_TOKENS) {
    while (rest >= value) {
      out += symbol;
      rest -= value;
    }
  }
  return out;
}

export type LevelResolution =
  | { kind: 'ok'; code: string }
  /** Celda vacía. */
  | { kind: 'empty' }
  /** «Sin nivel», «Por definir», rangos («V / VI») o texto con aclaraciones: queda vacío con aviso. */
  | { kind: 'ambiguous' }
  /** Un valor concreto que no está en el catálogo: error bloqueante. */
  | { kind: 'invalid' };

/**
 * Nivel del Excel → código del catálogo. «iv», « IV » y «4» son IV. Los ambiguos no bloquean (quedan vacíos,
 * con el texto original aparte); un valor concreto fuera del catálogo sí bloquea.
 */
export function resolveLevel(raw: string | null | undefined, catalogCodes: readonly string[]): LevelResolution {
  const text = (raw ?? '').trim();
  if (text === '') return { kind: 'empty' };
  const n = normText(text);
  if (n.startsWith('sin nivel') || n.startsWith('por definir') || n.includes('/') || /\(|\)/.test(n)) return { kind: 'ambiguous' };
  const compact = n.replace(/\s+/g, '').toUpperCase();
  const candidate = /^\d+$/.test(compact) ? arabicToRoman(Number(compact)) : compact;
  const hit = catalogCodes.find((c) => c.toUpperCase() === candidate);
  return hit ? { kind: 'ok', code: hit } : { kind: 'invalid' };
}

/** Código canónico del catálogo para un valor ya escrito (sin interpretar rangos ni vacíos): null si no está. */
export function canonicalLevel(value: string | null | undefined, catalogCodes: readonly string[]): string | null {
  const r = resolveLevel(value, catalogCodes);
  return r.kind === 'ok' ? r.code : null;
}

// ── Categoría ────────────────────────────────────────────────────────────────

/** «semi-senior», «SEMI SENIOR» y «Semi Senior» son lo mismo. */
export function parseSeniority(value: string | null | undefined): Seniority | null {
  const n = normText(value).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
  if (n === 'junior') return 'junior';
  if (n === 'semi senior' || n === 'semisenior') return 'semi_senior';
  if (n === 'senior') return 'senior';
  return null;
}

/**
 * Categoría contenida en un texto más largo (la «Jerarquía (MEOT)» del Excel: «Especialista Semi Senior (MEOT)»).
 * «Semi Senior» se busca antes que «Senior» para no confundirlos.
 */
export function seniorityFromText(text: string | null | undefined): Seniority | null {
  const n = ` ${normText(text).replace(/[-_]+/g, ' ')} `;
  if (/ semi ?senior /.test(n)) return 'semi_senior';
  if (/ senior /.test(n)) return 'senior';
  if (/ junior /.test(n)) return 'junior';
  return null;
}

// ── Área ─────────────────────────────────────────────────────────────────────

export interface CatalogArea {
  id?: string;
  name: string;
  divisionName: string | null;
}

/** Distancia de edición (para detectar áreas «casi iguales»: una letra de diferencia). */
export function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length]![b.length]!;
}

const sameDivision = (a: string | null, b: string | null): boolean => areaKey(a) === areaKey(b);

/** Área del catálogo de esa división con el mismo nombre (sin mayúsculas, acentos ni espacios extra). */
export function findAreaExact(areas: readonly CatalogArea[], division: string | null, name: string): CatalogArea | null {
  const key = areaKey(name);
  if (key === '') return null;
  return areas.find((a) => sameDivision(a.divisionName, division) && areaKey(a.name) === key) ?? null;
}

/** Área «casi igual»: una letra de diferencia o la misma con otro orden de signos; nunca la idéntica. */
export function findAreaNear(areas: readonly CatalogArea[], division: string | null, name: string): CatalogArea | null {
  const key = areaKey(name);
  if (key.length < 5) return null;
  return (
    areas.find((a) => {
      if (!sameDivision(a.divisionName, division)) return false;
      const other = areaKey(a.name);
      return other !== key && editDistance(key, other) <= 1;
    }) ?? null
  );
}

/** Pares de áreas casi duplicadas dentro de una misma división (para la consulta de revisión y pruebas). */
export function nearDuplicateAreas(areas: readonly CatalogArea[]): [CatalogArea, CatalogArea][] {
  const out: [CatalogArea, CatalogArea][] = [];
  for (let i = 0; i < areas.length; i++) {
    for (let j = i + 1; j < areas.length; j++) {
      const a = areas[i]!;
      const b = areas[j]!;
      if (!sameDivision(a.divisionName, b.divisionName)) continue;
      const ka = areaKey(a.name);
      const kb = areaKey(b.name);
      if (ka === kb || (Math.min(ka.length, kb.length) >= 5 && editDistance(ka, kb) <= 1)) out.push([a, b]);
    }
  }
  return out;
}
