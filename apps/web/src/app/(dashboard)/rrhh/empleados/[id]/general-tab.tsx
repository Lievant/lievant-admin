import type { EmployeeDetail } from '@/lib/api';
import { cn, formatDateLocal } from '@/lib/utils';
import {
  EMPLOYEE_STATUS_LABELS,
  MODALITY_LABELS,
  calculateSeniority,
  companyBadgeStyle,
  formatDate,
} from '../constants';

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={mono ? 'mt-1 font-mono text-sm text-navy' : 'mt-1 text-sm text-navy'}>{value}</p>
    </div>
  );
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className ?? ''}`}>
      <h2 className="text-sm font-semibold text-navy">{title}</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

export function GeneralTab({ employee }: { employee: EmployeeDetail }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Section title="Información general">
        <Field label="ID" value={employee.displayId} mono />
        <Field label="Código de nómina" value={employee.codNom ?? '—'} mono />
        <Field label="Estado" value={EMPLOYEE_STATUS_LABELS[employee.status]} />
        <Field label="Puesto" value={employee.position} />
        <Field label="Nivel" value={employee.level ?? '—'} />
        <Field label="Proyecto" value={employee.project ?? '—'} />
      </Section>

      <Section title="Organización">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Empresa</p>
          <span
            className={cn(
              'mt-1 inline-flex rounded-full px-2 py-1 text-xs font-semibold',
              companyBadgeStyle(employee.companyName),
            )}
          >
            {employee.companyName}
          </span>
        </div>
        <Field label="Código de empresa" value={employee.companyCode} mono />
        <Field label="División" value={employee.division ?? '—'} />
        <Field label="Área" value={employee.area ?? '—'} />
        <Field label="Reporta a" value={employee.directReportTo ?? '—'} />
        <Field label="Ubicación" value={employee.location ?? '—'} />
        <Field label="Modalidad" value={employee.modality ? MODALITY_LABELS[employee.modality] : '—'} />
        <Field label="Esquema de contrato" value={employee.contractSchema ?? '—'} />
      </Section>

      <Section title="Contacto y acceso">
        <Field label="Email corporativo" value={employee.corporateEmail ?? '—'} mono />
        <Field label="Firma de email" value={employee.emailSignature ?? '—'} />
        <Field label="Usuario del sistema" value={employee.authUser?.name ?? 'Sin vincular'} />
        <Field label="Email de acceso" value={employee.authUser?.email ?? '—'} mono />
      </Section>

      <Section title="Datos laborales">
        <Field label="Fecha de antigüedad" value={formatDateLocal(employee.seniorityDate)} />
        <Field label="Antigüedad" value={calculateSeniority(employee.seniorityDate)} />
        <Field label="Tipo de contrato" value={employee.contractType ?? '—'} />
        <Field label="Fin de contrato" value={formatDateLocal(employee.contractEndDate)} />
        <Field label="Horario" value={employee.schedule ?? '—'} />
        <Field label="Horario de comida" value={employee.lunchTime ?? '—'} />
        <Field label="Género" value={employee.gender ?? '—'} />
        <Field label="Nacionalidad" value={employee.nationality ?? '—'} />
        <div className="sm:col-span-2">
          <Field label="Estudios" value={employee.studies ?? '—'} />
        </div>
      </Section>

      <Section title="Fechas del sistema" className="md:col-span-2">
        <Field label="Fecha de alta" value={formatDate(employee.createdAt)} />
        <Field label="Última actualización" value={formatDate(employee.updatedAt)} />
      </Section>
    </div>
  );
}
