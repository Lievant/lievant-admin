import {
  errorKindOf,
  getEquipmentAuditStats,
  listEquipmentAudits,
  listEquipmentAuditTechnicians,
  type EquipmentAuditPage,
  type EquipmentAuditStats,
  type ErrorKind,
  type ListEquipmentAuditsParams,
} from '@/lib/api';
import { AuditsScreen } from './audits-screen';

async function safe<T>(promise: Promise<T>): Promise<{ data: T | null; errorKind: ErrorKind | null }> {
  try {
    return { data: await promise, errorKind: null };
  } catch (err) {
    return { data: null, errorKind: errorKindOf(err) };
  }
}

function asString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v || undefined;
}

interface AuditsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AuditsPage({ searchParams }: AuditsPageProps) {
  const params = await searchParams;
  const technicianId = asString(params.technicianId);
  const status = asString(params.status);
  const dateFrom = asString(params.dateFrom);
  const dateTo = asString(params.dateTo);
  const page = Math.max(1, Number(asString(params.page) ?? '1') || 1);

  const query: ListEquipmentAuditsParams = { page, limit: 20, technicianId, status, dateFrom, dateTo };

  const [pageResult, statsResult, techniciansResult] = await Promise.all([
    safe(listEquipmentAudits(query)),
    safe(getEquipmentAuditStats()),
    safe(listEquipmentAuditTechnicians()),
  ]);

  const emptyPage: EquipmentAuditPage = { data: [], total: 0, page: 1, limit: 20, totalPages: 1 };
  const emptyStats: EquipmentAuditStats = {
    total: 0,
    completadas: 0,
    enProgreso: 0,
    conObservaciones: 0,
    thisMonth: 0,
    equiposSinPresencia: 0,
    macsSincronizadas: 0,
  };

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <AuditsScreen
        page={pageResult.data ?? emptyPage}
        stats={statsResult.data ?? emptyStats}
        technicians={techniciansResult.data ?? []}
        errorKind={pageResult.errorKind}
        filters={{
          technicianId: technicianId ?? '',
          status: status ?? '',
          dateFrom: dateFrom ?? '',
          dateTo: dateTo ?? '',
        }}
      />
    </div>
  );
}
