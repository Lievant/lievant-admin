/**
 * Upload en 3 pasos: se pide una URL prefirmada al API, el navegador hace PUT
 * directo a S3 y luego se registra el objeto.
 *
 * El PUT no pasa por la compute de Amplify, que es la capa que corta los
 * requests grandes: por eso el archivo va directo a S3 y no por el proxy.
 */

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = '20 MB';

/** Mensaje único para el rechazo por tamaño, antes de intentar subir nada. */
export function validateUploadSize(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) {
    return `El archivo no puede superar ${MAX_UPLOAD_LABEL}.`;
  }
  return null;
}

interface PresignedTarget {
  uploadUrl: string;
  s3Key: string;
}

async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  if (!body?.message) return fallback;
  return Array.isArray(body.message) ? body.message.join(', ') : body.message;
}

/** Paso 1: pide la URL prefirmada al proxy del módulo. */
async function requestPresignedUrl(presignUrl: string, file: File): Promise<PresignedTarget> {
  const res = await fetch(presignUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      fileSize: file.size,
    }),
  });

  if (!res.ok) {
    throw new Error(await readError(res, 'No se pudo preparar la subida del archivo.'));
  }

  return (await res.json()) as PresignedTarget;
}

/**
 * Paso 2: PUT directo a S3. Se usa XMLHttpRequest y no fetch porque es la única
 * forma de leer el progreso de subida (fetch no expone upload progress).
 */
function putToS3(
  uploadUrl: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }
      reject(new Error(`S3 rechazó la subida (HTTP ${xhr.status}).`));
    };

    // Un fallo de CORS llega aquí sin detalle: el navegador no expone el motivo.
    xhr.onerror = () =>
      reject(new Error('No se pudo subir el archivo a S3. Revisa la configuración CORS del bucket.'));
    xhr.onabort = () => reject(new Error('Subida cancelada.'));

    xhr.send(file);
  });
}

/** Paso 3: avisa al API que el objeto ya está en S3 para que lo registre. */
async function registerUpload<T>(
  registerUrl: string,
  payload: Record<string, unknown>,
  method: 'POST' | 'PUT',
): Promise<T> {
  const res = await fetch(registerUrl, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await readError(res, 'No se pudo registrar el documento.'));
  }

  return (await res.json()) as T;
}

export interface UploadViaPresignedUrlOptions {
  /** Proxy que devuelve { uploadUrl, s3Key }. */
  presignUrl: string;
  /** Proxy que registra el documento ya subido. */
  registerUrl: string;
  /** PUT para los reemplazos (isobot); POST para altas. */
  registerMethod?: 'POST' | 'PUT';
  file: File;
  /** Campos extra del registro (documentType, name, title…). */
  extra?: Record<string, unknown>;
  onProgress?: (percent: number) => void;
}

/**
 * Orquesta los 3 pasos. Lanza Error con mensaje listo para mostrar; valida el
 * tamaño antes de tocar la red para no hacer esperar al usuario por un rechazo.
 */
export async function uploadViaPresignedUrl<T>({
  presignUrl,
  registerUrl,
  registerMethod = 'POST',
  file,
  extra = {},
  onProgress,
}: UploadViaPresignedUrlOptions): Promise<T> {
  const sizeError = validateUploadSize(file);
  if (sizeError) throw new Error(sizeError);

  const { uploadUrl, s3Key } = await requestPresignedUrl(presignUrl, file);
  await putToS3(uploadUrl, file, onProgress);

  return registerUpload<T>(
    registerUrl,
    {
      ...extra,
      s3Key,
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      fileSize: file.size,
    },
    registerMethod,
  );
}
