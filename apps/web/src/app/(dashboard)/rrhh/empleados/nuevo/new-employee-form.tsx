'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type {
  CreateEmployeePayload,
  EmployeeStatus,
  Modality,
  UpdateCompensationPayload,
  UpdatePersonalDataPayload,
} from '@/lib/api';
import { EMPLOYEE_STATUSES, EMPLOYEE_STATUS_LABELS, GENDERS, modalityFromCatalogName } from '../constants';
import { TextField, SelectField } from '../form-field';
import type { EmployeeFormCatalogs } from '../catalog-data';
import { createEmployeeAction } from './actions';

const STEP_LABELS = {
  general: 'Información general',
  personal: 'Datos personales',
  compensation: 'Compensación',
} as const;

type StepId = keyof typeof STEP_LABELS;

interface NewEmployeeFormProps {
  canEditPersonal: boolean;
  canEditCompensation: boolean;
  catalogs: EmployeeFormCatalogs;
}

export function NewEmployeeForm({ canEditPersonal, canEditCompensation, catalogs }: NewEmployeeFormProps) {
  const router = useRouter();

  const steps = useMemo<StepId[]>(() => {
    const list: StepId[] = ['general'];
    if (canEditPersonal) list.push('personal');
    if (canEditCompensation) list.push('compensation');
    return list;
  }, [canEditPersonal, canEditCompensation]);

  const [stepIndex, setStepIndex] = useState(0);

  // Paso: información general
  const [fullName, setFullName] = useState('');
  const [status, setStatus] = useState<EmployeeStatus>('active');
  const [codNom, setCodNom] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [division, setDivision] = useState('');
  const [area, setArea] = useState('');
  const [project, setProject] = useState('');
  const [level, setLevel] = useState('');
  const [position, setPosition] = useState('');
  const [location, setLocation] = useState('');
  const [modality, setModality] = useState<Modality | ''>('');
  const [contractSchema, setContractSchema] = useState('');
  const [directReportTo, setDirectReportTo] = useState('');
  const [corporateEmail, setCorporateEmail] = useState('');
  const [emailSignature, setEmailSignature] = useState('');
  const [gender, setGender] = useState('');
  const [nationality, setNationality] = useState('');
  const [seniorityDate, setSeniorityDate] = useState('');
  const [contractType, setContractType] = useState('');
  const [contractEndDate, setContractEndDate] = useState('');
  const [schedule, setSchedule] = useState('');
  const [lunchTime, setLunchTime] = useState('');
  const [studies, setStudies] = useState('');

  // Paso: datos personales
  const [rfc, setRfc] = useState('');
  const [curp, setCurp] = useState('');
  const [imssNumber, setImssNumber] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [children, setChildren] = useState('');
  const [phone, setPhone] = useState('');
  const [mainTransport, setMainTransport] = useState('');
  const [commuteTime, setCommuteTime] = useState('');
  const [street, setStreet] = useState('');
  const [extNumber, setExtNumber] = useState('');
  const [intNumber, setIntNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  // Paso: compensación
  const [dailyGrossSalary, setDailyGrossSalary] = useState('');
  const [monthlyGrossSalary, setMonthlyGrossSalary] = useState('');
  const [servicePayment, setServicePayment] = useState('');
  const [lastSalaryChange, setLastSalaryChange] = useState('');
  const [remoteWorkAllowance, setRemoteWorkAllowance] = useState('');
  const [groceryVouchers, setGroceryVouchers] = useState('');
  const [gasVouchers, setGasVouchers] = useState('');
  const [phoneAllowance, setPhoneAllowance] = useState('');
  const [punctualityBonus, setPunctualityBonus] = useState('');
  const [healthInsurance, setHealthInsurance] = useState('');
  const [otherBenefits, setOtherBenefits] = useState('');
  const [totalGross, setTotalGross] = useState('');
  const [netEstimate, setNetEstimate] = useState('');

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
  const bloodTypeOptions = useMemo(
    () => catalogs.bloodTypes.map((b) => ({ value: b.name, label: b.name })),
    [catalogs.bloodTypes],
  );
  const maritalStatusOptions = useMemo(
    () => catalogs.maritalStatuses.map((m) => ({ value: m.name, label: m.name })),
    [catalogs.maritalStatuses],
  );

  const handleCompanyChange = (code: string) => {
    setCompanyCode(code);
    const match = catalogs.companies.find((c) => c.code === code);
    setCompanyName(match?.name ?? '');
  };

  const currentStep = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  const handleNext = () => {
    setError(null);

    if (currentStep === 'general') {
      if (!fullName.trim() || !companyCode.trim() || !companyName.trim() || !position.trim()) {
        setError('Nombre completo, código de empresa, empresa y puesto son obligatorios.');
        return;
      }
    }

    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  };

  const handleBack = () => {
    setError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !companyCode.trim() || !companyName.trim() || !position.trim()) {
      setError('Nombre completo, código de empresa, empresa y puesto son obligatorios.');
      return;
    }

    startTransition(async () => {
      const payload: CreateEmployeePayload = {
        fullName: fullName.trim(),
        companyCode: companyCode.trim(),
        companyName: companyName.trim(),
        position: position.trim(),
        status,
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

      let personalPayload: UpdatePersonalDataPayload | undefined;
      if (canEditPersonal) {
        personalPayload = {};
        if (rfc.trim()) personalPayload.rfc = rfc.trim().toUpperCase();
        if (curp.trim()) personalPayload.curp = curp.trim().toUpperCase();
        if (imssNumber.trim()) personalPayload.imssNumber = imssNumber.trim();
        if (bloodType) personalPayload.bloodType = bloodType;
        if (birthDate) personalPayload.birthDate = birthDate;
        if (maritalStatus) personalPayload.maritalStatus = maritalStatus;
        if (children !== '') personalPayload.children = Number(children);
        if (phone.trim()) personalPayload.phone = phone.trim();
        if (mainTransport.trim()) personalPayload.mainTransport = mainTransport.trim();
        if (commuteTime.trim()) personalPayload.commuteTime = commuteTime.trim();
        if (street.trim()) personalPayload.street = street.trim();
        if (extNumber.trim()) personalPayload.extNumber = extNumber.trim();
        if (intNumber.trim()) personalPayload.intNumber = intNumber.trim();
        if (neighborhood.trim()) personalPayload.neighborhood = neighborhood.trim();
        if (postalCode.trim()) personalPayload.postalCode = postalCode.trim();
        if (city.trim()) personalPayload.city = city.trim();
        if (state.trim()) personalPayload.state = state.trim();
      }

      let compensationPayload: UpdateCompensationPayload | undefined;
      if (canEditCompensation) {
        compensationPayload = {};
        if (dailyGrossSalary !== '') compensationPayload.dailyGrossSalary = Number(dailyGrossSalary);
        if (monthlyGrossSalary !== '') compensationPayload.monthlyGrossSalary = Number(monthlyGrossSalary);
        if (servicePayment !== '') compensationPayload.servicePayment = Number(servicePayment);
        if (lastSalaryChange) compensationPayload.lastSalaryChange = lastSalaryChange;
        if (remoteWorkAllowance !== '') compensationPayload.remoteWorkAllowance = Number(remoteWorkAllowance);
        if (groceryVouchers !== '') compensationPayload.groceryVouchers = Number(groceryVouchers);
        if (gasVouchers !== '') compensationPayload.gasVouchers = Number(gasVouchers);
        if (phoneAllowance !== '') compensationPayload.phoneAllowance = Number(phoneAllowance);
        if (punctualityBonus !== '') compensationPayload.punctualityBonus = Number(punctualityBonus);
        if (healthInsurance.trim()) compensationPayload.healthInsurance = healthInsurance.trim();
        if (otherBenefits.trim()) compensationPayload.otherBenefits = otherBenefits.trim();
        if (totalGross !== '') compensationPayload.totalGross = Number(totalGross);
        if (netEstimate !== '') compensationPayload.netEstimate = Number(netEstimate);
      }

      const result = await createEmployeeAction(payload, personalPayload, compensationPayload);
      if (result.success && result.id) {
        router.push(`/rrhh/empleados/${result.id}`);
      } else {
        setError(result.error ?? 'No se pudo crear el empleado.');
      }
    });
  };

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/rrhh" className="hover:text-terracota">
          RRHH
        </Link>
        <span>/</span>
        <Link href="/rrhh/empleados" className="hover:text-terracota">
          Empleados
        </Link>
        <span>/</span>
        <span className="text-slate-600">Nuevo empleado</span>
      </nav>

      <h1 className="mt-4 text-2xl font-bold text-navy">Nuevo empleado</h1>

      {/* Step indicator */}
      <div className="mt-6 flex items-center gap-3 text-sm">
        {steps.map((stepId, i) => (
          <div key={stepId} className="flex flex-1 items-center gap-3">
            <StepBadge number={i + 1} active={stepIndex === i} done={stepIndex > i} label={STEP_LABELS[stepId]} />
            {i < steps.length - 1 && <div className="h-px flex-1 bg-slate-200" />}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {currentStep === 'general' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <TextField id="new-employee-full-name" label="Nombre completo" value={fullName} onChange={setFullName} placeholder="Nombre y apellidos" />
              <SelectField
                id="new-employee-status"
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
                <SelectField
                  id="new-employee-company-code"
                  label="Empresa"
                  value={companyCode}
                  onChange={handleCompanyChange}
                  options={companyOptions}
                />
                <TextField id="new-employee-cod-nom" label="Código de nómina" value={codNom} onChange={setCodNom} mono />
                <SelectField
                  id="new-employee-contract-type"
                  label="Tipo de contrato"
                  value={contractType}
                  onChange={setContractType}
                  options={contractTypeOptions}
                />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <SelectField id="new-employee-division" label="División" value={division} onChange={setDivision} options={divisionOptions} />
                <TextField id="new-employee-area" label="Área" value={area} onChange={setArea} />
                <TextField id="new-employee-project" label="Proyecto" value={project} onChange={setProject} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <TextField id="new-employee-position" label="Puesto" value={position} onChange={setPosition} placeholder="Diseñador UX" />
                <SelectField id="new-employee-level" label="Nivel" value={level} onChange={setLevel} options={orgLevelOptions} />
                <TextField id="new-employee-direct-report" label="Reporta a" value={directReportTo} onChange={setDirectReportTo} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <SelectField id="new-employee-location" label="Ubicación" value={location} onChange={setLocation} options={locationOptions} />
                <SelectField
                  id="new-employee-modality"
                  label="Modalidad"
                  value={modality}
                  onChange={(v) => setModality(v as Modality | '')}
                  options={modalityOptions}
                />
                <SelectField
                  id="new-employee-contract-schema"
                  label="Esquema de contrato"
                  value={contractSchema}
                  onChange={setContractSchema}
                  options={contractSchemaOptions}
                />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Contacto</p>
              <div className="grid grid-cols-2 gap-4">
                <TextField id="new-employee-corporate-email" label="Email corporativo" type="email" value={corporateEmail} onChange={setCorporateEmail} mono placeholder="nombre@lievant.com" />
                <TextField id="new-employee-email-signature" label="Firma de email" value={emailSignature} onChange={setEmailSignature} />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Datos laborales</p>
              <div className="grid grid-cols-3 gap-4">
                <SelectField id="new-employee-gender" label="Género" value={gender} onChange={setGender} options={GENDERS} />
                <TextField id="new-employee-nationality" label="Nacionalidad" value={nationality} onChange={setNationality} placeholder="Mexicana" />
                <TextField id="new-employee-seniority-date" label="Fecha de antigüedad" type="date" value={seniorityDate} onChange={setSeniorityDate} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <TextField id="new-employee-contract-end" label="Fin de contrato" type="date" value={contractEndDate} onChange={setContractEndDate} />
                <TextField id="new-employee-schedule" label="Horario" value={schedule} onChange={setSchedule} placeholder="9:00 - 18:00" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <TextField id="new-employee-lunch-time" label="Horario de comida" value={lunchTime} onChange={setLunchTime} placeholder="14:00 - 15:00" />
                <TextField id="new-employee-studies" label="Estudios" value={studies} onChange={setStudies} />
              </div>
            </div>
          </>
        )}

        {currentStep === 'personal' && (
          <>
            <div>
              <p className="text-sm font-semibold text-navy">Datos personales</p>
              <p className="mt-1 text-xs text-slate-400">
                Esta información solo es visible para Recursos Humanos. Puedes omitirla y completarla después.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <TextField id="new-employee-rfc" label="RFC" value={rfc} onChange={setRfc} mono />
              <TextField id="new-employee-curp" label="CURP" value={curp} onChange={setCurp} mono />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <TextField id="new-employee-imss" label="Número IMSS" value={imssNumber} onChange={setImssNumber} mono />
              <SelectField id="new-employee-blood-type" label="Tipo de sangre" value={bloodType} onChange={setBloodType} options={bloodTypeOptions} />
              <TextField id="new-employee-birth-date" label="Fecha de nacimiento" type="date" value={birthDate} onChange={setBirthDate} />
            </div>

            <div className="border-t border-slate-100 pt-4">
              <div className="grid grid-cols-3 gap-4">
                <SelectField id="new-employee-marital-status" label="Estado civil" value={maritalStatus} onChange={setMaritalStatus} options={maritalStatusOptions} />
                <TextField id="new-employee-children" label="Hijos" type="number" value={children} onChange={setChildren} />
                <TextField id="new-employee-phone" label="Teléfono" value={phone} onChange={setPhone} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <TextField id="new-employee-main-transport" label="Medio de transporte" value={mainTransport} onChange={setMainTransport} />
                <TextField id="new-employee-commute-time" label="Tiempo de traslado" value={commuteTime} onChange={setCommuteTime} />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Domicilio</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <TextField id="new-employee-street" label="Calle" value={street} onChange={setStreet} />
                </div>
                <TextField id="new-employee-ext-number" label="Número exterior" value={extNumber} onChange={setExtNumber} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <TextField id="new-employee-int-number" label="Número interior" value={intNumber} onChange={setIntNumber} />
                <TextField id="new-employee-neighborhood" label="Colonia" value={neighborhood} onChange={setNeighborhood} />
                <TextField id="new-employee-postal-code" label="Código postal" value={postalCode} onChange={setPostalCode} mono />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <TextField id="new-employee-city" label="Ciudad" value={city} onChange={setCity} />
                <TextField id="new-employee-state" label="Estado" value={state} onChange={setState} />
              </div>
            </div>
          </>
        )}

        {currentStep === 'compensation' && (
          <>
            <div>
              <p className="text-sm font-semibold text-navy">Compensación</p>
              <p className="mt-1 text-xs text-slate-400">
                Esta información solo es visible para Nómina. Puedes omitirla y completarla después.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <TextField id="new-employee-daily-salary" label="Sueldo diario bruto" type="number" value={dailyGrossSalary} onChange={setDailyGrossSalary} />
              <TextField id="new-employee-monthly-salary" label="Sueldo mensual bruto" type="number" value={monthlyGrossSalary} onChange={setMonthlyGrossSalary} />
              <TextField id="new-employee-service-payment" label="Pago por servicios" type="number" value={servicePayment} onChange={setServicePayment} />
            </div>
            <TextField id="new-employee-last-salary-change" label="Último cambio de sueldo" type="date" value={lastSalaryChange} onChange={setLastSalaryChange} />

            <div className="border-t border-slate-100 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Prestaciones</p>
              <div className="grid grid-cols-3 gap-4">
                <TextField id="new-employee-remote-allowance" label="Apoyo home office" type="number" value={remoteWorkAllowance} onChange={setRemoteWorkAllowance} />
                <TextField id="new-employee-grocery-vouchers" label="Vales de despensa" type="number" value={groceryVouchers} onChange={setGroceryVouchers} />
                <TextField id="new-employee-gas-vouchers" label="Vales de gasolina" type="number" value={gasVouchers} onChange={setGasVouchers} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <TextField id="new-employee-phone-allowance" label="Apoyo telefónico" type="number" value={phoneAllowance} onChange={setPhoneAllowance} />
                <TextField id="new-employee-punctuality-bonus" label="Bono de puntualidad" type="number" value={punctualityBonus} onChange={setPunctualityBonus} />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4">
                <TextField id="new-employee-health-insurance" label="Seguro de gastos médicos" value={healthInsurance} onChange={setHealthInsurance} />
                <TextField id="new-employee-other-benefits" label="Otros beneficios" value={otherBenefits} onChange={setOtherBenefits} />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Totales</p>
              <div className="grid grid-cols-2 gap-4">
                <TextField id="new-employee-total-gross" label="Total bruto" type="number" value={totalGross} onChange={setTotalGross} />
                <TextField id="new-employee-net-estimate" label="Estimado neto" type="number" value={netEstimate} onChange={setNetEstimate} />
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
        )}

        <div className="flex justify-between gap-2 pt-2">
          {stepIndex > 0 ? (
            <button
              type="button"
              onClick={handleBack}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
            >
              Atrás
            </button>
          ) : (
            <Link
              href="/rrhh/empleados"
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
            >
              Cancelar
            </Link>
          )}

          {!isLastStep ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={isPending}
              className="rounded-md bg-terracota px-4 py-2 text-sm font-semibold text-white hover:bg-terracota-dark disabled:opacity-60"
            >
              Siguiente
            </button>
          ) : (
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-terracota px-4 py-2 text-sm font-semibold text-white hover:bg-terracota-dark disabled:opacity-60"
            >
              {isPending ? 'Creando…' : 'Crear empleado'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function StepBadge({ number, active, done, label }: { number: number; active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
          active || done ? 'bg-terracota text-white' : 'bg-slate-100 text-slate-400',
        )}
      >
        {number}
      </div>
      <span className={cn('font-medium', active ? 'text-navy' : 'text-slate-400')}>{label}</span>
    </div>
  );
}
