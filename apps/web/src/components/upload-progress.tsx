/**
 * Barra de progreso del PUT directo a S3. Se muestra solo mientras hay una
 * subida en curso; el progreso viene del evento onprogress de XMLHttpRequest.
 */
export function UploadProgress({ percent }: { percent: number }) {
  return (
    <div className="flex flex-col gap-1" aria-live="polite">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Subiendo archivo…</span>
        <span className="font-mono">{percent}%</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-black transition-[width] duration-150"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
