/** Vida de la URL prefirmada de lectura: lo justo para que el navegador siga la redirección. */
export const READ_URL_TTL_SECONDS = 60;

export type FileDisposition = 'inline' | 'attachment';

export const MIME_BY_FILE_TYPE: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/** Tipo del archivo: el guardado o, en documentos sembrados sin él, la extensión del nombre. */
export function fileTypeOf(fileType: string | null, fileName: string): string | null {
  const type = (fileType ?? fileName.split('.').pop() ?? '').toLowerCase();
  return type in MIME_BY_FILE_TYPE ? type : null;
}

/**
 * Nombre con el que se descarga. `file_name` se conserva al reemplazar un
 * documento aunque el archivo nuevo sea de otro tipo (un .pdf reemplazado por un
 * .docx), así que se corrige la extensión para que coincida con el contenido.
 */
export function downloadFileName(fileName: string, fileType: string | null): string {
  if (!fileType) return fileName;
  const suffix = `.${fileType}`;
  if (fileName.toLowerCase().endsWith(suffix)) return fileName;
  const withoutKnownExt = fileName.replace(/\.(pdf|docx|xlsx)$/i, '');
  return `${withoutKnownExt}${suffix}`;
}

/**
 * Valor de `Content-Disposition` con el nombre bien codificado: un respaldo ASCII
 * en `filename` para clientes viejos y el nombre real en `filename*=UTF-8''…`
 * (RFC 5987), que es el que usan los navegadores actuales.
 */
export function buildContentDisposition(disposition: FileDisposition, fileName: string): string {
  const name = fileName.replace(/[\r\n]+/g, ' ').trim() || 'documento';
  const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, '_');
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
