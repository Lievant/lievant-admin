import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildUploadKey, UPLOAD_URL_TTL_SECONDS } from '../../common/s3-upload.util';

export const ALLOWED_INVOICE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const;

@Injectable()
export class ExpensesStorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.getOrThrow<string>('S3_BUCKET');
    this.client = new S3Client({
      region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
    });
  }

  async uploadInvoice(
    file: Express.Multer.File,
    reportId: string,
    lineId: string,
  ): Promise<string> {
    const key = `expenses/${reportId}/${lineId}/${Date.now()}_${file.originalname}`;
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

  /** Prefijo de la factura de una línea. Sirve además para validar pertenencia. */
  static invoicePrefix(reportId: string, lineId: string): string {
    return `expenses/${reportId}/${lineId}`;
  }

  /**
   * URL prefirmada para subida directa del navegador a S3, sin pasar por la
   * compute de Amplify. Sin ServerSideEncryption explícito: aplica el default
   * del bucket y el navegador no tiene que mandar el header.
   */
  async getPresignedUploadUrl(
    fileName: string,
    fileType: string,
    reportId: string,
    lineId: string,
  ): Promise<{ uploadUrl: string; s3Key: string }> {
    const s3Key = buildUploadKey(
      ExpensesStorageService.invoicePrefix(reportId, lineId),
      fileName,
    );
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

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn,
    });
  }
}
