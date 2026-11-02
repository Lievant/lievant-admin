export interface MultiSelectOption {
  id: string;
  label: string;
  /** Ya no se puede elegir (inactiva): solo aparece si ya estaba elegida y se marca como inactiva. */
  inactive?: boolean;
}

/** Sin mayúsculas ni acentos, para buscar «comunicacion» y encontrar «Comunicación». */
export const searchKey = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Opciones que se pueden elegir y coinciden con lo escrito; las ya elegidas y las inactivas no salen en la lista. */
export function filterOptions(options: MultiSelectOption[], selected: string[], query: string): MultiSelectOption[] {
  const q = searchKey(query);
  const taken = new Set(selected);
  return options.filter((o) => !o.inactive && !taken.has(o.id) && (q === '' || searchKey(o.label).includes(q)));
}

/** Las elegidas en el orden de las opciones (el del catálogo); las que ya no están en las opciones, al final. */
export function selectedInOrder(options: MultiSelectOption[], selected: string[]): MultiSelectOption[] {
  const byId = new Map(options.map((o) => [o.id, o]));
  const known = options.filter((o) => selected.includes(o.id));
  const unknown = selected.filter((id) => !byId.has(id)).map((id) => ({ id, label: id, inactive: true }));
  return [...known, ...unknown];
}
