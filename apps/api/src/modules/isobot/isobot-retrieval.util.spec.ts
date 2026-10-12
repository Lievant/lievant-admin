import {
  buildSystemPrompt,
  dedupeChunks,
  groupSources,
  parseUsedSources,
  readIntEnv,
} from './isobot-retrieval.util';

describe('readIntEnv (ISOBOT_TOP_K / ISOBOT_MAX_TOKENS)', () => {
  it('usa el valor válido', () => expect(readIntEnv('12', 8, 1, 20)).toBe(12));
  it('usa el valor por defecto si falta', () => expect(readIntEnv(undefined, 8, 1, 20)).toBe(8));
  it.each(['abc', '', '3.5', '-2', '8 fragmentos'])('usa el valor por defecto si no es entero (%p)', (v) =>
    expect(readIntEnv(v, 8, 1, 20)).toBe(8),
  );
  it.each(['0', '21', '9999'])('usa el valor por defecto si está fuera de rango (%p)', (v) =>
    expect(readIntEnv(v, 8, 1, 20)).toBe(8),
  );
  it('acepta los extremos del rango', () => {
    expect(readIntEnv('1', 8, 1, 20)).toBe(1);
    expect(readIntEnv('20', 8, 1, 20)).toBe(20);
    expect(readIntEnv('256', 2048, 256, 8192)).toBe(256);
    expect(readIntEnv('8192', 2048, 256, 8192)).toBe(8192);
  });
});

describe('dedupeChunks', () => {
  const chunk = (content: string, similarity: number, document_id = 'd') => ({
    content,
    similarity,
    document_id,
  });

  it('con el mismo contenido en distinto documento deja uno: el de mayor similitud', () => {
    // Los candidatos llegan ordenados por similitud descendente.
    const out = dedupeChunks(
      [chunk('Evaluación de lead', 0.9, 'a'), chunk('otro', 0.8, 'c'), chunk('Evaluación de lead', 0.7, 'b')],
      5,
    );
    expect(out.map((c) => [c.document_id, c.similarity])).toEqual([
      ['a', 0.9],
      ['c', 0.8],
    ]);
  });

  it('normaliza espacios y bordes al comparar', () => {
    const out = dedupeChunks([chunk('hola   mundo\n', 0.9), chunk('  hola mundo', 0.8)], 5);
    expect(out).toHaveLength(1);
  });

  it('recorta a k después de deduplicar', () => {
    const candidatos = [
      chunk('a', 0.9),
      chunk('a', 0.89),
      chunk('b', 0.88),
      chunk('c', 0.87),
      chunk('d', 0.86),
    ];
    expect(dedupeChunks(candidatos, 3).map((c) => c.content)).toEqual(['a', 'b', 'c']);
  });
});

describe('groupSources', () => {
  const base = { macroprocess: 'M', s3_key: 'k' };

  it('dos fragmentos del mismo documento dan una fuente con la mejor similitud y fragments: 2', () => {
    const out = groupSources([
      { ...base, document_id: 'a', title: 'SEC-PR-01', similarity: 0.55 },
      { ...base, document_id: 'b', title: 'COM-RE-07', similarity: 0.5 },
      { ...base, document_id: 'a', title: 'SEC-PR-01', similarity: 0.63 },
    ]);
    expect(out).toEqual([
      { documentId: 'a', title: 'SEC-PR-01', macroprocess: 'M', s3Key: 'k', similarity: 0.63, fragments: 2 },
      { documentId: 'b', title: 'COM-RE-07', macroprocess: 'M', s3Key: 'k', similarity: 0.5, fragments: 1 },
    ]);
  });
});

describe('parseUsedSources', () => {
  it('quita la línea y devuelve los números usados', () => {
    expect(parseUsedSources('Respuesta.\n\nFUENTES_USADAS: 1, 3', 5)).toEqual({
      answer: 'Respuesta.',
      used: [1, 3],
    });
  });

  it('sin la línea devuelve null (se muestran todas)', () => {
    expect(parseUsedSources('Respuesta.', 5)).toEqual({ answer: 'Respuesta.', used: null });
  });

  it('"ninguna" significa sin fuentes', () => {
    expect(parseUsedSources('No está.\nFUENTES_USADAS: ninguna', 5).used).toEqual([]);
  });

  it('números fuera de rango o texto no interpretable devuelve null', () => {
    expect(parseUsedSources('x\nFUENTES_USADAS: 9, 12', 5).used).toBeNull();
    expect(parseUsedSources('x\nFUENTES_USADAS: varias', 5).used).toBeNull();
  });

  it('ignora números repetidos', () => {
    expect(parseUsedSources('x\nFUENTES_USADAS: 2,2,1', 5).used).toEqual([2, 1]);
  });
});

describe('buildSystemPrompt', () => {
  const prompt = buildSystemPrompt('Ana', 'Performance');

  it('incluye las instrucciones de relevancia, contexto parcial y estilo', () => {
    expect(prompt).toContain('ignora los demás');
    expect(prompt).toContain('indica qué información falta');
    expect(prompt).toContain('No uses emojis ni tablas');
  });

  it('conserva alcance SGSI, no inventar y confidencialidad', () => {
    expect(prompt).toContain('Solo respondes preguntas relacionadas con el SGSI');
    expect(prompt).toContain('no inventes información');
    expect(prompt).toContain('Nunca reveles información confidencial');
    expect(prompt).toContain('Ana, del área Performance');
  });

  it('usa "no especificada" sin área', () => {
    expect(buildSystemPrompt('Ana', null)).toContain('del área no especificada');
  });
});
