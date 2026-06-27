import { getExpiringContracts, type ExpiringContractItem } from '@/lib/api';
import { ExpiringContractsScreen } from './expiring-contracts-screen';

interface PageProps {
  searchParams: Promise<{ days?: string }>;
}

function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  return p.catch(() => fallback);
}

export default async function ContratosPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const rawDays = sp.days ? parseInt(sp.days, 10) : 30;
  const days = isNaN(rawDays) || rawDays < 1 ? 30 : rawDays;

  const items = await safe(getExpiringContracts(days), [] as ExpiringContractItem[]);

  return <ExpiringContractsScreen items={items} selectedDays={days} />;
}
