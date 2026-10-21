import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterAdminDocumentDto } from './dto/admin-documents.dto';
import { IsobotIngestionService } from './isobot-ingestion.service';

// Sin OpenAI ni S3 reales: el cliente de embeddings y el storage van simulados.
jest.mock('./openai-client', () => ({
  getOpenAI: () => ({
    embeddings: {
      create: jest.fn(async ({ input }: { input: string[] }) => ({
        data: input.map(() => ({ embedding: [0.1, 0.2] })),
      })),
    },
  }),
}));
jest.mock('mammoth', () => ({ __esModule: true, default: {} }));
jest.mock('pdf-parse', () => ({ PDFParse: class {} }));

const DOC = {
  id: 'd1',
  fileName: 'politica.pdf',
  title: 'Política original',
  macroprocess: '1. DIRECCIÓN',
  category: 'Políticas',
  s3Key: 'isobot/old.pdf',
};

function build() {
  const query = jest.fn().mockResolvedValue([]);
  const documentsRepo = { findOne: jest.fn(async () => ({ ...DOC })), manager: { query } };
  const chunksRepo = { manager: { query } };
  const storage = {
    getObjectSize: jest.fn(async () => 1000),
    getObjectBuffer: jest.fn(async () => Buffer.from('x')),
    deleteDocument: jest.fn(async () => undefined),
    uploadDocument: jest.fn(),
  };
  const service: any = new IsobotIngestionService(documentsRepo as any, chunksRepo as any, storage as any);
  jest.spyOn(service, 'extractText').mockResolvedValue('uno dos tres cuatro');
  return { service: service as IsobotIngestionService & Record<string, any>, query, storage };
}

const baseDto = { s3Key: 'isobot/documents/new.pdf', fileName: 'nuevo.pdf', fileSize: 1000 };

// assertKeyInPrefix valida el prefijo real del storage; se acota a lo que usa el servicio.
jest.mock('../../common/s3-upload.util', () => ({
  assertKeyInPrefix: jest.fn(),
  MAX_UPLOAD_BYTES: 20 * 1024 * 1024,
}));
jest.mock('./isobot-storage.service', () => ({
  IsobotStorageService: { documentPrefix: () => 'isobot/documents/' },
}));

function updateCall(query: jest.Mock) {
  return query.mock.calls.find(([sql]) => String(sql).includes('UPDATE isobot.documents'));
}

describe('IsobotIngestionService.registerReplacement (metadatos)', () => {
  it('guarda título, macroproceso y categoría nuevos', async () => {
    const { service, query } = build();
    await service.registerReplacement('d1', {
      ...baseDto,
      title: ' Política nueva ',
      macroprocess: '4. RECURSOS HUMANOS',
      category: 'Procedimientos',
    });
    const [, params] = updateCall(query)!;
    expect(params.slice(4)).toEqual(['Política nueva', '4. RECURSOS HUMANOS', 'Procedimientos']);
  });

  it('sin metadatos conserva los actuales', async () => {
    const { service, query } = build();
    await service.registerReplacement('d1', { ...baseDto });
    const [, params] = updateCall(query)!;
    expect(params.slice(4)).toEqual([DOC.title, DOC.macroprocess, DOC.category]);
  });

  it('valores vacíos conservan los actuales', async () => {
    const { service, query } = build();
    await service.registerReplacement('d1', { ...baseDto, title: '  ', macroprocess: '', category: '' });
    const [, params] = updateCall(query)!;
    expect(params.slice(4)).toEqual([DOC.title, DOC.macroprocess, DOC.category]);
  });

  it('nunca cambia file_name ni lo incluye en el UPDATE', async () => {
    const { service, query } = build();
    await service.registerReplacement('d1', { ...baseDto, title: 'Otro' });
    const [sql] = updateCall(query)!;
    expect(String(sql)).not.toMatch(/file_name/);
  });
});

describe('RegisterAdminDocumentDto (validación)', () => {
  const ok = { s3Key: 'k', fileName: 'a.pdf', fileSize: 10 };

  it('acepta metadatos válidos', async () => {
    const dto = plainToInstance(RegisterAdminDocumentDto, { ...ok, title: 'T', macroprocess: 'M', category: 'C' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it.each([
    ['title', 301],
    ['macroprocess', 101],
    ['category', 101],
  ])('rechaza %s demasiado largo', async (campo, largo) => {
    const dto = plainToInstance(RegisterAdminDocumentDto, { ...ok, [campo]: 'x'.repeat(largo) });
    const errores = await validate(dto);
    expect(errores.map((e) => e.property)).toContain(campo);
  });
});
