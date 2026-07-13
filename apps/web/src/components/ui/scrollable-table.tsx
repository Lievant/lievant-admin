'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface ScrollableTableProps {
  children: React.ReactNode;
  /** Clases del contenedor externo (márgenes/espaciado). */
  className?: string;
  /** Clases del contenedor con scroll que envuelve la tabla (borde, fondo, etc.). */
  bodyClassName?: string;
}

/**
 * Tabla con scroll horizontal sincronizado: una barra espejo arriba y la barra
 * real abajo. Útil en grids anchos para no tener que hacer scroll vertical hasta
 * el final para mover la tabla horizontalmente.
 */
export function ScrollableTable({ children, className, bodyClassName }: ScrollableTableProps) {
  const topRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);

  // Sincroniza el scroll horizontal entre la barra superior y la tabla.
  useEffect(() => {
    const top = topRef.current;
    const body = bodyRef.current;
    if (!top || !body) return;

    let lock = false;
    const fromTop = () => {
      if (lock) return;
      lock = true;
      body.scrollLeft = top.scrollLeft;
      lock = false;
    };
    const fromBody = () => {
      if (lock) return;
      lock = true;
      top.scrollLeft = body.scrollLeft;
      lock = false;
    };

    top.addEventListener('scroll', fromTop, { passive: true });
    body.addEventListener('scroll', fromBody, { passive: true });
    return () => {
      top.removeEventListener('scroll', fromTop);
      body.removeEventListener('scroll', fromBody);
    };
  }, []);

  // Mantiene el ancho del espejo igual al ancho real de la tabla.
  useEffect(() => {
    const body = bodyRef.current;
    const mirror = mirrorRef.current;
    if (!body || !mirror) return;

    const update = () => {
      mirror.style.width = `${body.scrollWidth}px`;
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(body);
    const inner = body.firstElementChild;
    if (inner) observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={className}>
      {/* Barra de scroll superior (espejo) */}
      <div ref={topRef} className="overflow-x-auto" aria-hidden="true">
        <div ref={mirrorRef} style={{ height: 1 }} />
      </div>
      {/* Tabla con barra de scroll inferior */}
      <div ref={bodyRef} className={cn('overflow-x-auto', bodyClassName)}>
        {children}
      </div>
    </div>
  );
}
