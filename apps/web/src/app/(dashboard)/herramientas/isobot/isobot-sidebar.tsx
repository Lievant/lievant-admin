'use client';

import { useState } from 'react';
import { IsobotDocumentLibrary } from './isobot-document-library';

const EXAMPLE_QUESTIONS = [
  '¿Cómo reporto un incidente de seguridad?',
  '¿Qué hago si pierdo mi laptop?',
  '¿Cuál es la política de contraseñas?',
  '¿Cómo solicito acceso a un sistema?',
];

export function IsobotSidebar({ onSendExample }: { onSendExample: (text: string) => void }) {
  const [libraryOpen, setLibraryOpen] = useState(false);

  return (
    <div className="relative flex w-80 shrink-0 flex-col overflow-y-auto bg-navy px-6 py-8">
      <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-terracota opacity-10" />
      <div className="pointer-events-none absolute bottom-24 -left-20 h-64 w-64 rounded-full bg-terracota opacity-10" />

      <div className="relative flex flex-col items-center text-center">
        <span className="rounded-full bg-terracota px-3 py-1 text-xs font-semibold tracking-wide text-white uppercase">
          ISO 27001 · SGSI
        </span>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/isobot.png"
          className="mt-6 h-48 w-48 object-contain drop-shadow-2xl"
          alt="ISOBOT"
          style={{ filter: 'drop-shadow(0 8px 24px rgba(45,212,191,0.3))' }}
        />

        <h1 className="mt-4 text-2xl font-bold text-white">ISOBOT</h1>
        <p className="mt-1 text-sm text-slate-400">Asistente del SGSI ISO 27001</p>

        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          className="mt-6 w-full rounded-md bg-terracota px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-terracota-dark"
        >
          📚 Biblioteca de documentos
        </button>
      </div>

      <div className="relative mt-8 border-t border-white/10 pt-6">
        <p className="text-sm font-semibold text-white">💡 Prueba preguntando…</p>
        <div className="mt-3 space-y-2">
          {EXAMPLE_QUESTIONS.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => onSendExample(question)}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-slate-300 transition-colors hover:border-terracota hover:text-white"
            >
              {question}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-auto pt-6 text-center text-xs font-medium text-teal">
        364 documentos · 14 macroprocesos
      </div>

      {libraryOpen && <IsobotDocumentLibrary onClose={() => setLibraryOpen(false)} />}
    </div>
  );
}
