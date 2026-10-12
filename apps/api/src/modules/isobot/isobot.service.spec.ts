import 'reflect-metadata';
import { IsobotService } from './isobot.service';

// Sin OpenAI ni Anthropic reales: embeddings y modelo van simulados.
jest.mock('./openai-client', () => ({
  getOpenAI: () => ({ embeddings: { create: jest.fn(async () => ({ data: [{ embedding: [0.1, 0.2] }] })) } }),
}));
jest.mock('@anthropic-ai/sdk', () => ({ __esModule: true, default: class {} }));

const user = { id: 'u1', name: 'Ana', email: 'ana@lievant.com' } as any;

function row(content: string, similarity: number, document_id: string, title = 'Doc') {
  return { content, similarity, document_id, title, macroprocess: null, s3_key: null };
}

function build(rows: unknown[], modelResponse: { text: string; stop_reason?: string }) {
  const query = jest.fn().mockResolvedValue(rows);
  const create = jest.fn(async () => ({
    content: [{ type: 'text', text: modelResponse.text }],
    stop_reason: modelResponse.stop_reason ?? 'end_turn',
  }));
  const conversationsRepo = {
    create: jest.fn((v) => ({ messageCount: 0, ...v })),
    save: jest.fn(async (v) => ({ id: 'c1', messageCount: 0, userArea: null, ...v })),
    findOne: jest.fn(),
  };
  const messagesRepo = { create: jest.fn((v) => v), save: jest.fn(async (v) => v) };
  const service: any = new IsobotService(
    conversationsRepo as any,
    messagesRepo as any,
    { manager: { query } } as any,
    { findOne: jest.fn(async () => null) } as any,
  );
  service.anthropic = { messages: { create } };
  const warn = jest.spyOn(service.logger, 'warn').mockImplementation(() => undefined);
  return { service: service as IsobotService, query, create, messagesRepo, warn };
}

describe('IsobotService.search (top-k y duplicados)', () => {
  afterEach(() => {
    delete process.env.ISOBOT_TOP_K;
  });

  it('por defecto pide 2k candidatos con k = 8', async () => {
    const { service, query } = build([], { text: '' });
    await service.search('hola');
    expect(query.mock.calls[0][1][1]).toBe(16);
  });

  it('respeta ISOBOT_TOP_K y un limit explícito gana', async () => {
    const { service, query } = build([], { text: '' });
    process.env.ISOBOT_TOP_K = '4';
    await service.search('hola');
    expect(query.mock.calls[0][1][1]).toBe(8);
    await service.search('hola', 3);
    expect(query.mock.calls[1][1][1]).toBe(6);
  });

  it('descarta contenido idéntico entre documentos y recorta a k', async () => {
    const { service } = build(
      [row('igual', 0.9, 'a'), row('igual', 0.85, 'b'), row('x', 0.8, 'c'), row('y', 0.7, 'd')],
      { text: '' },
    );
    const out = await service.search('hola', 2);
    expect(out.map((r) => r.document_id)).toEqual(['a', 'c']);
  });
});

describe('IsobotService.chat', () => {
  afterEach(() => {
    delete process.env.ISOBOT_MAX_TOKENS;
  });

  it('usa max_tokens 2048 por defecto y lo toma de ISOBOT_MAX_TOKENS', async () => {
    const a = build([row('t', 0.5, 'a')], { text: 'ok' });
    await a.service.chat({ message: 'q' } as any, user);
    expect((a.create.mock.calls[0] as any)[0].max_tokens).toBe(2048);

    process.env.ISOBOT_MAX_TOKENS = '4096';
    const b = build([row('t', 0.5, 'a')], { text: 'ok' });
    await b.service.chat({ message: 'q' } as any, user);
    expect((b.create.mock.calls[0] as any)[0].max_tokens).toBe(4096);
  });

  it('deja un warn si el modelo se corta por max_tokens', async () => {
    const { service, warn } = build([row('t', 0.5, 'a')], { text: 'corta', stop_reason: 'max_tokens' });
    await service.chat({ message: 'q' } as any, user);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('no hace warn cuando termina normal', async () => {
    const { service, warn } = build([row('t', 0.5, 'a')], { text: 'ok' });
    await service.chat({ message: 'q' } as any, user);
    expect(warn).not.toHaveBeenCalled();
  });

  it('agrupa las fuentes por documento y las guarda así', async () => {
    const { service, messagesRepo } = build(
      [row('uno', 0.55, 'a', 'SEC-PR-01'), row('dos', 0.5, 'b', 'COM'), row('tres', 0.63, 'a', 'SEC-PR-01')],
      { text: 'Respuesta' },
    );
    const res = await service.chat({ message: 'q' } as any, user);
    expect(res.sources).toEqual([
      expect.objectContaining({ documentId: 'a', similarity: 0.63, fragments: 2 }),
      expect.objectContaining({ documentId: 'b', similarity: 0.5, fragments: 1 }),
    ]);
    const guardado = messagesRepo.save.mock.calls.map((c: any) => c[0]).find((m: any) => m.role === 'assistant');
    expect(guardado.sources).toHaveLength(2);
  });

  it('muestra solo las fuentes que el modelo dijo usar y quita la línea de la respuesta', async () => {
    const { service } = build(
      [row('uno', 0.9, 'a', 'A'), row('dos', 0.8, 'b', 'B'), row('tres', 0.7, 'c', 'C')],
      { text: 'Respuesta.\nFUENTES_USADAS: 1,3' },
    );
    const res = await service.chat({ message: 'q' } as any, user);
    expect(res.answer).toBe('Respuesta.');
    expect(res.sources.map((s) => s.documentId)).toEqual(['a', 'c']);
  });

  it('si el modelo no declara fuentes, muestra todas', async () => {
    const { service } = build([row('uno', 0.9, 'a'), row('dos', 0.8, 'b')], { text: 'Respuesta sin línea' });
    const res = await service.chat({ message: 'q' } as any, user);
    expect(res.sources).toHaveLength(2);
  });
});
