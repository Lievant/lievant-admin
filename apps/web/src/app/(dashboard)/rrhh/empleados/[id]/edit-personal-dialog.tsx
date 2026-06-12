'use client';

import { useState, useTransition } from 'react';
import type { EmployeeDetail, EmployeePersonalData, UpdatePersonalDataPayload } from '@/lib/api';
import { CloseIcon } from '@/components/icons';
import { BLOOD_TYPES, MARITAL_STATUSES } from '../constants';
import { TextField, SelectField } from '../form-field';
import { updatePersonalDataAction } from './actions';

export function EditPersonalDialog({
  employee,
  personal,
  onClose,
}: {
  employee: EmployeeDetail;
  personal: EmployeePersonalData | null;
  onClose: () => void;
}) {
  const [rfc, setRfc] = useState(personal?.rfc ?? '');
  const [curp, setCurp] = useState(personal?.curp ?? '');
  const [imssNumber, setImssNumber] = useState(personal?.imssNumber ?? '');
  const [bloodType, setBloodType] = useState(personal?.bloodType ?? '');
  const [birthDate, setBirthDate] = useState(personal?.birthDate ?? '');
  const [maritalStatus, setMaritalStatus] = useState(personal?.maritalStatus ?? '');
  const [children, setChildren] = useState(personal?.children != null ? String(personal.children) : '');
  const [phone, setPhone] = useState(personal?.phone ?? '');
  const [mainTransport, setMainTransport] = useState(personal?.mainTransport ?? '');
  const [commuteTime, setCommuteTime] = useState(personal?.commuteTime ?? '');
  const [street, setStreet] = useState(personal?.street ?? '');
  const [extNumber, setExtNumber] = useState(personal?.extNumber ?? '');
  const [intNumber, setIntNumber] = useState(personal?.intNumber ?? '');
  const [neighborhood, setNeighborhood] = useState(personal?.neighborhood ?? '');
  const [postalCode, setPostalCode] = useState(personal?.postalCode ?? '');
  const [city, setCity] = useState(personal?.city ?? '');
  const [state, setState] = useState(personal?.state ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const payload: UpdatePersonalDataPayload = {};
      if (rfc.trim()) payload.rfc = rfc.trim().toUpperCase();
      if (curp.trim()) payload.curp = curp.trim().toUpperCase();
      if (imssNumber.trim()) payload.imssNumber = imssNumber.trim();
      if (bloodType) payload.bloodType = bloodType;
      if (birthDate) payload.birthDate = birthDate;
      if (maritalStatus) payload.maritalStatus = maritalStatus;
      if (children !== '') payload.children = Number(children);
      if (phone.trim()) payload.phone = phone.trim();
      if (mainTransport.trim()) payload.mainTransport = mainTransport.trim();
      if (commuteTime.trim()) payload.commuteTime = commuteTime.trim();
      if (street.trim()) payload.street = street.trim();
      if (extNumber.trim()) payload.extNumber = extNumber.trim();
      if (intNumber.trim()) payload.intNumber = intNumber.trim();
      if (neighborhood.trim()) payload.neighborhood = neighborhood.trim();
      if (postalCode.trim()) payload.postalCode = postalCode.trim();
      if (city.trim()) payload.city = city.trim();
      if (state.trim()) payload.state = state.trim();

      const result = await updatePersonalDataAction(employee.id, payload);
      if (result.success) {
        onClose();
      } else {
        setError(result.error ?? 'No se pudo actualizar la información personal.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-navy">Editar datos personales</h2>
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
          <div className="grid grid-cols-2 gap-4">
            <TextField id="personal-rfc" label="RFC" value={rfc} onChange={setRfc} mono />
            <TextField id="personal-curp" label="CURP" value={curp} onChange={setCurp} mono />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <TextField id="personal-imss" label="Número IMSS" value={imssNumber} onChange={setImssNumber} mono />
            <SelectField id="personal-blood-type" label="Tipo de sangre" value={bloodType} onChange={setBloodType} options={BLOOD_TYPES.map((b) => ({ value: b, label: b }))} />
            <TextField id="personal-birth-date" label="Fecha de nacimiento" type="date" value={birthDate} onChange={setBirthDate} />
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Datos personales</p>
            <div className="grid grid-cols-3 gap-4">
              <SelectField id="personal-marital-status" label="Estado civil" value={maritalStatus} onChange={setMaritalStatus} options={MARITAL_STATUSES} />
              <TextField id="personal-children" label="Hijos" type="number" value={children} onChange={setChildren} />
              <TextField id="personal-phone" label="Teléfono" value={phone} onChange={setPhone} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <TextField id="personal-main-transport" label="Medio de transporte" value={mainTransport} onChange={setMainTransport} />
              <TextField id="personal-commute-time" label="Tiempo de traslado" value={commuteTime} onChange={setCommuteTime} />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Domicilio</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <TextField id="personal-street" label="Calle" value={street} onChange={setStreet} />
              </div>
              <TextField id="personal-ext-number" label="Número exterior" value={extNumber} onChange={setExtNumber} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <TextField id="personal-int-number" label="Número interior" value={intNumber} onChange={setIntNumber} />
              <TextField id="personal-neighborhood" label="Colonia" value={neighborhood} onChange={setNeighborhood} />
              <TextField id="personal-postal-code" label="Código postal" value={postalCode} onChange={setPostalCode} mono />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <TextField id="personal-city" label="Ciudad" value={city} onChange={setCity} />
              <TextField id="personal-state" label="Estado" value={state} onChange={setState} />
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
