import { useMemo, useState } from 'react';

export type SortDir = 'asc' | 'desc';

export function useSortableColumns<T>(items: T[]) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return items;
    return [...items].sort((a, b) => {
      const va = String((a as Record<string, unknown>)[sortKey] ?? '');
      const vb = String((b as Record<string, unknown>)[sortKey] ?? '');
      const cmp = va.localeCompare(vb, 'es', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [items, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, handleSort };
}
