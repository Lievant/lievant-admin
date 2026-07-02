'use client';

import { useMemo, useState, useTransition } from 'react';
import type { EmployeeDetail, EmployeeStatus, Modality, UpdateEmployeePayload } from '@/lib/api';
import { CloseIcon } from '@/components/icons';
import { EMPLOYEE_STATUSES, EMPLOYEE_STATUS_LABELS, GENDERS, modalityFromCatalogName } from '../constants';
import { TextField, SelectField } from '../form-field';
import { EmployeePicker, type EmployeePickerValue } from '../employee-picker';
import type { EmployeeFormCatalogs } from '../catalog-data';
import { updateEmployeeAction } from './actions';

export function EditEmployeeDialog({
  employee,
  catalogs,
  onClose,
}: {
  employee: EmployeeDetail;
  catalogs: EmployeeFormCatalogs;
  onClose: () => void;
}) {
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
  const [directReportToEmployee, setDirectReportToEmployee] = useState<EmployeePickerValue | null>(
    employee.directReportToId
      ? { id: employee.directReportToId, fullName: employee.directReportTo ?? '', position: '', area: null, location: null, corporateEmail: null }
      : null,
  );
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

  const companyOptions = useMemo(
    () => catalogs.companies.map((c) => ({ value: c.code ?? '', label: c.name })),
    [catalogs.companies],
  );
  const divisionOptions = useMemo(
    () => catalogs.divisions.map((d) => ({ value: d.name, label: d.name })),
    [catalogs.divisions],
  );
  const locationOptions = useMemo(
    () => catalogs.locations.map((l) => ({ value: l.name, label: l.name })),
    [catalogs.locations],
  );
  const modalityOptions = useMemo(
    () =>
      catalogs.modalities
        .map((m) => {
          const enumValue = modalityFromCatalogName(m.name);
          return enumValue ? { value: enumValue as string, label: m.name } : null;
        })
        .filter((option): option is { value: string; label: string } => option !== null),
    [catalogs.modalities],
  );
  const contractSchemaOptions = useMemo(
    () => catalogs.contractSchemas.map((c) => ({ value: c.name, label: c.name })),
    [catalogs.contractSchemas],
  );
  const contractTypeOptions = useMemo(
    () => catalogs.contractTypes.map((c) => ({ value: c.name, label: c.name })),
    [catalogs.contractTypes],
  );
  const orgLevelOptions = useMemo(
    () => catalogs.orgLevels.map((l) => ({ value: l.code ?? '', label: `${l.code} - ${l.name}` })),
    [catalogs.orgLevels],
  );

  const handleCompanyChange = (code: string) => {
    setCompanyCode(code);
    const match = catalogs.companies.find((c) => c.code === code);
    setCompanyName(match?.name ?? '');
  };

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
      if (directReportToEmployee) {
        payload.directReportToId = directReportToEmployee.id;
        payload.directReportTo = directReportToEmployee.fullName;
      } else if (directReportTo.trim()) {
        payload.directReportTo = directReportTo.trim();
      }
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
            <TextField id="employee-full-name" label="Nombre completo" value={fullName} onChange={setFullName} uppercase />
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
              <SelectField id="employee-company-code" label="Empresa" value={companyCode} onChange={handleCompanyChange} options={companyOptions} />
              <TextField id="employee-cod-nom" label="Código de nómina" value={codNom} onChange={setCodNom} mono />
              <SelectField id="employee-contract-type" label="Tipo de contrato" value={contractType} onChange={setContractType} options={contractTypeOptions} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <SelectField id="employee-division" label="División" value={division} onChange={setDivision} options={divisionOptions} />
              <TextField id="employee-area" label="Área" value={area} onChange={setArea} uppercase />
              <TextField id="employee-project" label="Proyecto" value={project} onChange={setProject} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <TextField id="employee-position" label="Puesto" value={position} onChange={setPosition} uppercase />
              <SelectField id="employee-level" label="Nivel" value={level} onChange={setLevel} options={orgLevelOptions} />
              <EmployeePicker
                id="employee-direct-report"
                label="Reporta a"
                value={directReportToEmployee}
                onSelect={(emp) => {
                  setDirectReportToEmployee(emp);
                  setDirectReportTo(emp?.fullName ?? '');
                }}
              />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <SelectField id="employee-location" label="Ubicación" value={location} onChange={setLocation} options={locationOptions} />
              <SelectField
                id="employee-modality"
                label="Modalidad"
                value={modality}
                onChange={(v) => setModality(v as Modality | '')}
                options={modalityOptions}
              />
              <SelectField id="employee-contract-schema" label="Esquema de contrato" value={contractSchema} onChange={setContractSchema} options={contractSchemaOptions} />
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
              <TextField id="employee-nationality" label="Nacionalidad" value={nationality} onChange={setNationality} uppercase />
              <TextField id="employee-seniority-date" label="Fecha de antigüedad" type="date" value={seniorityDate} onChange={setSeniorityDate} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
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
