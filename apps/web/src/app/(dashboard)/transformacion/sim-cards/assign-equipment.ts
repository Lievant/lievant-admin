/** Equipo tal como lo maneja el modal de asignar línea. */
export interface EquipmentChoice {
  id: string;
  displayId: string;
  label: string;
}

/** Fila del endpoint /inventory/equipment/search. */
export interface EquipmentSearchRow {
  id: string;
  displayId: string;
  brand: string | null;
  model: string | null;
  type: string;
}

export function toEquipmentChoice(row: EquipmentSearchRow): EquipmentChoice {
  return {
    id: row.id,
    displayId: row.displayId,
    label: [row.brand, row.model].filter(Boolean).join(' ') || row.type,
  };
}

/** Equipos asignados a una persona: el endpoint de búsqueda ya filtra por `assignedTo`. */
export function ownedEquipmentPath(employeeId: string): string {
  return `/api/inventory/equipment/search?assignedTo=${encodeURIComponent(employeeId)}`;
}

/**
 * Qué equipo queda seleccionado tras elegir a una persona (o dejar de elegirla).
 *
 * - `owned` null = no hay persona: el campo vuelve a su estado de siempre y
 *   queda el equipo que la línea ya traía (`original`), si lo había.
 * - Con persona, solo valen sus equipos: el seleccionado se conserva si es
 *   suyo; si no, se limpia con un aviso. Si no había selección y la línea ya
 *   traía un equipo que sí es de esa persona, se vuelve a seleccionar.
 *
 * Es solo guía de la pantalla: el API sigue aceptando personas y equipos que no
 * coincidan (con `warnings`), porque se pueden asignar por otros caminos.
 */
export function resolveEquipmentForEmployee(args: {
  selected: EquipmentChoice | null;
  original: EquipmentChoice | null;
  owned: EquipmentChoice[] | null;
}): { equipment: EquipmentChoice | null; notice: string | null } {
  const { selected, original, owned } = args;
  if (owned === null) return { equipment: original, notice: null };

  const isOwned = (e: EquipmentChoice) => owned.some((o) => o.id === e.id);
  if (selected) {
    if (isOwned(selected)) return { equipment: selected, notice: null };
    return {
      equipment: null,
      notice: `Se quitó el equipo ${selected.displayId} porque no está asignado a esta persona.`,
    };
  }
  if (original && isOwned(original)) return { equipment: original, notice: null };
  return { equipment: null, notice: null };
}

/**
 * ¿Hay que soltar primero el equipo que la línea ya traía? Pasa cuando la
 * persona cambió y el equipo original se limpió: `assign` conserva lo que no se
 * manda, así que sin esto la línea seguiría ligada a un equipo ajeno.
 */
export function mustReleaseOriginalEquipment(args: {
  original: EquipmentChoice | null;
  selected: EquipmentChoice | null;
}): boolean {
  return args.original !== null && args.selected === null;
}
