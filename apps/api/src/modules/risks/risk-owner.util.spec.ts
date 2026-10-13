import { buildOwnerNotification, normalizeSearchWords } from './risk-owner.util';

describe('normalizeSearchWords', () => {
  it('quita acentos y mayúsculas', () => {
    expect(normalizeSearchWords('Claudia Vázquez')).toEqual(['claudia', 'vazquez']);
    expect(normalizeSearchWords('ÓSCAR  Alcalá')).toEqual(['oscar', 'alcala']);
    expect(normalizeSearchWords('Muñoz')).toEqual(['munoz']);
  });

  it('menos de 2 caracteres no busca', () => {
    expect(normalizeSearchWords('a')).toEqual([]);
    expect(normalizeSearchWords(' ')).toEqual([]);
    expect(normalizeSearchWords(undefined)).toEqual([]);
  });

  it('acepta exactamente 2 caracteres', () => {
    expect(normalizeSearchWords('pa')).toEqual(['pa']);
  });

  it('escapa los comodines de LIKE', () => {
    expect(normalizeSearchWords('a%b_c')).toEqual([String.raw`a\%b\_c`]);
  });

  it('limita a 5 palabras', () => {
    expect(normalizeSearchWords('a1 b2 c3 d4 e5 f6 g7')).toHaveLength(5);
  });
});

describe('buildOwnerNotification', () => {
  const base = { actorName: 'Leonardo', risk: 'Acceso a información de clientes', residualRisk: 14.4, level: 'verde' as const };

  it('informativa con residual verde o amarillo', () => {
    expect(buildOwnerNotification({ ...base, canOpenMatrix: true }).type).toBe('informativa');
    expect(buildOwnerNotification({ ...base, level: 'amarillo', canOpenMatrix: true }).type).toBe('informativa');
  });

  it('atencion con residual rojo', () => {
    expect(buildOwnerNotification({ ...base, residualRisk: 62.5, level: 'rojo', canOpenMatrix: true }).type).toBe('atencion');
  });

  it('el mensaje incluye quién lo registró, el riesgo, el residual y el semáforo', () => {
    const { message, title } = buildOwnerNotification({ ...base, canOpenMatrix: true });
    expect(title).toBe('Se te asignó un riesgo en la Matriz de Riesgos');
    expect(message).toContain('Leonardo');
    expect(message).toContain('Acceso a información de clientes');
    expect(message).toContain('14.4 (Verde)');
  });

  it('recorta un riesgo largo', () => {
    const { message } = buildOwnerNotification({ ...base, risk: 'x'.repeat(300), canOpenMatrix: true });
    expect(message).toContain('…');
    expect(message.length).toBeLessThan(260);
  });

  it('el enlace solo existe si puede abrir la matriz', () => {
    expect(buildOwnerNotification({ ...base, canOpenMatrix: true }).actionUrl).toBe('/sgsi/matriz-riesgos');
    expect(buildOwnerNotification({ ...base, canOpenMatrix: false }).actionUrl).toBeNull();
  });
});
