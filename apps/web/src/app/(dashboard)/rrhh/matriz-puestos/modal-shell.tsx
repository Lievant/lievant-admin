'use client';

import { CloseIcon } from '@/components/icons';

/**
 * Diálogo de la Matriz de Puestos y de Solicitud de Puesto: altura máxima del viewport, encabezado y pie fijos
 * y solo el cuerpo con scroll vertical (así los últimos campos y los botones Guardar / Cancelar siempre se
 * alcanzan, también en ventanas bajas y en móvil). Con `onSubmit` el cuerpo y el pie van dentro de un `<form>`.
 */
export function ModalShell({
  title,
  onClose,
  children,
  footer,
  onSubmit,
  maxWidth = 'max-w-xl',
  role = 'dialog',
}: {
  /** Sin título ni `onClose` no hay encabezado (los detalles de solicitud llevan el suyo en el cuerpo). */
  title?: React.ReactNode;
  onClose?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
  maxWidth?: string;
  role?: 'dialog' | 'alertdialog';
}) {
  const content = (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">{children}</div>
      {footer && <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-5 py-3 sm:px-6">{footer}</div>}
    </>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-3 sm:p-4">
      <div role={role} aria-modal="true" className={`flex max-h-[calc(100dvh-1.5rem)] w-full flex-col rounded-xl bg-white shadow-xl sm:max-h-[calc(100dvh-2rem)] ${maxWidth}`}>
        {(title || onClose) && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
          <h2 className="text-lg font-bold text-navy">{title}</h2>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <CloseIcon className="h-5 w-5" />
            </button>
          )}
        </div>
        )}
        {onSubmit ? (
          <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
            {content}
          </form>
        ) : (
          content
        )}
      </div>
    </div>
  );
}
