'use client';

import { useEffect, useState } from 'react';

interface ZenQuote {
  q: string;
  a: string;
}

const FALLBACK: ZenQuote = {
  q: 'El éxito es la suma de pequeños esfuerzos repetidos día a día.',
  a: 'Robert Collier',
};

export function QuoteWidget() {
  const [quote, setQuote] = useState<ZenQuote>(FALLBACK);

  useEffect(() => {
    fetch('/api/quote')
      .then((r) => r.json() as Promise<ZenQuote[]>)
      .then((data) => {
        if (data?.[0]?.q) setQuote({ q: data[0].q, a: data[0].a });
      })
      .catch(() => {});
  }, []);

  return (
    <blockquote className="border-l-2 border-terracota pl-3">
      <p className="text-xs italic text-slate-500 leading-relaxed">"{quote.q}"</p>
      <cite className="mt-1 block text-xs text-slate-400 not-italic">— {quote.a}</cite>
    </blockquote>
  );
}
