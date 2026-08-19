import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';

/**
 * Tope de tamaño para uploads directos a S3 vía URL prefirmada. Se valida en el
 * presign (con el tamaño declarado) y otra vez al registrar el documento (con el
 * tamaño real del objeto en S3), porque el navegador puede mentir.
 */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/** Vigencia de la URL de subida. Suficiente para un archivo grande en red lenta. */
export const UPLOAD_URL_TTL_SECONDS = 300;

/**
 * Deja el nombre de archivo en algo seguro como sufijo de una key de S3: sin
 * rutas, sin caracteres de control y sin separadores que puedan reubicar el
 * objeto fuera del prefijo del módulo.
 */
export function sanitizeFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    .replace(/[^\w.\-\s]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._]+/, '')
    .slice(0, 120);

  if (!cleaned || cleaned === '.') {
    throw new BadRequestException('Nombre de archivo no válido');
  }

  return cleaned;
}

/** Construye la key definitiva: prefijo del módulo + uuid + timestamp + nombre. */
export function buildUploadKey(prefix: string, fileName: string): string {
  return `${prefix}/${randomUUID()}/${Date.now()}-${sanitizeFileName(fileName)}`;
}

/**
 * Valida tipo y tamaño declarados antes de firmar. Es la única barrera previa a
 * que el archivo entre al bucket, porque en el flujo directo el API ya no ve el
 * contenido: sin esto la allowlist de MIME types dejaría de aplicar.
 */
export function assertUploadAllowed(
  fileType: string,
  fileSize: number,
  allowedMimeTypes: readonly string[],
): void {
  if (!allowedMimeTypes.includes(fileType)) {
    throw new BadRequestException(`Tipo de archivo no permitido: ${fileType}`);
  }

  if (!Number.isInteger(fileSize) || fileSize <= 0) {
    throw new BadRequestException('El tamaño del archivo no es válido');
  }

  if (fileSize > MAX_UPLOAD_BYTES) {
    throw new BadRequestException(
      `El archivo no puede superar ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB`,
    );
  }
}

/**
 * Verifica que una key entregada por el cliente caiga dentro del prefijo del
 * módulo. Sin esto, quien obtiene un presign de un módulo podría registrar el
 * objeto como documento de otro, o reclamar una key ajena.
 */
export function assertKeyInPrefix(s3Key: string, prefix: string): void {
  if (!s3Key.startsWith(`${prefix}/`) || s3Key.includes('..')) {
    throw new BadRequestException('La referencia del archivo no es válida');
  }
}
