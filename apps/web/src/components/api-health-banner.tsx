'use client';

import { useApiHealth } from '@/hooks/use-api-health';

export function ApiHealthBanner() {
  const { status, retry } = useApiHealth(30000);

  if (status === 'ok' || status === 'checking') return null;

  const isOffline = status === 'offline';

  return (
    <div
      role="alert"
      className={`fixed inset-x-0 top-0 z-[9999] flex items-center justify-center gap-3 px-4 py-2 text-sm font-medium transition-all duration-300 ${
        isOffline
          ? 'bg-red-600 text-white'
          : 'bg-amber-400 text-amber-900'
      }`}
    >
      <span>
        {isOffline
          ? 'Sin conexión con el servidor. Algunos datos pueden no estar actualizados.'
          : 'Verificando conectividad con el servidor…'}
      </span>
      {isOffline && (
        <button
          onClick={() => { void retry(); }}
          className="rounded border border-white/40 bg-white/20 px-3 py-0.5 text-xs font-semibold hover:bg-white/30 transition-colors"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
