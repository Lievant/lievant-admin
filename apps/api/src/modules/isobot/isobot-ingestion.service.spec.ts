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

describe('IsobotIngestionService.getDownloadUrl (biblioteca y fuentes del chat)', () => {
  function setup(doc: Record<string, unknown> | null) {
    const getPresignedReadUrl = jest.fn(async () => 'https://s3/firmada');
    const documentsRepo = { findOne: jest.fn(async () => doc) };
    const storage = { getPresignedReadUrl, getPresignedUrl: jest.fn() };
    const service = new IsobotIngestionService(documentsRepo as any, {} as any, storage as any);
    return { service, getPresignedReadUrl, storage };
  }
  const PDF_MIME = 'application/pdf';
  const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  it('«X.docx» con file_type pdf (reemplazado): baja como .pdf y con tipo application/pdf', async () => {
    const t = setup({ id: 'd', fileName: 'X.docx', fileType: 'pdf', s3Key: 'isobot/k' });
    expect(await t.service.getDownloadUrl('d')).toEqual({ url: 'https://s3/firmada' });
    expect(t.getPresignedReadUrl).toHaveBeenCalledWith('isobot/k', { disposition: 'attachment', fileName: 'X.pdf', contentType: PDF_MIME });
  });

  it('un .docx real conserva .docx y su tipo', async () => {
    const t = setup({ id: 'd', fileName: 'X.docx', fileType: 'docx', s3Key: 'isobot/k' });
    await t.service.getDownloadUrl('d');
    expect(t.getPresignedReadUrl).toHaveBeenCalledWith('isobot/k', { disposition: 'attachment', fileName: 'X.docx', contentType: DOCX_MIME });
  });

  it('file_type nulo con file_name «X.pdf» se toma de la extensión', async () => {
    const t = setup({ id: 'd', fileName: 'X.pdf', fileType: null, s3Key: 'isobot/k' });
    await t.service.getDownloadUrl('d');
    expect(t.getPresignedReadUrl).toHaveBeenCalledWith('isobot/k', { disposition: 'attachment', fileName: 'X.pdf', contentType: PDF_MIME });
  });

  it('sin tipo reconocible no manda contentType y deja el nombre tal cual', async () => {
    const t = setup({ id: 'd', fileName: 'notas', fileType: null, s3Key: 'isobot/k' });
    await t.service.getDownloadUrl('d');
    expect(t.getPresignedReadUrl).toHaveBeenCalledWith('isobot/k', { disposition: 'attachment', fileName: 'notas' });
  });

  it('el nombre con acentos y espacios se pasa completo (la codificación UTF-8 la hace buildContentDisposition)', async () => {
    const name = 'TIC-PO-02 Ver.00 Politica_Seguridad de la Información.docx';
    const t = setup({ id: 'd', fileName: name, fileType: 'pdf', s3Key: 'isobot/k' });
    await t.service.getDownloadUrl('d');
    const opts = (t.getPresignedReadUrl.mock.calls[0] as unknown as [string, { fileName: string }])[1];
    expect(opts.fileName).toBe('TIC-PO-02 Ver.00 Politica_Seguridad de la Información.pdf');
  });

  it('sin s3Key: 400; documento inexistente: 404; no usa el método viejo sin tipo de contenido', async () => {
    await expect(setup({ id: 'd', fileName: 'X.pdf', fileType: 'pdf', s3Key: null }).service.getDownloadUrl('d')).rejects.toMatchObject({ status: 400 });
    await expect(setup(null).service.getDownloadUrl('d')).rejects.toMatchObject({ status: 404 });
    const t = setup({ id: 'd', fileName: 'X.pdf', fileType: 'pdf', s3Key: 'k' });
    await t.service.getDownloadUrl('d');
    expect(t.storage.getPresignedUrl).not.toHaveBeenCalled();
  });

  it('getAdminFileUrl sigue igual: inline solo PDF y la misma corrección de nombre', async () => {
    const t = setup({ id: 'd', fileName: 'X.docx', fileType: 'pdf', s3Key: 'k' });
    (t.storage as any).getObjectSize = jest.fn(async () => 10);
    await t.service.getAdminFileUrl('d', 'inline');
    expect(t.getPresignedReadUrl).toHaveBeenCalledWith('k', { disposition: 'inline', fileName: 'X.pdf', contentType: PDF_MIME });
  });
});
