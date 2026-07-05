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
import { getOpenAI } from './openai-client';
import { toVectorLiteral } from './vector.util';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const CHUNK_TOKENS = 500;
const OVERLAP_TOKENS = 50;
const TOKENS_PER_WORD = 1.3;

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
          return `--- ${name} ---\n${XLSX.utils.sheet_to_csv(sheet)}`;
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
    const words = text.split(/\s+/).filter(Boolean);
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
    const fileType = this.fileTypeFromPath(filePath);
    const buffer = fs.readFileSync(filePath);

    const text = await this.extractText(buffer, fileType);
    const title = metadata.title ?? path.basename(fileName, path.extname(fileName));

    const s3Key = await this.storage.uploadDocument(buffer, fileName, MIME_TYPES[fileType]!);

    const insertedRows = await this.documentsRepo.manager.query<Array<{ id: string }>>(
      `
      INSERT INTO isobot.documents (title, file_name, s3_key, file_type, macroprocess, category)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (file_name) DO UPDATE SET
        title = EXCLUDED.title,
        s3_key = EXCLUDED.s3_key,
        file_type = EXCLUDED.file_type,
        macroprocess = EXCLUDED.macroprocess,
        category = EXCLUDED.category,
        updated_at = NOW()
      RETURNING id
      `,
      [title, fileName, s3Key, fileType, metadata.macroprocess ?? null, metadata.category ?? null],
    );
    const documentId = insertedRows[0]!.id;

    // Re-indexar: si el documento ya existía, sus chunks quedan obsoletos.
    await this.chunksRepo.manager.query(`DELETE FROM isobot.document_chunks WHERE document_id = $1`, [documentId]);

    const chunks = this.chunkText(text);
    if (chunks.length === 0) {
      return { documentId, fileName, chunksCreated: 0 };
    }

    const embeddingResponse = await getOpenAI().embeddings.create({
      model: EMBEDDING_MODEL,
      input: chunks.map((c) => c.content),
    });

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const embedding = embeddingResponse.data[i]!.embedding;
      await this.chunksRepo.manager.query(
        `
        INSERT INTO isobot.document_chunks (document_id, chunk_index, content, token_count, embedding)
        VALUES ($1, $2, $3, $4, $5::vector)
        `,
        [documentId, i, chunk.content, chunk.tokenCount, toVectorLiteral(embedding)],
      );
    }

    return { documentId, fileName, chunksCreated: chunks.length };
  }

  // -------------------------------------------------------------------------
  // Gestión de documentos
  // -------------------------------------------------------------------------

  async listDocuments(): Promise<DocumentListItem[]> {
    return this.documentsRepo.manager.query<DocumentListItem[]>(`
      SELECT d.id, d.title, d.file_name, d.file_type, d.macroprocess, d.category,
        d.is_active, d.created_at, COUNT(dc.id)::int as chunk_count
      FROM isobot.documents d
      LEFT JOIN isobot.document_chunks dc ON dc.document_id = d.id
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

    const url = await this.storage.getPresignedUrl(document.s3Key);
    return { url };
  }
}
