import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { EmployeeStorageService } from './employee-storage.service';
import { EmployeePhoto } from './entities/employee-photo.entity';
import type { Readable } from 'stream';

const MAX_PHOTOS = 10;
const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 88;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

/** "Samantha Avina" + 2026-08-21 -> "samantha-avina-foto-2026-08-21.jpg" */
function buildPhotoFileName(fullName: string | null, uploadedAt: Date): string {
  const slug = (fullName ?? 'empleado')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const date = uploadedAt instanceof Date ? uploadedAt : new Date(uploadedAt);
  const stamp = Number.isNaN(date.getTime())
    ? new Date().toISOString().slice(0, 10)
    : date.toISOString().slice(0, 10);
  return `${slug || 'empleado'}-foto-${stamp}.jpg`;
}

@Injectable()
export class EmployeePhotosService {
  constructor(
    @InjectRepository(EmployeePhoto)
    private readonly photosRepository: Repository<EmployeePhoto>,
    private readonly storageService: EmployeeStorageService,
  ) {}

  async getPhotos(employeeId: string): Promise<(EmployeePhoto & { url: string })[]> {
    const photos = await this.photosRepository.find({
      where: { employeeId, deletedAt: IsNull() },
      order: { isProfile: 'DESC', uploadedAt: 'DESC' },
    });
    return Promise.all(
      photos.map(async (p) => ({
        ...p,
        url: await this.storageService.getPresignedUrl(p.s3Key, 3600),
      })),
    );
  }

  async uploadPhoto(
    employeeId: string,
    file: Express.Multer.File,
    uploadedBy: string,
  ): Promise<EmployeePhoto> {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException('Solo se permiten imágenes JPEG, PNG o WEBP');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('La foto no puede superar 5 MB');
    }

    const activeCount = await this.photosRepository.count({
      where: { employeeId, deletedAt: IsNull() },
    });
    if (activeCount >= MAX_PHOTOS) {
      throw new BadRequestException(`El empleado ya tiene ${MAX_PHOTOS} fotos. Elimina una antes de subir otra.`);
    }

    // Dynamic import of sharp to avoid build issues if not installed
    const sharp = (await import('sharp')).default;
    const processed = await sharp(file.buffer)
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer({ resolveWithObject: true });

    const { width, height } = processed.info;
    const buffer = processed.data;

    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const s3Key = `employees/${employeeId}/photos/${timestamp}_${safeName}.jpg`;

    await this.storageService.uploadBuffer(buffer, s3Key, 'image/jpeg');

    const isFirst = activeCount === 0;
    const photo = this.photosRepository.create({
      employeeId,
      s3Key,
      originalName: file.originalname,
      fileSize: buffer.length,
      width: width ?? null,
      height: height ?? null,
      isProfile: isFirst,
      uploadedBy,
    });

    return this.photosRepository.save(photo);
  }

  /**
   * Descarga la foto desde S3 en el servidor. El nombre sugerido usa el nombre
   * completo del empleado para que el archivo llegue identificable al usuario.
   */
  async downloadPhoto(
    employeeId: string,
    photoId: string,
  ): Promise<{ stream: Readable; contentType: string; fileName: string }> {
    const photo = await this.photosRepository.findOne({
      where: { id: photoId, employeeId, deletedAt: IsNull() },
      relations: { employee: true },
    });
    if (!photo) throw new NotFoundException('Foto no encontrada');

    const { stream, contentType } = await this.storageService.getObjectStream(photo.s3Key);
    return {
      stream,
      contentType,
      fileName: buildPhotoFileName(photo.employee?.fullName ?? null, photo.uploadedAt),
    };
  }

  async setProfilePhoto(employeeId: string, photoId: string): Promise<EmployeePhoto> {
    const photo = await this.photosRepository.findOne({
      where: { id: photoId, employeeId, deletedAt: IsNull() },
    });
    if (!photo) throw new NotFoundException('Foto no encontrada');

    await this.photosRepository.update(
      { employeeId, deletedAt: IsNull() },
      { isProfile: false },
    );
    photo.isProfile = true;
    return this.photosRepository.save(photo);
  }

  async deletePhoto(employeeId: string, photoId: string): Promise<void> {
    const photo = await this.photosRepository.findOne({
      where: { id: photoId, employeeId, deletedAt: IsNull() },
    });
    if (!photo) throw new NotFoundException('Foto no encontrada');

    await this.photosRepository.softDelete(photoId);

    // If the deleted photo was the profile, promote the newest remaining
    if (photo.isProfile) {
      const next = await this.photosRepository.findOne({
        where: { employeeId, deletedAt: IsNull() },
        order: { uploadedAt: 'DESC' },
      });
      if (next) {
        next.isProfile = true;
        await this.photosRepository.save(next);
      }
    }
  }

  async getProfilePhotoUrl(employeeId: string): Promise<string | null> {
    const photo = await this.photosRepository.findOne({
      where: { employeeId, isProfile: true, deletedAt: IsNull() },
    });
    if (!photo) return null;
    return this.storageService.getPresignedUrl(photo.s3Key, 3600);
  }
}
