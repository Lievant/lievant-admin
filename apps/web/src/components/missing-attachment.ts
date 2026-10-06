/**
 * Mensaje para el botón de enviar cuando faltan adjuntos. `hasAttachment` va en
 * el orden de las líneas; null si todas tienen adjunto.
 */
export function describeMissingAttachment(hasAttachment: boolean[], hint: string): string | null {
  const missing = hasAttachment.flatMap((ok, i) => (ok ? [] : [`#${i + 1}`]));
  if (missing.length === 0) return null;
  const total = hasAttachment.length;
  const plural = missing.length === 1 ? '' : 's';
  return `${missing.length} de ${total} línea${plural} sin adjunto (imagen o documento): ${missing.join(', ')}. ${hint}`;
}
