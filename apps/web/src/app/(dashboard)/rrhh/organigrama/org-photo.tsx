'use client';

import { useState } from 'react';
import { avatarColor, initials } from '@/lib/avatar';

/**
 * Foto del empleado con respaldo de iniciales. Usa la ruta de avatares del
 * sistema (que cachea Microsoft Graph); la imagen carga de forma diferida y, si
 * falla o no hay correo, se muestra un círculo con las iniciales.
 */
export function OrgPhoto({
  name,
  photoUrl,
  size,
}: {
  name: string;
  photoUrl: string | null;
  /** Diámetro en píxeles. */
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size / 3)) };

  if (photoUrl && !failed) {
    return (
      <img
        src={photoUrl}
        alt={name}
        loading="lazy"
        draggable={false}
        onError={() => setFailed(true)}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ ...style, backgroundColor: avatarColor(name) }}
    >
      {initials(name)}
    </span>
  );
}
