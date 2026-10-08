'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Compartido por Mis Gastos de Tarjeta y Mis Reembolsos. Única fuente de la
 * explicación de cada tipo de gasto (llaves = nombres exactos del catálogo,
 * en el orden en que se muestran en el panel).
 */
const EXPENSE_TYPE_INFO: [string, string][] = [
  ['Viáticos cliente', 'Este costo lo asume directamente el cliente'],
  ['Costo operativo', 'Este gasto lo asume el área operativa'],
  ['Costo de Marketing', 'Costos relacionados al tema de marketing'],
  ['Costo de venta / temas comerciales', 'Área de la división'],
];

const PANEL_WIDTH = 352;
const PANEL_GAP = 6;
const VIEWPORT_MARGIN = 8;

/**
 * "i" del encabezado de Tipo de Gasto. El panel va en un portal con posición
 * fija para que el contenedor con scroll horizontal de la tabla no lo recorte.
 * Abre con hover, foco o clic/tap; cierra al salir, con clic fuera o Escape.
 */
export function ExpenseTypeHint() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: PANEL_WIDTH });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelId = useId();

  const place = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
    const centered = rect.left + rect.width / 2 - width / 2;
    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(centered, window.innerWidth - width - VIEWPORT_MARGIN),
    );
    setPos({ top: rect.bottom + PANEL_GAP, left, width });
  }, []);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const openNow = () => {
    cancelClose();
    place();
    setOpen(true);
  };
  // Pequeño retraso: deja pasar el mouse del ícono al panel sin que parpadee.
  const closeSoon = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    // Con scroll (de la página o de la tabla) el panel sigue pegado al ícono.
    const onMove = () => place();

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open, place]);

  useEffect(() => cancelClose, []);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Ver detalle de cada tipo de gasto"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onMouseEnter={openNow}
        onMouseLeave={closeSoon}
        onFocus={openNow}
        onBlur={closeSoon}
        // Solo abre: en táctil el tap dispara mouseenter y luego click, y un
        // toggle lo cerraría en el acto.
        onClick={openNow}
        className="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black"
      >
        i
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="tooltip"
            onMouseEnter={cancelClose}
            onMouseLeave={closeSoon}
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            className="fixed z-50 rounded-md border border-slate-200 bg-white p-3 text-xs font-normal normal-case tracking-normal text-slate-600 shadow-lg"
          >
            <ul className="space-y-1.5">
              {EXPENSE_TYPE_INFO.map(([name, text]) => (
                <li key={name}>
                  <strong className="font-semibold text-navy">{name}</strong> - {text}
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
}
