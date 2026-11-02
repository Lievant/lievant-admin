import { parseTextBlocks } from './positions-constants';

/** Muestra el texto guardado con formato legible (viñetas y párrafos). Solo se renderiza texto: nunca se inyecta HTML. */
export function FormattedText({ text, className }: { text: string | null | undefined; className?: string }) {
  const blocks = parseTextBlocks(text);
  if (blocks.length === 0) return <p className={className}>—</p>;
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      {blocks.map((b, i) =>
        b.kind === 'list' ? (
          <ul key={i} className="list-disc space-y-0.5 pl-5">
            {b.items.map((it, j) => <li key={j} className="break-words">{it}</li>)}
          </ul>
        ) : (
          <p key={i} className="break-words">{b.text}</p>
        ),
      )}
    </div>
  );
}
