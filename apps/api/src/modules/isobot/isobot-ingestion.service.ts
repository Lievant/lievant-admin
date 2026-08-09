import * as fs from 'fs';
import * as path from 'path';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import * as XLSX from 'xlsx';
import { Repository } from 'typeorm';
import { DocumentChunk } from './entities/document-chunk.entity';
import { IsobotDocument } from './entities/document.entity';
import { IsobotStorageService } from './isobot-storage.service';
// Mismo formato de cursor que clientes y proveedores.
import { decodeCursor, encodeCursor } from '../clients/utils/cursor.util';
import { getOpenAI } from './openai-client';
import { toVectorLiteral } from './vector.util';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const CHUNK_TOKENS = 500;
const OVERLAP_TOKENS = 50;
const TOKENS_PER_WORD = 1.3;
const EMBEDDING_BATCH_SIZE = 100;
// Los XLSX del SGSI son formatos/registros, no bases de datos — 1000 filas
// alcanza de sobra para RAG y evita que una hoja enorme bloquee el event
// loop de Node de forma síncrona (XLSX.utils.sheet_to_csv es CPU-bound).
const MAX_XLSX_ROWS = 1000;
const MAX_XLSX_COLS = 50;
const MAX_WORD_CHARS = 2000;

const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export interface DocumentMetadata {
  title?: string;
  macroprocess?: string | null;
  category?: string | null;
}

export interface ProcessDocumentResult {
  documentId: string;
  fileName: string;
  chunksCreated: number;
}

interface Chunk {
  content: string;
  tokenCount: number;
}

export interface AdminDocumentItem {
  id: string;
  title: string;
  fileName: string;
  fileType: string | null;
  macroprocess: string | null;
  category: string | null;
  fileSize: number | null;
  chunkCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminDocumentsPage {
  data: AdminDocumentItem[];
  nextCursor: string | null;
  total: number;
  stats: {
    documentos: number;
    chunks: number;
    macroprocesos: number;
    ultimaActualizacion: string | null;
  };
}

export interface DocumentListItem {
  id: string;
  title: string;
  file_name: string;
  file_type: string | null;
  macroprocess: string | null;
  category: string | null;
  is_active: boolean;
  created_at: Date;
  chunk_count: number;
}

@Injectable()
export class IsobotIngestionService {
  constructor(
    @InjectRepository(IsobotDocument) private readonly documentsRepo: Repository<IsobotDocument>,
    @InjectRepository(DocumentChunk) private readonly chunksRepo: Repository<DocumentChunk>,
    private readonly storage: IsobotStorageService,
  ) {}

  // -------------------------------------------------------------------------
  // Extracción de texto
  // -------------------------------------------------------------------------

  private fileTypeFromPath(filePath: string): string {
    const ext = path.extname(filePath).slice(1).toLowerCase();
    if (!MIME_TYPES[ext]) throw new BadRequestException(`Tipo de archivo no soportado: .${ext}`);
    return ext;
  }

  // sheet_to_csv no acepta un option `range` en esta versión de la librería;
  // en su lugar se acorta `!ref` (que es lo que sheet_to_csv usa internamente
  // para decidir hasta dónde iterar) sobre una copia superficial de la hoja.
  //
  // El límite de columnas es tan importante como el de filas: una hoja con
  // formato aplicado a las 16,384 columnas máximas de Excel (pero solo unas
  // pocas con datos reales) genera un CSV de varios MB casi vacío, que luego
  // produce un chunk gigante enviado a OpenAI — eso fue lo que causó los
  // cuelgues de ~20 min (timeout + reintento del SDK), no la cantidad de filas.
  private limitedSheet(sheet: XLSX.WorkSheet): XLSX.WorkSheet {
    if (!sheet['!ref']) return sheet;
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const maxRow = Math.min(range.e.r, range.s.r + MAX_XLSX_ROWS - 1);
    const maxCol = Math.min(range.e.c, range.s.c + MAX_XLSX_COLS - 1);
    if (range.e.r <= maxRow && range.e.c <= maxCol) return sheet;
    return { ...sheet, '!ref': XLSX.utils.encode_range({ s: range.s, e: { r: maxRow, c: maxCol } }) };
  }

  private async extractText(buffer: Buffer, fileType: string): Promise<string> {
    switch (fileType) {
      case 'pdf': {
        const parser = new PDFParse({ data: buffer });
        try {
          const result = await parser.getText();
          return result.text;
        } finally {
          await parser.destroy();
        }
      }
      case 'docx': {
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      }
      case 'xlsx': {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        return workbook.SheetNames.map((name) => {
          const sheet = workbook.Sheets[name]!;
          const csv = XLSX.utils.sheet_to_csv(this.limitedSheet(sheet));
          return `--- ${name} ---\n${csv}`;
        }).join('\n\n');
      }
      default:
        throw new BadRequestException(`Tipo de archivo no soportado: ${fileType}`);
    }
  }

  // -------------------------------------------------------------------------
  // Chunking (~500 tokens, overlap 50) — aproximado por palabras, sin
  // dependencia de un tokenizer real (no se pidió agregar tiktoken).
  // -------------------------------------------------------------------------

  private chunkText(text: string, chunkTokens = CHUNK_TOKENS, overlapTokens = OVERLAP_TOKENS): Chunk[] {
    // Un "word" (separado por espacios) sin límite de tamaño puede volverse
    // un chunk gigante si el texto de origen no tiene espacios (p. ej. una
    // fila de CSV mal formada) — se trunca como salvaguarda independiente
    // del tipo de archivo.
    const words = text
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => (w.length > MAX_WORD_CHARS ? w.slice(0, MAX_WORD_CHARS) : w));
    if (words.length === 0) return [];

    const chunkSize = Math.max(1, Math.round(chunkTokens / TOKENS_PER_WORD));
    const overlap = Math.max(0, Math.round(overlapTokens / TOKENS_PER_WORD));
    const step = Math.max(1, chunkSize - overlap);

    const chunks: Chunk[] = [];
    for (let start = 0; start < words.length; start += step) {
      const slice = words.slice(start, start + chunkSize);
      if (slice.length === 0) break;
      chunks.push({
        content: slice.join(' '),
        tokenCount: Math.round(slice.length * TOKENS_PER_WORD),
      });
      if (start + chunkSize >= words.length) break;
    }
    return chunks;
  }

  // -------------------------------------------------------------------------
  // Procesar un documento: extraer, subir a S3, chunkear, embeber, guardar
  // -------------------------------------------------------------------------

  async processDocument(filePath: string, metadata: DocumentMetadata = {}): Promise<ProcessDocumentResult> {
    const fileName = path.basename(filePath);
    const buffer = fs.readFileSync(filePath);
    return this.indexar(
      buffer,
      fileName,
      this.fileTypeFromPath(filePath),
      buffer.length,
      metadata,
    );
  }

  /**
   * Núcleo compartido: extrae texto, sube a S3, reemplaza los chunks y genera
   * los embeddings. Lo usan el seed (desde disco), el alta y el reemplazo.
   *
   * `documentIdExistente` fuerza el destino en el reemplazo; sin él se hace
   * upsert por file_name, que es la clave única de la tabla.
   */
  private async indexar(
    buffer: Buffer,
    fileName: string,
    fileType: string,
    fileSize: number,
    metadata: DocumentMetadata = {},
    documentIdExistente?: string,
  ): Promise<ProcessDocumentResult> {
    const text = await this.extractText(buffer, fileType);
    const title = metadata.title ?? path.basename(fileName, path.extname(fileName));

    const s3Key = await this.storage.uploadDocument(buffer, fileName, MIME_TYPES[fileType]!);

    let documentId: string;
    if (documentIdExistente) {
      await this.documentsRepo.manager.query(
        `UPDATE isobot.documents
         SET s3_key = $2, file_type = $3, file_size = $4, updated_at = NOW()
         WHERE id = $1`,
        [documentIdExistente, s3Key, fileType, fileSize],
      );
      documentId = documentIdExistente;
    } else {
      const insertedRows = await this.documentsRepo.manager.query<Array<{ id: string }>>(
        `
        INSERT INTO isobot.documents (title, file_name, s3_key, file_type, file_size, macroprocess, category)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (file_name) DO UPDATE SET
          title = EXCLUDED.title,
          s3_key = EXCLUDED.s3_key,
          file_type = EXCLUDED.file_type,
          file_size = EXCLUDED.file_size,
          macroprocess = EXCLUDED.macroprocess,
          category = EXCLUDED.category,
          is_active = true,
          deleted_at = NULL,
          updated_at = NOW()
        RETURNING id
        `,
        [title, fileName, s3Key, fileType, fileSize, metadata.macroprocess ?? null, metadata.category ?? null],
      );
      documentId = insertedRows[0]!.id;
    }

    // Re-indexar: si el documento ya existía, sus chunks quedan obsoletos.
    await this.chunksRepo.manager.query(`DELETE FROM isobot.document_chunks WHERE document_id = $1`, [documentId]);

    const chunks = this.chunkText(text);
    if (chunks.length === 0) {
      return { documentId, fileName, chunksCreated: 0 };
    }

    // Batching: un documento grande puede exceder el límite de 300,000 tokens
    // por request de OpenAI si se manda de un solo golpe.
    for (let batchStart = 0; batchStart < chunks.length; batchStart += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(batchStart, batchStart + EMBEDDING_BATCH_SIZE);
      const embeddingResponse = await getOpenAI().embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch.map((c) => c.content),
      });

      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j]!;
        const embedding = embeddingResponse.data[j]!.embedding;
        const chunkIndex = batchStart + j;
        await this.chunksRepo.manager.query(
          `
          INSERT INTO isobot.document_chunks (document_id, chunk_index, content, token_count, embedding)
          VALUES ($1, $2, $3, $4, $5::vector)
          `,
          [documentId, chunkIndex, chunk.content, chunk.tokenCount, toVectorLiteral(embedding)],
        );
      }
    }

    return { documentId, fileName, chunksCreated: chunks.length };
  }

  // -------------------------------------------------------------------------
  // Gestión de documentos
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // Panel de administración (sgsi.isobot.write)
  // -------------------------------------------------------------------------

  /**
   * Indexa un archivo subido por HTTP. `processDocument` lee de disco porque
   * nació para el seed; aquí el contenido llega en memoria desde Multer, así que
   * ambos comparten `indexar()` y solo cambia de dónde sale el buffer.
   */
  async uploadDocument(
    file: Express.Multer.File,
    metadata: DocumentMetadata = {},
  ): Promise<ProcessDocumentResult> {
    const fileType = this.fileTypeFromPath(file.originalname);
    return this.indexar(file.buffer, file.originalname, fileType, file.size, metadata);
  }

  /**
   * Reemplaza el archivo de un documento y lo reindexa por completo.
   *
   * El archivo anterior se borra de S3 después de subir el nuevo: si el borrado
   * fuera primero y la subida fallara, el documento quedaría sin archivo.
   */
  async replaceDocument(id: string, file: Express.Multer.File): Promise<ProcessDocumentResult> {
    const documento = await this.documentsRepo.findOne({ where: { id } });
    if (!documento) throw new NotFoundException(`Documento ${id} no encontrado`);

    const claveAnterior = documento.s3Key;
    const fileType = this.fileTypeFromPath(file.originalname);

    const resultado = await this.indexar(
      file.buffer,
      documento.fileName, // conserva el nombre: file_name es UNIQUE y la clave del documento
      fileType,
      file.size,
      { title: documento.title, macroprocess: documento.macroprocess, category: documento.category },
      id,
    );

    if (claveAnterior) {
      try {
        await this.storage.deleteDocument(claveAnterior);
      } catch {
        // El documento ya apunta al archivo nuevo; un huérfano en S3 no debe
        // hacer fallar la operación.
      }
    }

    return resultado;
  }

  /**
   * Retira un documento del chatbot. La fila se conserva (borrado lógico) pero
   * los chunks se eliminan de verdad: son lo que consulta la búsqueda vectorial
   * y dejarlos haría que el bot siguiera citando un documento retirado.
   */
  async softDeleteDocument(id: string): Promise<{ deleted: true; chunksRemoved: number }> {
    const documento = await this.documentsRepo.findOne({ where: { id } });
    if (!documento) throw new NotFoundException(`Documento ${id} no encontrado`);

    // RETURNING y no rowCount: TypeORM devuelve solo `rows` en query(), así que
    // un DELETE sin RETURNING llega como arreglo vacío y perdería la cuenta.
    const borrados = (await this.chunksRepo.manager.query(
      `DELETE FROM isobot.document_chunks WHERE document_id = $1 RETURNING id`,
      [id],
    )) as unknown[];
    const chunksRemoved = borrados.length;

    await this.documentsRepo.manager.query(
      `UPDATE isobot.documents SET is_active = false, deleted_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id],
    );

    if (documento.s3Key) {
      try {
        await this.storage.deleteDocument(documento.s3Key);
      } catch {
        // Igual que arriba: el documento ya está retirado del chatbot.
      }
    }

    return { deleted: true, chunksRemoved };
  }

  /** Listado del panel, paginado por cursor sobre (updated_at, id). */
  async getAdminDocuments(filtros: {
    search?: string;
    macroprocess?: string;
    fileType?: string;
    cursor?: string;
    limit?: number;
  }): Promise<AdminDocumentsPage> {
    const limit = filtros.limit ?? 20;
    const condiciones = ['d.deleted_at IS NULL'];
    const params: unknown[] = [];

    if (filtros.search) {
      params.push(`%${filtros.search}%`);
      condiciones.push(`(d.title ILIKE $${params.length} OR d.file_name ILIKE $${params.length})`);
    }
    if (filtros.macroprocess) {
      params.push(filtros.macroprocess);
      condiciones.push(`d.macroprocess = $${params.length}`);
    }
    if (filtros.fileType) {
      params.push(filtros.fileType);
      condiciones.push(`d.file_type = $${params.length}`);
    }

    const where = condiciones.join(' AND ');

    const totales = (await this.documentsRepo.manager.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(DISTINCT d.macroprocess)::int AS macroprocesos,
              COALESCE((SELECT COUNT(*)::int FROM isobot.document_chunks), 0) AS chunks,
              MAX(d.updated_at) AS ultima_actualizacion
       FROM isobot.documents d WHERE ${where}`,
      params,
    )) as { total: number; macroprocesos: number; chunks: number; ultima_actualizacion: string | null }[];

    const condicionesPagina = [...condiciones];
    if (filtros.cursor) {
      const cursor = decodeCursor(filtros.cursor);
      params.push(cursor.createdAt, cursor.id);
      condicionesPagina.push(
        `(d.updated_at < $${params.length - 1}::timestamptz OR (d.updated_at = $${params.length - 1}::timestamptz AND d.id < $${params.length}::uuid))`,
      );
    }

    params.push(limit + 1);
    const filas = (await this.documentsRepo.manager.query(
      `SELECT d.id, d.title, d.file_name, d.file_type, d.macroprocess, d.category,
              d.file_size, d.is_active, d.created_at, d.updated_at,
              d.updated_at::text AS cursor_updated_at,
              (SELECT COUNT(*)::int FROM isobot.document_chunks c WHERE c.document_id = d.id) AS chunk_count
       FROM isobot.documents d
       WHERE ${condicionesPagina.join(' AND ')}
       ORDER BY d.updated_at DESC, d.id DESC
       LIMIT $${params.length}`,
      params,
    )) as Record<string, unknown>[];

    const hayMas = filas.length > limit;
    const pagina = hayMas ? filas.slice(0, limit) : filas;
    const ultima = pagina[pagina.length - 1];

    return {
      data: pagina.map((f) => ({
        id: f.id as string,
        title: f.title as string,
        fileName: f.file_name as string,
        fileType: (f.file_type as string) ?? null,
        macroprocess: (f.macroprocess as string) ?? null,
        category: (f.category as string) ?? null,
        fileSize: (f.file_size as number) ?? null,
        chunkCount: f.chunk_count as number,
        isActive: f.is_active as boolean,
        createdAt: f.created_at as string,
        updatedAt: f.updated_at as string,
      })),
      // Mismo criterio que proveedores: el cursor lleva el timestamp con
      // microsegundos, porque pasarlo por Date lo truncaría a milisegundos y
      // los documentos cargados en lote comparten milisegundo.
      nextCursor:
        hayMas && ultima
          ? encodeCursor({ createdAt: ultima.cursor_updated_at as string, id: ultima.id as string })
          : null,
      total: totales[0]?.total ?? 0,
      stats: {
        documentos: totales[0]?.total ?? 0,
        chunks: totales[0]?.chunks ?? 0,
        macroprocesos: totales[0]?.macroprocesos ?? 0,
        ultimaActualizacion: totales[0]?.ultima_actualizacion ?? null,
      },
    };
  }

  /** Macroprocesos existentes, para el autocompletado del alta. */
  async getMacroprocesses(): Promise<string[]> {
    const filas = (await this.documentsRepo.manager.query(
      `SELECT DISTINCT macroprocess FROM isobot.documents
       WHERE macroprocess IS NOT NULL AND deleted_at IS NULL ORDER BY macroprocess`,
    )) as { macroprocess: string }[];
    return filas.map((f) => f.macroprocess);
  }

  async listDocuments(): Promise<DocumentListItem[]> {
    return this.documentsRepo.manager.query<DocumentListItem[]>(`
      SELECT d.id, d.title, d.file_name, d.file_type, d.macroprocess, d.category,
        d.is_active, d.created_at, COUNT(dc.id)::int as chunk_count
      FROM isobot.documents d
      LEFT JOIN isobot.document_chunks dc ON dc.document_id = d.id
      WHERE d.deleted_at IS NULL
      GROUP BY d.id
      ORDER BY d.title ASC
    `);
  }

  async deleteDocument(id: string): Promise<void> {
    const document = await this.documentsRepo.findOne({ where: { id } });
    if (!document) throw new NotFoundException(`Documento ${id} no encontrado`);

    await this.chunksRepo.manager.query(`DELETE FROM isobot.document_chunks WHERE document_id = $1`, [id]);
    await this.documentsRepo.delete(id);
  }

  async getDownloadUrl(id: string): Promise<{ url: string }> {
    const document = await this.documentsRepo.findOne({ where: { id } });
    if (!document) throw new NotFoundException(`Documento ${id} no encontrado`);
    if (!document.s3Key) throw new BadRequestException('Este documento no tiene un archivo asociado en S3');

    const url = await this.storage.getPresignedUrl(document.s3Key, document.fileName);
    return { url };
  }
}
