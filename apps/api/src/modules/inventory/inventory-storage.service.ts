import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Una factura de garantía es un PDF o el escaneo/foto del comprobante. */
export const ALLOWED_WARRANTY_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;

@Injectable()
export class InventoryStorageService {
  private readonly logger = new Logger(InventoryStorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.getOrThrow<string>('S3_BUCKET');
    this.client = new S3Client({
      region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
    });
  }

  /**
   * Sube la factura de garantía. El timestamp en la llave evita que resubir el
   * mismo archivo pise la versión anterior, que podría seguir referenciada.
   */
  async uploadWarrantyInvoice(file: Express.Multer.File, equipmentId: string): Promise<string> {
    const key = `equipment/${equipmentId}/warranty/${Date.now()}_${file.originalname}`;
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

  /**
   * URL prefirmada de lectura. Devuelve null en vez de propagar el error: el
   * detalle del equipo no debe caerse porque una factura vieja ya no esté en el
   * bucket.
   */
  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string | null> {
    try {
      return await getSignedUrl(
        this.client,
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        { expiresIn },
      );
    } catch (err) {
      this.logger.warn(`No se pudo firmar la URL de ${key}: ${(err as Error).message}`);
      return null;
    }
  }
}
