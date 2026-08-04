'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Booking } from '@/lib/api';
import { CloseIcon } from '@/components/icons';
import { cancelBookingAction } from '../actions';

interface CancelBookingDialogProps {
  booking: Booking;
  onClose: () => void;
}

export function CancelBookingDialog({ booking, onClose }: CancelBookingDialogProps) {
  const router = useRouter();
  const [cancelSeries, setCancelSeries] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await cancelBookingAction(booking.id, { cancel_series: cancelSeries });
      if (result.success) {
        router.refresh();
        onClose();
      } else {
        setError(result.error ?? 'No se pudo cancelar la reserva.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-navy">Cancelar reserva</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {booking.isRecurring ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">¿Cancelar solo esta fecha o toda la serie?</p>
              <label className="flex items-center gap-2 text-sm text-navy">
                <input
                  type="radio"
                  name="cancel-scope"
                  checked={!cancelSeries}
                  onChange={() => setCancelSeries(false)}
                />
                Solo esta fecha
              </label>
              <label className="flex items-center gap-2 text-sm text-navy">
                <input
                  type="radio"
                  name="cancel-scope"
                  checked={cancelSeries}
                  onChange={() => setCancelSeries(true)}
                />
                Toda la serie
              </label>
            </div>
          ) : (
            <p className="text-sm text-slate-600">¿Seguro que deseas cancelar esta reserva?</p>
          )}

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {isPending ? 'Cancelando…' : 'Cancelar reserva'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
