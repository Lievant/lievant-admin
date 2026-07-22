'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { RobotIcon } from '@/components/icons';
import { useCurrentUser } from '@/components/user-provider';
import { cn } from '@/lib/utils';
import { IsobotSidebar } from './isobot-sidebar';

interface MessageSource {
  documentId: string;
  title: string;
  macroprocess: string | null;
  s3Key: string | null;
  similarity: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: MessageSource[];
}

function welcomeMessage(name: string | undefined): ChatMessage {
  return {
    role: 'assistant',
    content: `¡Hola${name ? ` ${name}` : ''}! Soy ISOBOT, tu asistente para todo lo relacionado con el Sistema de Gestión de Seguridad de la Información de Lievant. Puedo ayudarte con políticas, procedimientos, formatos y cualquier duda sobre ISO 27001. ¿En qué te puedo ayudar?`,
  };
}

function IsobotAvatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-white">
      <RobotIcon className="h-4.5 w-4.5" />
    </div>
  );
}

function SourceChip({ source }: { source: MessageSource }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/isobot/documents/${source.documentId}/download`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { url: string };
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch {
      // silencioso — el documento puede no tener archivo asociado en S3
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      title={source.macroprocess ?? undefined}
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:border-terracota hover:text-terracota disabled:opacity-60"
    >
      📄 {source.title}
    </button>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex items-start gap-2">
      <IsobotAvatar />
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-white px-4 py-3 shadow-sm">
        <span className="text-sm text-slate-400">ISOBOT está pensando</span>
        <span className="flex gap-0.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300" />
        </span>
      </div>
    </div>
  );
}

export function IsobotScreen() {
  const user = useCurrentUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([welcomeMessage(user?.name)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/isobot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(conversationId ? { conversationId } : {}),
          message: trimmed,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
        throw new Error(message ?? 'Error al contactar a ISOBOT');
      }

      const data = (await res.json()) as { conversationId: string; answer: string; sources: MessageSource[] };
      setConversationId(data.conversationId);
      setMessages((prev) => [...prev, { role: 'assistant', content: data.answer, sources: data.sources }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al contactar a ISOBOT');
    } finally {
      setLoading(false);
    }
  }

  function handleSend() {
    sendMessage(input);
  }

  function handleExampleClick(text: string) {
    setInput(text);
    sendMessage(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-full overflow-hidden rounded-xl border border-slate-200 shadow-sm">
      <IsobotSidebar onSendExample={handleExampleClick} />

      <div className="flex flex-1 flex-col bg-slate-50">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-terracota text-white">
            <RobotIcon className="h-6 w-6" />
          </div>
          <div>
            <p className="font-bold text-navy">ISOBOT</p>
            <p className="text-xs text-slate-500">Asistente del Sistema de Gestión de Seguridad</p>
          </div>
        </div>

        {/* Mensajes */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {messages.map((msg, i) =>
            msg.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-terracota px-4 py-2.5 text-sm text-white">
                  {msg.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex items-start gap-2">
                <IsobotAvatar />
                <div className="max-w-[75%] space-y-2">
                  <div
                    className="rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 text-sm text-navy shadow-sm
                      prose prose-sm max-w-none text-navy
                      [&_strong]:font-semibold
                      [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1
                      [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mt-2 [&_h3]:mb-1
                      [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:space-y-1
                      [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:space-y-1
                      [&_p]:mb-2 [&_p:last-child]:mb-0
                      [&_hr]:border-slate-200 [&_hr]:my-2"
                  >
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {msg.sources.map((source, j) => (
                        <SourceChip key={j} source={source} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ),
          )}
          {loading && <ThinkingBubble />}
        </div>

        {error && (
          <div className="mx-5 mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Input */}
        <div className="flex items-end gap-2 border-t border-slate-200 bg-white px-4 py-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta sobre el SGSI…"
            rows={1}
            className="max-h-32 flex-1 resize-none rounded-md border border-slate-200 px-3 py-2 text-sm text-navy placeholder:text-slate-400 focus:border-terracota focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className={cn(
              'rounded-md px-4 py-2 text-sm font-semibold transition-colors',
              !loading && input.trim()
                ? 'bg-terracota text-white hover:bg-terracota-dark'
                : 'cursor-not-allowed bg-slate-100 text-slate-400',
            )}
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
