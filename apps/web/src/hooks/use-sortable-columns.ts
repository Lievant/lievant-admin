import { useMemo, useState } from 'react';
import { sortByColumn, type SortDir } from '@/lib/sort-by-column';

export type { SortDir };

export function useSortableColumns<T>(items: T[], options?: { emptyLastKeys?: readonly string[] }) {
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
    return sortByColumn(items, sortKey, sortDir, options?.emptyLastKeys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, handleSort };
}
