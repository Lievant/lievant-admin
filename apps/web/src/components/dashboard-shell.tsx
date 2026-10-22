'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import type { CurrentUser } from '@/lib/api';

const DRAWER_ID = 'dashboard-sidebar';
const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Estructura del dashboard. En escritorio (lg, 1024 px) el sidebar es el de
 * siempre. Por debajo, el sidebar no ocupa espacio: una barra superior con la
 * hamburguesa lo abre como panel superpuesto con fondo oscurecido.
 *
 * Es el mismo componente `Sidebar` (una sola instancia, mismos permisos, ítem
 * activo e insignias): solo cambia cómo se posiciona. Se cierra con el fondo,
 * Escape, la X y al navegar; mientras está abierto la página de atrás no hace
 * scroll y el foco se queda dentro del panel.
 */
export function DashboardShell({ user, children }: { user: CurrentUser | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  const close = useCallback(() => setOpen(false), []);

  // Al navegar a otra ruta se cierra.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Al pasar a escritorio no puede quedar abierto ni bloqueando el scroll.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Escape, bloqueo del scroll de la página y trampa de foco mientras está abierto.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    const focusables = () => (panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)) : []);
    // El panel pasa de invisible a visible con una transición: hasta que arranca no
    // admite foco, así que se reintenta unos instantes hasta lograrlo (la X, el primer elemento).
    let attempts = 0;
    const focusTimer = window.setInterval(() => {
      focusables()[0]?.focus();
      attempts += 1;
      if (attempts >= 15 || panel?.contains(document.activeElement)) window.clearInterval(focusTimer);
    }, 40);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel?.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearInterval(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Al cerrar, el foco vuelve a la hamburguesa.
  useEffect(() => {
    if (wasOpen.current && !open) menuButtonRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <>
      {/* Barra superior: solo en móvil y tablet. */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 bg-black px-4 text-white lg:hidden">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir Menú"
          aria-expanded={open}
          aria-controls={DRAWER_ID}
          className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <img src="/images/lievant-isotipo.png" alt="Lievant" className="h-7 w-auto" />
      </header>

      {/* Fondo oscurecido del panel (solo móvil y tablet). */}
      <div
        onClick={close}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 motion-reduce:transition-none lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <div ref={panelRef} className="contents">
        <Sidebar user={user} id={DRAWER_ID} open={open} onClose={close} />
      </div>

      <main className="min-w-0 flex-1 overflow-y-auto pt-14 max-lg:overflow-x-hidden lg:pt-0 dashboard-main">{children}</main>
    </>
  );
}
