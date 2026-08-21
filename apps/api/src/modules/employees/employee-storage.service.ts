import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Readable } from 'stream';
import { buildUploadKey, UPLOAD_URL_TTL_SECONDS } from '../../common/s3-upload.util';

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
] as const;

@Injectable()
export class EmployeeStorageService {
  private readonly logger = new Logger(EmployeeStorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.getOrThrow<string>('S3_BUCKET');
    this.client = new S3Client({
      region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
    });
  }

  async uploadDocument(file: Express.Multer.File, employeeId: string, docType: string): Promise<string> {
    const timestamp = Date.now();
    const key = `employees/${employeeId}/docs/${docType}/${timestamp}_${file.originalname}`;
    await this.upload(file, key);
    return key;
  }

  async uploadBuffer(buffer: Buffer, key: string, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ServerSideEncryption: 'aws:kms',
      }),
    );
  }

  /** Prefijo de las keys de un empleado. Sirve además para validar pertenencia. */
  static documentPrefix(employeeId: string): string {
    return `employees/${employeeId}/docs`;
  }

  /**
   * URL prefirmada para subida directa del navegador a S3, sin pasar por la
   * compute de Amplify. Sin ServerSideEncryption explícito: aplica el default
   * del bucket y el navegador no tiene que mandar el header.
   */
  async getPresignedUploadUrl(
    fileName: string,
    fileType: string,
    employeeId: string,
  ): Promise<{ uploadUrl: string; s3Key: string }> {
    const s3Key = buildUploadKey(EmployeeStorageService.documentPrefix(employeeId), fileName);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      ContentType: fileType,
    });
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
    });

    return { uploadUrl, s3Key };
  }

  /** Tamaño real del objeto ya subido; null si la key no existe en el bucket. */
  async getObjectSize(key: string): Promise<number | null> {
    try {
      const head = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return head.ContentLength ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Descarga server-side del objeto. Se usa para servir archivos vía el API en
   * vez de exponer una URL prefirmada al navegador, que el bucket rechaza por
   * CORS cuando el origen no es uno de los dominios registrados.
   */
  async getObjectStream(key: string): Promise<{ stream: Readable; contentType: string }> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!result.Body) {
      throw new NotFoundException('El archivo no existe en el almacenamiento');
    }
    return {
      stream: result.Body as Readable,
      contentType: result.ContentType ?? 'application/octet-stream',
    };
  }

  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  async deleteDocument(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      this.logger.warn(`No se pudo eliminar el objeto ${key} de S3: ${(err as Error).message}`);
    }
  }

  private async upload(file: Express.Multer.File, key: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ServerSideEncryption: 'aws:kms',
      }),
    );
  }
}
