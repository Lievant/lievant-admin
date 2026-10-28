import {
  OTHER_POSITION,
  countryLabel,
  formatDateTimeMx,
  formatDay,
  modalityLabel,
  priorityLabel,
  toFormValues,
  toPayload,
  todayMx,
  typeLabel,
  validateForSubmit,
  type FormValues,
  type RequisitionDetail,
} from '../../../../web/src/app/(dashboard)/rrhh/solicitudes-puesto/requisitions-constants';

const ok: FormValues = {
  type: 'nueva_posicion', positionChoice: OTHER_POSITION, positionTitle: 'Analista', area: 'TI', reason: 'r',
  businessJustification: 'j', requiredDate: '2099-01-01', modality: 'hibrido', country: 'mexico', basicProfile: 'p', priority: 'alta',
};

describe('Solicitud de Puesto (web) · validación del formulario', () => {
  it('completo es válido', () => expect(validateForSubmit(ok, '2026-10-26')).toBeNull());
  it.each([
    [{ type: '' }, /tipo/],
    [{ positionChoice: '' }, /puesto/],
    [{ positionTitle: ' ' }, /nombre del puesto nuevo/],
    [{ area: '' }, /área/],
    [{ reason: '' }, /motivo/],
    [{ businessJustification: '' }, /justificación/],
    [{ requiredDate: '' }, /fecha requerida es obligatoria/],
    [{ requiredDate: '2020-01-01' }, /anterior a hoy/],
    [{ modality: '' }, /modalidad/],
    [{ country: '' }, /país/],
    [{ basicProfile: '' }, /perfil/],
    [{ priority: '' }, /prioridad/],
  ])('rechaza %j', (patch, re) => {
    expect(validateForSubmit({ ...ok, ...patch }, '2026-10-26')).toMatch(re as RegExp);
  });
  it('con puesto de la Matriz no hace falta el texto libre', () => {
    expect(validateForSubmit({ ...ok, positionChoice: 'abc', positionTitle: '' }, '2026-10-26')).toBeNull();
  });
  it('hoy es válido', () => expect(validateForSubmit({ ...ok, requiredDate: '2026-10-26' }, '2026-10-26')).toBeNull());
});

describe('Solicitud de Puesto (web) · cuerpo y valores', () => {
  it('con puesto de la Matriz el texto libre no se envía', () => {
    const p = toPayload({ ...ok, positionChoice: 'pos-1', positionTitle: 'Ignorado' });
    expect(p.jobPositionId).toBe('pos-1');
    expect(p.positionTitle).toBeNull();
  });
  it('con "Otro (Puesto Nuevo)" va el texto libre y no hay puesto de la Matriz', () => {
    const p = toPayload(ok);
    expect(p.jobPositionId).toBeNull();
    expect(p.positionTitle).toBe('Analista');
  });
  it('un borrador vacío manda nulos, no cadenas vacías', () => {
    const p = toPayload({ ...ok, reason: '', requiredDate: '', modality: '' });
    expect(p.reason).toBeNull();
    expect(p.requiredDate).toBeNull();
    expect(p.modality).toBeNull();
  });
  it('valores iniciales: nuevo con el área del líder; borrador con su puesto (Matriz o texto libre)', () => {
    expect(toFormValues(null, 'Ventas')).toMatchObject({ type: 'nueva_posicion', area: 'Ventas', positionChoice: '' });
    const base = { type: 'reemplazo', area: 'TI', reason: null, businessJustification: null, requiredDate: null, modality: null, country: null, basicProfile: null, priority: null } as unknown as RequisitionDetail;
    expect(toFormValues({ ...base, jobPositionId: 'p1', positionTitle: null }, '').positionChoice).toBe('p1');
    expect(toFormValues({ ...base, jobPositionId: null, positionTitle: 'Libre' }, '').positionChoice).toBe(OTHER_POSITION);
  });
});

describe('Solicitud de Puesto (web) · formato', () => {
  it('etiquetas', () => {
    expect(typeLabel('nueva_posicion')).toBe('Nueva Posición');
    expect(modalityLabel('hibrido')).toBe('Híbrido');
    expect(countryLabel('eeuu')).toBe('EE.UU.');
    expect(priorityLabel('media')).toBe('Media');
    expect(typeLabel(null)).toBe('—');
  });
  it('fechas en hora de México', () => {
    expect(formatDay('2026-10-26')).toBe('26/10/2026');
    expect(formatDateTimeMx('2026-10-26T18:03:00Z')).toBe('26/10/2026 12:03');
    expect(todayMx(new Date('2026-10-27T03:00:00Z'))).toBe('2026-10-26');
  });
});
