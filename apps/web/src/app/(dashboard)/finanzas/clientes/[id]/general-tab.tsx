import type { ClientDetail } from '@/lib/api';
import { cn } from '@/lib/utils';
import { CLIENT_SEGMENT_BADGE_STYLES, CLIENT_STATUS_LABELS } from '../constants';

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
}

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

function LinkField({ label, value }: { label: string; value: string | null }) {
  const isUrl = value && /^https?:\/\//i.test(value);
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      {value ? (
        isUrl ? (
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block truncate text-sm text-black hover:underline"
          >
            {value}
          </a>
        ) : (
          <p className="mt-1 text-sm text-navy">{value}</p>
        )
      ) : (
        <p className="mt-1 text-sm text-navy">—</p>
      )}
    </div>
  );
}

export function GeneralTab({ client }: { client: ClientDetail }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Section title="Información general">
        <Field label="ID" value={client.displayId} mono />
        <Field label="Estado" value={CLIENT_STATUS_LABELS[client.status]} />
        <Field label="Grupo económico" value={client.group?.name ?? 'Sin grupo'} />
        <Field label="Account manager" value={client.accountManager?.name ?? 'Sin asignar'} />
        <Field label="Fecha de alta" value={formatDate(client.createdAt)} />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Segmento</p>
          {client.segment ? (
            <span
              className={cn(
                'mt-1 inline-flex rounded-full px-2 py-1 text-xs font-semibold',
                CLIENT_SEGMENT_BADGE_STYLES[client.segment],
              )}
            >
              {client.segment}
            </span>
          ) : (
            <p className="mt-1 text-sm text-navy">—</p>
          )}
        </div>
        <Field label="NPS" value={client.npsScore != null ? String(client.npsScore) : '—'} />
        <Field label="Último contacto" value={client.lastContactDate ? formatDate(client.lastContactDate) : '—'} />
      </Section>

      <Section title="Empresa principal">
        <Field label="Nombre comercial" value={client.primaryCompany.name} />
        <Field label="Razón social" value={client.primaryCompany.legalName ?? '—'} />
        <Field label="RFC" value={client.primaryCompany.rfc ?? '—'} mono />
        <Field label="Industria" value={client.primaryCompany.industry ?? '—'} />
      </Section>

      <Section title="Ubicación">
        <Field label="País" value={client.country ?? '—'} />
        <Field label="Ciudad" value={client.city ?? '—'} />
        <div className="sm:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Dirección</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-navy">{client.address || '—'}</p>
        </div>
      </Section>

      <Section title="Presencia digital">
        <LinkField label="Sitio web" value={client.website} />
        <LinkField label="LinkedIn" value={client.linkedin} />
      </Section>

      <Section title="Identificadores externos" className="md:col-span-2">
        <Field label="CRM" value={client.crmId ?? '—'} mono />
        <Field label="COR" value={client.corId ?? '—'} mono />
        <Field label="Contpaq" value={client.contpaqId ?? '—'} mono />
        <Field label="Dynamics" value={client.dynamicsId ?? '—'} mono />
      </Section>

      <Section title="Notas" className="md:col-span-2">
        <p className="whitespace-pre-wrap text-sm text-slate-600 sm:col-span-2">{client.notes || 'Sin notas.'}</p>
      </Section>
    </div>
  );
}
