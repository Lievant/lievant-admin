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

@Injectable()
export class IsobotStorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.getOrThrow<string>('S3_BUCKET');
    this.client = new S3Client({
      region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
    });
  }

  async uploadDocument(buffer: Buffer, fileName: string, mimeType: string): Promise<string> {
    const key = `isobot/documents/${Date.now()}_${fileName}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ServerSideEncryption: 'aws:kms',
      }),
    );
    return key;
  }

  /** Prefijo de los documentos SGSI. Sirve además para validar pertenencia. */
  static documentPrefix(): string {
    return 'isobot/documents';
  }

  /**
   * URL prefirmada para subida directa del navegador a S3, sin pasar por la
   * compute de Amplify. Sin ServerSideEncryption explícito: aplica el default
   * del bucket y el navegador no tiene que mandar el header.
   */
  async getPresignedUploadUrl(
    fileName: string,
    fileType: string,
  ): Promise<{ uploadUrl: string; s3Key: string }> {
    const s3Key = buildUploadKey(IsobotStorageService.documentPrefix(), fileName);
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
   * Trae el objeto de vuelta como Buffer. A diferencia del resto de módulos, la
   * ingesta SGSI necesita los bytes para extraer texto y generar embeddings, así
   * que el upload directo evita el límite de Amplify pero no que el API cargue
   * el archivo en memoria.
   */
  async getObjectBuffer(key: string): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const bytes = await result.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }

  /** Borra el objeto al reemplazar o retirar un documento. */
  async deleteDocument(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async getPresignedUrl(key: string, fileName?: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ...(fileName ? { ResponseContentDisposition: `attachment; filename="${fileName}"` } : {}),
      }),
      { expiresIn },
    );
  }
}
