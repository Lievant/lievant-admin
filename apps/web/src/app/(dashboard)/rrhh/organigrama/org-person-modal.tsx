'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { CloseIcon } from '@/components/icons';
import { OrgPhoto } from './org-photo';
import { levelLabel } from './org-filters';
import type { OrgPerson } from './org-tree';

/** Solo dígitos (y un + inicial) para el enlace tel:. */
function telHref(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return `tel:${cleaned}`;
}

interface OrgPersonModalProps {
  person: OrgPerson;
  /** Solo con `rrhh.empleados.read`. */
  canOpenFile: boolean;
  /** Recorta el árbol para que parta de esta persona. */
  onFocus: (id: string) => void;
  onClose: () => void;
}

export function OrgPersonModal({ person, canOpenFile, onFocus, onClose }: OrgPersonModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={person.fullName}
      onClick={onClose}
    >
      <div className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
          aria-label="Cerrar"
        >
          <CloseIcon className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <OrgPhoto name={person.fullName} photoUrl={person.photoUrl} size={96} />
          <h2 className="mt-3 text-lg font-bold text-navy">{person.fullName}</h2>
          <p className="text-sm text-slate-600">{person.position}</p>
          {levelLabel(person.level) && <p className="mt-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{levelLabel(person.level)}</p>}
        </div>

        <dl className="mt-5 space-y-2 text-sm">
          {[
            ['Empresa', person.companyName],
            ['División', person.division],
            ['Área', person.area],
            ['Nivel', person.level ? person.level.trim().toUpperCase() : null],
          ].map(
            ([label, value]) =>
              value && (
                <div key={label} className="flex items-center justify-between gap-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
                  <dd className="text-right text-navy">{value}</dd>
                </div>
              ),
          )}
          {person.corporateEmail && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Correo</dt>
              <dd>
                <a href={`mailto:${person.corporateEmail}`} className="break-all text-black underline hover:text-zinc-700">
                  {person.corporateEmail}
                </a>
              </dd>
            </div>
          )}
          {person.phone && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Celular</dt>
              <dd>
                <a href={telHref(person.phone)} className="text-black underline hover:text-zinc-700">
                  {person.phone}
                </a>
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-6 flex flex-col gap-2">
          {canOpenFile && (
            <Link
              href={`/rrhh/empleados/${person.id}`}
              className="rounded-md bg-black px-4 py-2 text-center text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Ver Expediente Completo
            </Link>
          )}
          {person.children.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onFocus(person.id);
                onClose();
              }}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Ver desde Aquí
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
