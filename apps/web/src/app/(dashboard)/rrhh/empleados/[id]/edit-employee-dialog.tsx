'use client';

import { useState, useTransition } from 'react';
import type { EmployeeDetail, EmployeeStatus, Modality, UpdateEmployeePayload } from '@/lib/api';
import { CloseIcon } from '@/components/icons';
import { EMPLOYEE_STATUSES, EMPLOYEE_STATUS_LABELS, GENDERS, MODALITIES, MODALITY_LABELS } from '../constants';
import { TextField, SelectField } from '../form-field';
import { updateEmployeeAction } from './actions';

export function EditEmployeeDialog({ employee, onClose }: { employee: EmployeeDetail; onClose: () => void }) {
  const [fullName, setFullName] = useState(employee.fullName);
  const [status, setStatus] = useState<EmployeeStatus>(employee.status);
  const [codNom, setCodNom] = useState(employee.codNom ?? '');
  const [companyCode, setCompanyCode] = useState(employee.companyCode);
  const [companyName, setCompanyName] = useState(employee.companyName);
  const [division, setDivision] = useState(employee.division ?? '');
  const [area, setArea] = useState(employee.area ?? '');
  const [project, setProject] = useState(employee.project ?? '');
  const [level, setLevel] = useState(employee.level ?? '');
  const [position, setPosition] = useState(employee.position);
  const [location, setLocation] = useState(employee.location ?? '');
  const [modality, setModality] = useState<Modality | ''>(employee.modality ?? '');
  const [contractSchema, setContractSchema] = useState(employee.contractSchema ?? '');
  const [directReportTo, setDirectReportTo] = useState(employee.directReportTo ?? '');
  const [corporateEmail, setCorporateEmail] = useState(employee.corporateEmail ?? '');
  const [emailSignature, setEmailSignature] = useState(employee.emailSignature ?? '');
  const [gender, setGender] = useState(employee.gender ?? '');
  const [nationality, setNationality] = useState(employee.nationality ?? '');
  const [seniorityDate, setSeniorityDate] = useState(employee.seniorityDate ?? '');
  const [contractType, setContractType] = useState(employee.contractType ?? '');
  const [contractEndDate, setContractEndDate] = useState(employee.contractEndDate ?? '');
  const [schedule, setSchedule] = useState(employee.schedule ?? '');
  const [lunchTime, setLunchTime] = useState(employee.lunchTime ?? '');
  const [studies, setStudies] = useState(employee.studies ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }

    startTransition(async () => {
      const payload: UpdateEmployeePayload = {
        fullName: fullName.trim(),
        status,
        companyCode: companyCode.trim(),
        companyName: companyName.trim(),
        position: position.trim(),
      };
      if (codNom.trim()) payload.codNom = codNom.trim();
      if (division.trim()) payload.division = division.trim();
      if (area.trim()) payload.area = area.trim();
      if (project.trim()) payload.project = project.trim();
      if (level.trim()) payload.level = level.trim();
      if (location.trim()) payload.location = location.trim();
      if (modality) payload.modality = modality;
      if (contractSchema.trim()) payload.contractSchema = contractSchema.trim();
      if (directReportTo.trim()) payload.directReportTo = directReportTo.trim();
      if (corporateEmail.trim()) payload.corporateEmail = corporateEmail.trim();
      if (emailSignature.trim()) payload.emailSignature = emailSignature.trim();
      if (gender.trim()) payload.gender = gender.trim();
      if (nationality.trim()) payload.nationality = nationality.trim();
      if (seniorityDate) payload.seniorityDate = seniorityDate;
      if (contractType.trim()) payload.contractType = contractType.trim();
      if (contractEndDate) payload.contractEndDate = contractEndDate;
      if (schedule.trim()) payload.schedule = schedule.trim();
      if (lunchTime.trim()) payload.lunchTime = lunchTime.trim();
      if (studies.trim()) payload.studies = studies.trim();

      const result = await updateEmployeeAction(employee.id, payload);
      if (result.success) {
        onClose();
      } else {
        setError(result.error ?? 'No se pudo actualizar el empleado.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-navy">Editar empleado</h2>
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
            <TextField id="employee-full-name" label="Nombre completo" value={fullName} onChange={setFullName} />
            <SelectField
              id="employee-status"
              label="Estado"
              value={status}
              onChange={(v) => setStatus(v as EmployeeStatus)}
              options={EMPLOYEE_STATUSES.map((s) => ({ value: s, label: EMPLOYEE_STATUS_LABELS[s] }))}
              placeholder="Selecciona"
            />
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Organización</p>
            <div className="grid grid-cols-3 gap-4">
              <TextField id="employee-company-code" label="Código de empresa" value={companyCode} onChange={setCompanyCode} mono />
              <TextField id="employee-company-name" label="Empresa" value={companyName} onChange={setCompanyName} />
              <TextField id="employee-cod-nom" label="Código de nómina" value={codNom} onChange={setCodNom} mono />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <TextField id="employee-division" label="División" value={division} onChange={setDivision} />
              <TextField id="employee-area" label="Área" value={area} onChange={setArea} />
              <TextField id="employee-project" label="Proyecto" value={project} onChange={setProject} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <TextField id="employee-position" label="Puesto" value={position} onChange={setPosition} />
              <TextField id="employee-level" label="Nivel" value={level} onChange={setLevel} />
              <TextField id="employee-direct-report" label="Reporta a" value={directReportTo} onChange={setDirectReportTo} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <TextField id="employee-location" label="Ubicación" value={location} onChange={setLocation} />
              <SelectField
                id="employee-modality"
                label="Modalidad"
                value={modality}
                onChange={(v) => setModality(v as Modality | '')}
                options={MODALITIES.map((m) => ({ value: m, label: MODALITY_LABELS[m] }))}
              />
              <TextField id="employee-contract-schema" label="Esquema de contrato" value={contractSchema} onChange={setContractSchema} />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Contacto</p>
            <div className="grid grid-cols-2 gap-4">
              <TextField id="employee-corporate-email" label="Email corporativo" type="email" value={corporateEmail} onChange={setCorporateEmail} mono />
              <TextField id="employee-email-signature" label="Firma de email" value={emailSignature} onChange={setEmailSignature} />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Datos laborales</p>
            <div className="grid grid-cols-3 gap-4">
              <SelectField id="employee-gender" label="Género" value={gender} onChange={setGender} options={GENDERS} />
              <TextField id="employee-nationality" label="Nacionalidad" value={nationality} onChange={setNationality} />
              <TextField id="employee-seniority-date" label="Fecha de antigüedad" type="date" value={seniorityDate} onChange={setSeniorityDate} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <TextField id="employee-contract-type" label="Tipo de contrato" value={contractType} onChange={setContractType} />
              <TextField id="employee-contract-end" label="Fin de contrato" type="date" value={contractEndDate} onChange={setContractEndDate} />
              <TextField id="employee-schedule" label="Horario" value={schedule} onChange={setSchedule} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <TextField id="employee-lunch-time" label="Horario de comida" value={lunchTime} onChange={setLunchTime} />
              <TextField id="employee-studies" label="Estudios" value={studies} onChange={setStudies} />
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
