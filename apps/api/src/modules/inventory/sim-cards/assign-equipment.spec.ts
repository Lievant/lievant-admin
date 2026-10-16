import {
  mustReleaseOriginalEquipment,
  ownedEquipmentPath,
  resolveEquipmentForEmployee,
  toEquipmentChoice,
  type EquipmentChoice,
} from '../../../../../web/src/app/(dashboard)/transformacion/sim-cards/assign-equipment';

// ── Ajuste D: equipo del modal según el empleado ────────────────────────────

const eq = (id: string, displayId = `TEC-${id}`): EquipmentChoice => ({ id, displayId, label: 'Marca Modelo' });

describe('Modal de asignar · equipo según el empleado', () => {
  it('pide solo los equipos de esa persona al endpoint existente', () => {
    expect(ownedEquipmentPath('abc-123')).toBe('/api/inventory/equipment/search?assignedTo=abc-123');
  });

  it('arma la etiqueta con marca y modelo, o con el tipo si faltan', () => {
    expect(toEquipmentChoice({ id: '1', displayId: 'TEC-1', brand: 'Apple', model: 'MacBook', type: 'Laptop' }).label).toBe('Apple MacBook');
    expect(toEquipmentChoice({ id: '1', displayId: 'TEC-1', brand: null, model: null, type: 'Laptop' }).label).toBe('Laptop');
  });

  it('al elegir otra persona, el equipo seleccionado que no es suyo se limpia con aviso', () => {
    const r = resolveEquipmentForEmployee({ selected: eq('A'), original: null, owned: [eq('B')] });
    expect(r.equipment).toBeNull();
    expect(r.notice).toContain('TEC-A');
  });

  it('si el equipo seleccionado sí es de la persona, se conserva sin aviso', () => {
    const r = resolveEquipmentForEmployee({ selected: eq('B'), original: null, owned: [eq('B'), eq('C')] });
    expect(r).toEqual({ equipment: eq('B'), notice: null });
  });

  it('una persona sin equipos deja el campo vacío', () => {
    const r = resolveEquipmentForEmployee({ selected: null, original: null, owned: [] });
    expect(r).toEqual({ equipment: null, notice: null });
  });

  it('reasignar una línea con equipo a quien no es su titular limpia el equipo y avisa', () => {
    const original = eq('ORIG');
    const r = resolveEquipmentForEmployee({ selected: original, original, owned: [eq('X')] });
    expect(r.equipment).toBeNull();
    expect(r.notice).not.toBeNull();
  });

  it('si la nueva persona sí es la titular del equipo original, se vuelve a seleccionar', () => {
    const original = eq('ORIG');
    const r = resolveEquipmentForEmployee({ selected: null, original, owned: [original, eq('X')] });
    expect(r).toEqual({ equipment: original, notice: null });
  });

  it('sin persona elegida el campo vuelve a su estado de siempre (el equipo que ya traía la línea)', () => {
    expect(resolveEquipmentForEmployee({ selected: eq('B'), original: eq('ORIG'), owned: null }).equipment).toEqual(eq('ORIG'));
    expect(resolveEquipmentForEmployee({ selected: eq('B'), original: null, owned: null }).equipment).toBeNull();
  });

  it('el equipo original se suelta solo si la línea lo traía y ya no hay uno elegido', () => {
    expect(mustReleaseOriginalEquipment({ original: eq('O'), selected: null })).toBe(true);
    expect(mustReleaseOriginalEquipment({ original: eq('O'), selected: eq('O') })).toBe(false);
    expect(mustReleaseOriginalEquipment({ original: null, selected: null })).toBe(false);
  });
});
