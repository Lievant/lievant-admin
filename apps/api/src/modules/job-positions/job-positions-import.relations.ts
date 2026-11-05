/**
 * Resolución de «Reporta a» y «Supervisa a» del Excel contra los puestos de la matriz (sin base de datos).
 *
 * Cada nombre se busca por TÍTULO normalizado (sin acentos, minúsculas y espacios simples) primero entre los puestos
 * del propio archivo y luego entre los puestos vivos de la MISMA división que no vienen en el archivo. Un título que
 * coincide con más de un puesto es ambiguo (error de esa fila). Los puestos se identifican con una `ref`: el id real
 * si ya existe, o `row:N` si lo crea este archivo.
 */
import { norm } from './job-positions-import.parser';

export { splitNames } from './job-positions-import.parser';

export interface RelEntity {
  ref: string;
  title: string;
  area: string;
}

export interface RelFileRow {
  row: number;
  title: string;
  area: string;
  /** id del puesto si ya existe (no se crea). */
  existingId: string | null;
  /** El archivo trae la columna «Reporta a» / «Supervisa a». */
  hasReportsTo: boolean;
  hasSupervises: boolean;
  reportsTo: string | null;
  supervises: string[];
  /** «Reporta a» actual (id) del puesto existente; null si es nuevo o no tiene. */
  currentReportsTo: string | null;
  /** «Supervisa a» actual (ids) del puesto existente. */
  currentSupervises: string[];
}

export interface RelIssue {
  row: number;
  message: string;
}

export interface RowRelations {
  /** Resolución de «Reporta a»: undefined = la columna no viene (no se toca); null = sin coincidencia (se quita). */
  reportsTo: { ref: string | null; title: string | null } | undefined;
  /** Resolución de «Supervisa a»: undefined = la columna no viene. */
  supervises: { refs: string[]; titles: string[]; unresolved: string[] } | undefined;
  /** Alguna relación cambia respecto de lo que hay en la base (o el puesto es nuevo y trae relaciones). */
  changed: boolean;
}

export interface RelationsResult {
  rows: Map<number, RowRelations>;
  errors: RelIssue[];
  warnings: RelIssue[];
}

type Lookup = { kind: 'found'; entity: RelEntity } | { kind: 'ambiguous'; areas: string[] } | { kind: 'none' };

function lookup(name: string, fileEntities: RelEntity[], existing: RelEntity[]): Lookup {
  const key = norm(name);
  for (const group of [fileEntities, existing]) {
    const hits = group.filter((e) => norm(e.title) === key);
    if (hits.length === 1) return { kind: 'found', entity: hits[0]! };
    if (hits.length > 1) return { kind: 'ambiguous', areas: [...new Set(hits.map((h) => h.area))] };
  }
  return { kind: 'none' };
}

const sameSet = (a: string[], b: string[]): boolean => a.length === b.length && a.every((x) => b.includes(x));

/**
 * @param fileRows   puestos del archivo (en orden)
 * @param others     puestos vivos de la misma división que NO vienen en el archivo (con su «Reporta a» actual)
 */
export function resolveImportRelations(fileRows: RelFileRow[], others: (RelEntity & { reportsTo: string | null })[]): RelationsResult {
  const refOf = (r: RelFileRow): string => r.existingId ?? `row:${r.row}`;
  const fileEntities: RelEntity[] = fileRows.map((r) => ({ ref: refOf(r), title: r.title, area: r.area }));
  const rows = new Map<number, RowRelations>();
  const errors: RelIssue[] = [];
  const warnings: RelIssue[] = [];
  const ambiguity = (name: string, areas: string[]): string => `el título «${name}» es ambiguo: existe en las áreas ${areas.join(' y ')}`;

  for (const r of fileRows) {
    const own = refOf(r);
    let reportsTo: RowRelations['reportsTo'];
    if (r.hasReportsTo) {
      const name = (r.reportsTo ?? '').trim();
      if (name === '') reportsTo = { ref: null, title: null };
      else {
        const hit = lookup(name, fileEntities, others);
        if (hit.kind === 'found') {
          if (hit.entity.ref === own) {
            errors.push({ row: r.row, message: `«Reporta a»: el puesto se reporta a sí mismo («${name}»)` });
            reportsTo = { ref: null, title: null };
          } else reportsTo = { ref: hit.entity.ref, title: hit.entity.title };
        } else if (hit.kind === 'ambiguous') {
          errors.push({ row: r.row, message: `«Reporta a»: ${ambiguity(name, hit.areas)}` });
          reportsTo = { ref: null, title: null };
        } else {
          warnings.push({ row: r.row, message: `«Reporta a» «${name}» no coincide con ningún puesto de la división: se guarda solo como texto, sin enlace` });
          reportsTo = { ref: null, title: null };
        }
      }
    }

    let supervises: RowRelations['supervises'];
    if (r.hasSupervises) {
      const refs: string[] = [];
      const titles: string[] = [];
      const unresolved: string[] = [];
      for (const name of r.supervises) {
        const hit = lookup(name, fileEntities, others);
        if (hit.kind === 'found') {
          if (hit.entity.ref === own) warnings.push({ row: r.row, message: `«Supervisa a»: «${name}» es el propio puesto; se ignora` });
          else if (!refs.includes(hit.entity.ref)) {
            refs.push(hit.entity.ref);
            titles.push(hit.entity.title);
          }
        } else if (hit.kind === 'ambiguous') {
          errors.push({ row: r.row, message: `«Supervisa a»: ${ambiguity(name, hit.areas)}` });
        } else {
          unresolved.push(name);
          warnings.push({ row: r.row, message: `«Supervisa a» «${name}» no coincide con ningún puesto de la división: no se enlaza (el texto original se conserva)` });
        }
      }
      supervises = { refs, titles, unresolved };
    }

    const reportsChanged = reportsTo !== undefined && (r.existingId === null ? reportsTo.ref !== null : (reportsTo.ref ?? null) !== (r.currentReportsTo ?? null));
    const supervisesChanged = supervises !== undefined && (r.existingId === null ? supervises.refs.length > 0 : !sameSet(supervises.refs, r.currentSupervises));
    rows.set(r.row, { reportsTo, supervises, changed: reportsChanged || supervisesChanged });
  }

  // Ciclos en «Reporta a»: se arma el mapa final de padres (lo del archivo manda; lo demás, lo que hay en la base).
  const parent = new Map<string, string | null>();
  for (const o of others) parent.set(o.ref, o.reportsTo);
  for (const r of fileRows) {
    const rel = rows.get(r.row)!;
    parent.set(refOf(r), rel.reportsTo !== undefined ? rel.reportsTo.ref : r.currentReportsTo);
  }
  const titleOf = new Map<string, string>([...others.map((o) => [o.ref, o.title] as const), ...fileEntities.map((e) => [e.ref, e.title] as const)]);
  const reported = new Set<number>();
  for (const r of fileRows) {
    const start = refOf(r);
    const path: string[] = [start];
    let cur = parent.get(start) ?? null;
    for (let depth = 0; cur && depth < 100; depth++) {
      if (cur === start) {
        const rowsInCycle = fileRows.filter((x) => path.includes(refOf(x))).map((x) => x.row);
        if (!reported.has(r.row)) {
          reported.add(r.row);
          errors.push({ row: r.row, message: `«Reporta a» forma un ciclo: ${[...path, start].map((p) => titleOf.get(p) ?? p).join(' → ')} (filas ${rowsInCycle.join(', ')})` });
        }
        break;
      }
      if (path.includes(cur)) break; // un ciclo ajeno a este puesto: lo reporta el puesto que sí está en él
      path.push(cur);
      cur = parent.get(cur) ?? null;
    }
  }
  return { rows, errors, warnings };
}
