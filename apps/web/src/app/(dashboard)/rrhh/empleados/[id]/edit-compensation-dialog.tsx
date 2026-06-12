'use client';

import { useState, useTransition } from 'react';
import type { EmployeeCompensation, EmployeeDetail, UpdateCompensationPayload } from '@/lib/api';
import { CloseIcon } from '@/components/icons';
import { TextField } from '../form-field';
import { updateCompensationAction } from './actions';

export function EditCompensationDialog({
  employee,
  compensation,
  onClose,
}: {
  employee: EmployeeDetail;
  compensation: EmployeeCompensation | null;
  onClose: () => void;
}) {
  const [dailyGrossSalary, setDailyGrossSalary] = useState(compensation?.dailyGrossSalary ?? '');
  const [monthlyGrossSalary, setMonthlyGrossSalary] = useState(compensation?.monthlyGrossSalary ?? '');
  const [servicePayment, setServicePayment] = useState(compensation?.servicePayment ?? '');
  const [lastSalaryChange, setLastSalaryChange] = useState(compensation?.lastSalaryChange ?? '');
  const [remoteWorkAllowance, setRemoteWorkAllowance] = useState(compensation?.remoteWorkAllowance ?? '');
  const [groceryVouchers, setGroceryVouchers] = useState(compensation?.groceryVouchers ?? '');
  const [gasVouchers, setGasVouchers] = useState(compensation?.gasVouchers ?? '');
  const [phoneAllowance, setPhoneAllowance] = useState(compensation?.phoneAllowance ?? '');
  const [punctualityBonus, setPunctualityBonus] = useState(compensation?.punctualityBonus ?? '');
  const [healthInsurance, setHealthInsurance] = useState(compensation?.healthInsurance ?? '');
  const [otherBenefits, setOtherBenefits] = useState(compensation?.otherBenefits ?? '');
  const [totalGross, setTotalGross] = useState(compensation?.totalGross ?? '');
  const [netEstimate, setNetEstimate] = useState(compensation?.netEstimate ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const payload: UpdateCompensationPayload = {};
      if (dailyGrossSalary !== '') payload.dailyGrossSalary = Number(dailyGrossSalary);
      if (monthlyGrossSalary !== '') payload.monthlyGrossSalary = Number(monthlyGrossSalary);
      if (servicePayment !== '') payload.servicePayment = Number(servicePayment);
      if (lastSalaryChange) payload.lastSalaryChange = lastSalaryChange;
      if (remoteWorkAllowance !== '') payload.remoteWorkAllowance = Number(remoteWorkAllowance);
      if (groceryVouchers !== '') payload.groceryVouchers = Number(groceryVouchers);
      if (gasVouchers !== '') payload.gasVouchers = Number(gasVouchers);
      if (phoneAllowance !== '') payload.phoneAllowance = Number(phoneAllowance);
      if (punctualityBonus !== '') payload.punctualityBonus = Number(punctualityBonus);
      if (healthInsurance.trim()) payload.healthInsurance = healthInsurance.trim();
      if (otherBenefits.trim()) payload.otherBenefits = otherBenefits.trim();
      if (totalGross !== '') payload.totalGross = Number(totalGross);
      if (netEstimate !== '') payload.netEstimate = Number(netEstimate);

      const result = await updateCompensationAction(employee.id, payload);
      if (result.success) {
        onClose();
      } else {
        setError(result.error ?? 'No se pudo actualizar la compensación.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-navy">Editar compensación</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-3 gap-4">
            <TextField id="comp-daily" label="Sueldo diario bruto" type="number" value={dailyGrossSalary} onChange={setDailyGrossSalary} />
            <TextField id="comp-monthly" label="Sueldo mensual bruto" type="number" value={monthlyGrossSalary} onChange={setMonthlyGrossSalary} />
            <TextField id="comp-service" label="Pago por servicios" type="number" value={servicePayment} onChange={setServicePayment} />
          </div>
          <TextField id="comp-last-change" label="Último cambio de sueldo" type="date" value={lastSalaryChange} onChange={setLastSalaryChange} />

          <div className="border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Prestaciones</p>
            <div className="grid grid-cols-3 gap-4">
              <TextField id="comp-remote" label="Apoyo home office" type="number" value={remoteWorkAllowance} onChange={setRemoteWorkAllowance} />
              <TextField id="comp-grocery" label="Vales de despensa" type="number" value={groceryVouchers} onChange={setGroceryVouchers} />
              <TextField id="comp-gas" label="Vales de gasolina" type="number" value={gasVouchers} onChange={setGasVouchers} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <TextField id="comp-phone" label="Apoyo telefónico" type="number" value={phoneAllowance} onChange={setPhoneAllowance} />
              <TextField id="comp-punctuality" label="Bono de puntualidad" type="number" value={punctualityBonus} onChange={setPunctualityBonus} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4">
              <TextField id="comp-health" label="Seguro de gastos médicos" value={healthInsurance} onChange={setHealthInsurance} />
              <TextField id="comp-other" label="Otros beneficios" value={otherBenefits} onChange={setOtherBenefits} />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Totales</p>
            <div className="grid grid-cols-2 gap-4">
              <TextField id="comp-total-gross" label="Total bruto" type="number" value={totalGross} onChange={setTotalGross} />
              <TextField id="comp-net-estimate" label="Estimado neto" type="number" value={netEstimate} onChange={setNetEstimate} />
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-terracota px-4 py-2 text-sm font-semibold text-white hover:bg-terracota-dark disabled:opacity-60"
            >
              {isPending ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
