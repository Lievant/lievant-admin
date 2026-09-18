import {
  errorKindOf,
  getToolOptions,
  getToolStats,
  listTools,
  type ErrorKind,
  type ListToolsParams,
  type ToolOptions,
  type ToolStats,
} from '@/lib/api';
import { ToolsScreen } from './tools-screen';

async function safe<T>(
  promise: Promise<T>,
): Promise<{ data: T | null; errorKind: ErrorKind | null }> {
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

interface HerramientasPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HerramientasPage({ searchParams }: HerramientasPageProps) {
  const params = await searchParams;

  const search = asString(params.search);
  const category = asString(params.category);
  const contractStatus = asString(params.contractStatus);

  const query: ListToolsParams = {};
  if (search) query.search = search;
  if (category) query.category = category;
  if (contractStatus) query.contractStatus = contractStatus;

  const [toolsResult, statsResult, optionsResult] = await Promise.all([
    safe(listTools(query)),
    safe(getToolStats()),
    safe(getToolOptions()),
  ]);

  const emptyStats: ToolStats = {
    total: 0,
    byContractStatus: {},
    byCategory: {},
    activeAssignments: 0,
    annualCostByCurrency: {},
    monthlyCostByCurrency: {},
    renewingIn30Days: 0,
  };

  // Si /options falla, los selects se quedan sin opciones pero la tabla sigue
  // leyéndose; no vale tirar la pantalla entera por el catálogo de filtros.
  const emptyOptions: ToolOptions = {
    categories: [],
    currencies: ['MXN', 'USD'],
    billingPeriods: ['mensual', 'trimestral', 'anual', 'unico'],
    contractStatuses: ['activo', 'en_negociacion', 'por_cancelar', 'cancelado'],
  };

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <ToolsScreen
        tools={toolsResult.data ?? []}
        stats={statsResult.data ?? emptyStats}
        options={optionsResult.data ?? emptyOptions}
        errorKind={toolsResult.errorKind}
        filters={{
          search: search ?? '',
          category: category ?? '',
          contractStatus: contractStatus ?? '',
        }}
      />
    </div>
  );
}
