'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EyeIcon } from '@/components/icons';

const MENU_WIDTH = 256;
const MENU_GAP = 4;
const VIEWPORT_MARGIN = 8;

interface DocumentFileMenuProps {
  documentId: string;
  title: string;
  fileType: string | null;
  /** El documento tiene archivo en S3 (sin exponer la clave). */
  hasFile: boolean;
}

/**
 * Ojito de la columna de acciones: menú con "Ver en otra pestaña" (solo PDF) y
 * "Descargar". Los dos son enlaces a la proxy route, que redirige a una URL
 * prefirmada de vida corta; así "Ver" abre la pestaña sin bloqueo de ventanas
 * emergentes. El menú va en un portal para que la tabla no lo recorte.
 */
export function DocumentFileMenu({ documentId, title, fileType, hasFile }: DocumentFileMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const href = (disposition: 'inline' | 'attachment') =>
    `/api/isobot/admin/documents/${documentId}/file?disposition=${disposition}`;
  const isPdf = fileType?.toLowerCase() === 'pdf';

  function place() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Alineado al borde derecho del botón (la columna está a la derecha de la tabla).
    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN),
    );
    setPos({ top: rect.bottom + MENU_GAP, left });
  }

  function close(returnFocus = false) {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  // Al abrir, el foco pasa al primer elemento activo del menú.
  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>('a[role="menuitem"]')?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    // Con scroll o cambio de tamaño el menú se cierra en vez de quedar suelto.
    const onMove = () => setOpen(false);
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open]);

  function onMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('a[role="menuitem"]') ?? []);
    const current = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(current + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(current - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  }

  const buttonClass =
    'rounded-md border border-slate-200 p-1.5 text-slate-500 hover:border-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy';

  if (!hasFile) {
    return (
      <button
        type="button"
        disabled
        title="Archivo no disponible"
        aria-label="Archivo no disponible"
        className={`${buttonClass} cursor-not-allowed opacity-40`}
      >
        <EyeIcon className="h-4 w-4" />
      </button>
    );
  }

  const itemClass =
    'block rounded-md px-3 py-2 text-sm text-navy hover:bg-slate-100 focus:bg-slate-100 focus:outline-none';

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        title="Ver documento"
        aria-label="Ver documento"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          place();
          setOpen((o) => !o);
        }}
        className={buttonClass}
      >
        <EyeIcon className="h-4 w-4" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={`Opciones de ${title}`}
            onKeyDown={onMenuKeyDown}
            style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
            className="fixed z-50 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
          >
            {isPdf ? (
              <a
                role="menuitem"
                href={href('inline')}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => close()}
                className={itemClass}
              >
                Ver en otra pestaña
              </a>
            ) : (
              <div className="px-3 py-2" aria-disabled="true">
                <p className="text-sm text-slate-400">Ver en otra pestaña</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Word y Excel no se pueden previsualizar en el navegador
                </p>
              </div>
            )}
            <a role="menuitem" href={href('attachment')} onClick={() => close()} className={itemClass}>
              Descargar
            </a>
          </div>,
          document.body,
        )}
    </>
  );
}
