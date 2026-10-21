import 'reflect-metadata';
import { PERMISSION_KEY } from '../auth/decorators/permission.decorator';
import { IsobotController } from './isobot.controller';
import {
  buildContentDisposition,
  downloadFileName,
  fileTypeOf,
  READ_URL_TTL_SECONDS,
} from './isobot-file-url.util';
import { IsobotIngestionService } from './isobot-ingestion.service';
import { IsobotStorageService } from './isobot-storage.service';

// Sin S3, OpenAI ni parsers reales: la firma y las librerías van simuladas.
const mockGetSignedUrl = jest.fn(async () => 'https://s3.example/firmada');
jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: (...args: unknown[]) => (mockGetSignedUrl as any)(...args) }));
jest.mock('./openai-client', () => ({ getOpenAI: () => ({}) }));
jest.mock('mammoth', () => ({ __esModule: true, default: {} }));
jest.mock('pdf-parse', () => ({ PDFParse: class {} }));

describe('buildContentDisposition', () => {
  it('codifica acentos y espacios en filename* y deja respaldo ASCII', () => {
    const header = buildContentDisposition('attachment', 'Evaluación de lead.pdf');
    expect(header).toBe(
      `attachment; filename="Evaluaci_n de lead.pdf"; filename*=UTF-8''Evaluaci%C3%B3n%20de%20lead.pdf`,
    );
  });

  it('usa inline para ver en el navegador', () => {
    expect(buildContentDisposition('inline', 'a.pdf')).toMatch(/^inline; filename="a\.pdf"; filename\*=UTF-8''a\.pdf$/);
  });

  it('no deja pasar comillas, barras ni saltos de línea', () => {
    const header = buildContentDisposition('attachment', 'a"b\\c\r\nd.pdf');
    expect(header).not.toMatch(/[\r\n]/);
    expect(header).toContain('filename="a_b_c d.pdf"');
  });

  it("codifica los caracteres ' ( ) * que encodeURIComponent no escapa", () => {
    expect(buildContentDisposition('attachment', "o'(1)*.pdf")).toContain("filename*=UTF-8''o%27%281%29%2A.pdf");
  });
});

describe('fileTypeOf y downloadFileName', () => {
  it('toma el tipo guardado o, si falta, la extensión del nombre', () => {
    expect(fileTypeOf('pdf', 'x.docx')).toBe('pdf');
    expect(fileTypeOf(null, 'Manual.XLSX')).toBe('xlsx');
    expect(fileTypeOf(null, 'sin-extension')).toBeNull();
  });

  it('conserva el nombre original si la extensión coincide', () => {
    expect(downloadFileName('Política de uso.pdf', 'pdf')).toBe('Política de uso.pdf');
  });

  it('corrige la extensión cuando un reemplazo cambió el tipo de archivo', () => {
    expect(downloadFileName('Política.pdf', 'docx')).toBe('Política.docx');
    expect(downloadFileName('Política', 'pdf')).toBe('Política.pdf');
  });
});

describe('IsobotStorageService.getPresignedReadUrl', () => {
  const config = { getOrThrow: () => 'bucket-test', get: () => 'us-east-1' } as any;

  beforeEach(() => mockGetSignedUrl.mockClear());

  it('firma un GET de vida corta con la disposición inline y el tipo PDF', async () => {
    const storage = new IsobotStorageService(config);
    const url = await storage.getPresignedReadUrl('isobot/documents/1_a.pdf', {
      disposition: 'inline',
      fileName: 'Evaluación.pdf',
      contentType: 'application/pdf',
    });
    expect(url).toBe('https://s3.example/firmada');

    const [, command, options] = mockGetSignedUrl.mock.calls[0] as any[];
    expect(command.input).toMatchObject({
      Bucket: 'bucket-test',
      Key: 'isobot/documents/1_a.pdf',
      ResponseContentType: 'application/pdf',
    });
    expect(command.input.ResponseContentDisposition).toMatch(/^inline; filename=".*"; filename\*=UTF-8''Evaluaci%C3%B3n\.pdf$/);
    expect(options).toEqual({ expiresIn: READ_URL_TTL_SECONDS });
    expect(READ_URL_TTL_SECONDS).toBeLessThanOrEqual(60);
  });

  it('con attachment la disposición es de descarga', async () => {
    const storage = new IsobotStorageService(config);
    await storage.getPresignedReadUrl('k', { disposition: 'attachment', fileName: 'a.docx' });
    const [, command] = mockGetSignedUrl.mock.calls[0] as any[];
    expect(command.input.ResponseContentDisposition).toMatch(/^attachment;/);
    expect(command.input).not.toHaveProperty('ResponseContentType');
  });
});

const DOC = {
  id: 'd1',
  fileName: 'Evaluación de lead.pdf',
  fileType: 'pdf',
  s3Key: 'isobot/documents/1_Evaluaci_n_de_lead.pdf',
  isActive: true,
};

function build(doc: Record<string, unknown> | null, objectSize: number | null = 100) {
  const documentsRepo = { findOne: jest.fn(async () => doc), manager: { query: jest.fn() } };
  const storage = {
    getObjectSize: jest.fn(async () => objectSize),
    getPresignedReadUrl: jest.fn(async () => 'https://s3.example/firmada'),
  };
  const service = new IsobotIngestionService(documentsRepo as any, {} as any, storage as any);
  return { service, storage };
}

describe('IsobotIngestionService.getAdminFileUrl', () => {
  it('PDF inline: pide la URL con disposición inline, tipo PDF y el nombre original', async () => {
    const { service, storage } = build(DOC);
    expect(await service.getAdminFileUrl('d1', 'inline')).toEqual({ url: 'https://s3.example/firmada' });
    expect(storage.getPresignedReadUrl).toHaveBeenCalledWith(DOC.s3Key, {
      disposition: 'inline',
      fileName: 'Evaluación de lead.pdf',
      contentType: 'application/pdf',
    });
  });

  it('por defecto descarga (attachment)', async () => {
    const { service, storage } = build(DOC);
    await service.getAdminFileUrl('d1');
    expect((storage.getPresignedReadUrl.mock.calls[0] as any)[1].disposition).toBe('attachment');
  });

  it('Word y Excel se pueden descargar con su nombre y tipo', async () => {
    const { service, storage } = build({ ...DOC, fileName: 'Manual.docx', fileType: 'docx' });
    await service.getAdminFileUrl('d1', 'attachment');
    expect((storage.getPresignedReadUrl.mock.calls[0] as any)[1]).toMatchObject({
      fileName: 'Manual.docx',
      contentType: expect.stringContaining('wordprocessingml'),
    });
  });

  it('Word y Excel no se pueden ver en el navegador (400)', async () => {
    const { service, storage } = build({ ...DOC, fileType: 'xlsx', fileName: 'Registro.xlsx' });
    await expect(service.getAdminFileUrl('d1', 'inline')).rejects.toThrow(/no se pueden previsualizar/);
    expect(storage.getPresignedReadUrl).not.toHaveBeenCalled();
  });

  it('id inexistente: 404', async () => {
    const { service } = build(null);
    await expect(service.getAdminFileUrl('nope')).rejects.toThrow(/no encontrado/);
  });

  it('documento sin s3_key: 404 con mensaje claro y sin firmar', async () => {
    const { service, storage } = build({ ...DOC, s3Key: null });
    await expect(service.getAdminFileUrl('d1')).rejects.toThrow('no tiene un archivo disponible');
    expect(storage.getPresignedReadUrl).not.toHaveBeenCalled();
  });

  it('archivo que ya no está en S3 (documento retirado): 404 y no firma', async () => {
    const { service, storage } = build(DOC, null);
    await expect(service.getAdminFileUrl('d1')).rejects.toThrow('ya no está disponible');
    expect(storage.getPresignedReadUrl).not.toHaveBeenCalled();
  });

  it('un documento inactivo con archivo en S3 se puede ver y descargar igual', async () => {
    const { service } = build({ ...DOC, isActive: false });
    await expect(service.getAdminFileUrl('d1', 'inline')).resolves.toEqual({ url: 'https://s3.example/firmada' });
  });

  it('corrige la extensión si el reemplazo cambió el tipo de archivo', async () => {
    const { service, storage } = build({ ...DOC, fileName: 'Política.pdf', fileType: 'docx' });
    await service.getAdminFileUrl('d1', 'attachment');
    expect((storage.getPresignedReadUrl.mock.calls[0] as any)[1].fileName).toBe('Política.docx');
  });
});

describe('IsobotController: permiso de la ruta', () => {
  it('ver o descargar un documento exige sgsi.isobot.write', () => {
    expect(Reflect.getMetadata(PERMISSION_KEY, IsobotController.prototype.getAdminDocumentFile)).toEqual({
      section: 'sgsi',
      module: 'isobot',
      action: 'write',
    });
  });

  it('el chat conserva su propio permiso de lectura', () => {
    expect(Reflect.getMetadata(PERMISSION_KEY, IsobotController.prototype.getDownloadUrl)).toEqual({
      section: 'herramientas',
      module: 'isobot',
      action: 'read',
    });
  });
});
