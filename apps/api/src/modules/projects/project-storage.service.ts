import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ProjectStorageService {
  private readonly logger = new Logger(ProjectStorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.getOrThrow<string>('S3_BUCKET');
    this.client = new S3Client({
      region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
    });
  }

  async uploadDocument(file: Express.Multer.File, projectId: string, docType: string): Promise<string> {
    const key = `projects/${projectId}/docs/${docType}/${Date.now()}_${file.originalname}`;
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

  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn });
  }

  async deleteDocument(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      this.logger.warn(`No se pudo eliminar ${key}: ${(err as Error).message}`);
    }
  }
}
