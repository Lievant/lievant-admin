import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
export class DocumentStorageService {
  private readonly logger = new Logger(DocumentStorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.getOrThrow<string>('S3_BUCKET');
    this.client = new S3Client({
      region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
    });
  }

  async uploadDocument(file: Express.Multer.File, clientId: string, docType: string): Promise<string> {
    const timestamp = Date.now();
    const key = `clients/documents/${clientId}/${docType}/${timestamp}_${file.originalname}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ServerSideEncryption: 'aws:kms',
      }),
    );

    return key;
  }

  /** Prefijo de las keys de un cliente. Sirve además para validar pertenencia. */
  static documentPrefix(clientId: string): string {
    return `clients/documents/${clientId}`;
  }

  /**
   * URL prefirmada para que el navegador suba directo a S3 y no pase por la
   * compute de Amplify. No fija ServerSideEncryption a propósito: así aplica el
   * cifrado por defecto del bucket y el cliente no tiene que mandar el header
   * (que además tendría que ir en la allowlist de CORS).
   */
  async getPresignedUploadUrl(
    fileName: string,
    fileType: string,
    clientId: string,
  ): Promise<{ uploadUrl: string; s3Key: string }> {
    const s3Key = buildUploadKey(DocumentStorageService.documentPrefix(clientId), fileName);
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
}
