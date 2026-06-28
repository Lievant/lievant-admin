'use client';

import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface EmployeePhoto {
  id: string;
  s3Key: string;
  originalName: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  isProfile: boolean;
  uploadedAt: string;
  url: string;
}

interface PhotosTabProps {
  employeeId: string;
  canWrite: boolean;
}

const MAX_PHOTOS = 10;

export function PhotosTab({ employeeId, canWrite }: PhotosTabProps) {
  const [photos, setPhotos] = useState<EmployeePhoto[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadPhotos() {
    const res = await fetch(`/api/employees/${employeeId}/photos`);
    if (res.ok) {
      const data = (await res.json()) as EmployeePhoto[];
      setPhotos(data);
    }
    setLoaded(true);
  }

  if (!loaded) {
    void loadPhotos();
  }

  async function handleUpload(file: File) {
    if (photos.length >= MAX_PHOTOS) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/employees/${employeeId}/photos`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        setError(body.message ?? 'Error al subir la foto');
      } else {
        await loadPhotos();
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSetProfile(photoId: string) {
    const res = await fetch(`/api/employees/${employeeId}/photos/${photoId}/profile`, {
      method: 'PATCH',
    });
    if (res.ok) await loadPhotos();
  }

  async function handleDelete(photoId: string) {
    const res = await fetch(`/api/employees/${employeeId}/photos/${photoId}`, {
      method: 'DELETE',
    });
    if (res.ok) await loadPhotos();
  }

  const atLimit = photos.length >= MAX_PHOTOS;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {photos.length} de {MAX_PHOTOS} fotos
        </p>
        {canWrite && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
              }}
            />
            <button
              type="button"
              disabled={atLimit || uploading}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'rounded-md px-4 py-2 text-sm font-medium transition-colors',
                atLimit || uploading
                  ? 'cursor-not-allowed border border-slate-200 text-slate-400'
                  : 'border border-slate-200 text-slate-600 hover:border-slate-300',
              )}
            >
              {uploading ? 'Subiendo…' : atLimit ? 'Límite alcanzado (10)' : '+ Subir foto'}
            </button>
          </>
        )}
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {photos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-400">
          No hay fotos. {canWrite && 'Usa el botón para subir la primera.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className={cn(
                'group relative overflow-hidden rounded-xl border bg-slate-50',
                photo.isProfile ? 'border-terracota ring-2 ring-terracota/20' : 'border-slate-200',
              )}
            >
              <div className="aspect-square">
                <PhotoImage url={photo.url} name={photo.originalName} />
              </div>

              {photo.isProfile && (
                <div className="absolute left-2 top-2 rounded-full bg-terracota px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                  Perfil
                </div>
              )}

              {canWrite && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  {!photo.isProfile && (
                    <button
                      type="button"
                      onClick={() => void handleSetProfile(photo.id)}
                      className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-navy hover:bg-slate-100"
                    >
                      Usar como perfil
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleDelete(photo.id)}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PhotoImage({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xs text-slate-400 px-2 text-center">
        {name}
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={name}
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}
