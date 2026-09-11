'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Brand } from '@/lib/api';
import { deleteBrandAction, updateBrandAction } from './actions';

/**
 * Confirmación de borrado. Se avisa de los proyectos porque la marca es la
 * referencia con la que se factura: quien la borra debe saber que hay trabajo
 * enganchado a ella, aunque la baja sea lógica y no rompa nada.
 */
function DeleteBrandDialog({
  brandName,
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  brandName: string;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="eliminar-marca-titulo"
    >
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 id="eliminar-marca-titulo" className="text-base font-semibold text-navy">
          ¿Eliminar la marca {brandName}?
        </h3>
        <p className="mt-3 text-sm text-slate-600">
          Si tiene proyectos asociados, estos perderán la referencia a esta marca.
        </p>

        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:border-slate-300 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? 'Eliminando…' : 'Sí, eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Chip de marca con edición en sitio y borrado.
 *
 * El nombre se edita dentro del propio chip en lugar de abrir un diálogo:
 * cambiar una palabra no justifica un modal, y así la lista no se mueve.
 */
export function BrandChip({ clientId, brand }: { clientId: string; brand: Brand }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(brand.name);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  // Evita que el blur guarde una segunda vez lo que Enter ya envió.
  const guardado = useRef(false);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  // El nombre vuelve del servidor tras revalidatePath: se sincroniza para que
  // un guardado fallido no deje el chip mostrando texto que no se persistió.
  useEffect(() => {
    setName(brand.name);
  }, [brand.name]);

  function guardar() {
    if (guardado.current) return;
    guardado.current = true;

    const limpio = name.trim();
    if (!limpio || limpio === brand.name) {
      setName(brand.name);
      setEditing(false);
      guardado.current = false;
      return;
    }

    startTransition(async () => {
      const res = await updateBrandAction(clientId, brand.id, limpio);
      if (res.success) {
        setEditing(false);
        router.refresh();
      } else {
        setError(res.error ?? 'No se pudo renombrar la marca.');
        setName(brand.name);
        setEditing(false);
      }
      guardado.current = false;
    });
  }

  function cancelar() {
    guardado.current = true;
    setName(brand.name);
    setEditing(false);
    // Se libera en el siguiente tick para que el blur que dispara Escape no
    // entre a guardar.
    setTimeout(() => {
      guardado.current = false;
    }, 0);
  }

  function runDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteBrandAction(clientId, brand.id);
      if (res.success) {
        setConfirming(false);
        router.refresh();
      } else {
        setError(res.error ?? 'No se pudo eliminar la marca.');
      }
    });
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={guardar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            guardar();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelar();
          }
        }}
        disabled={isPending}
        aria-label={`Nombre de la marca ${brand.name}`}
        className="rounded-full border border-slate-300 bg-white px-2 py-1 text-xs text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black disabled:opacity-60"
      />
    );
  }

  return (
    <>
      <span className="group flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
        {name}
        <button
          type="button"
          onClick={() => {
            setError(null);
            setEditing(true);
          }}
          title="Renombrar marca"
          aria-label={`Renombrar la marca ${brand.name}`}
          className="ml-0.5 text-slate-400 transition-colors hover:text-navy"
        >
          {/* Lápiz en SVG inline: icons.tsx no tiene uno y no vale la pena
              añadirlo al set compartido por un único uso. */}
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden="true">
            <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-8.5 8.5a1 1 0 0 1-.44.26l-3 .857a.5.5 0 0 1-.618-.618l.857-3a1 1 0 0 1 .26-.44l8.5-8.5Z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
          title="Eliminar marca"
          aria-label={`Eliminar la marca ${brand.name}`}
          className="text-slate-400 transition-colors hover:text-red-500"
        >
          ×
        </button>
      </span>

      {/* Un fallo al renombrar no tiene dónde mostrarse una vez cerrado el
          input, así que el aviso cuelga del chip. */}
      {error && !confirming && <span className="text-xs text-rose-600">{error}</span>}

      {confirming && (
        <DeleteBrandDialog
          brandName={brand.name}
          pending={isPending}
          error={error}
          onConfirm={runDelete}
          onCancel={() => {
            setConfirming(false);
            setError(null);
          }}
        />
      )}
    </>
  );
}
