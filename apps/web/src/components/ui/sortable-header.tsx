import { cn } from '@/lib/utils';
import type { SortDir } from '@/hooks/use-sortable-columns';

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  currentSortKey: unknown;
  sortDir: SortDir;
  onSort: (key: string) => void;
  className?: string;
}

export function SortableHeader({ label, sortKey, currentSortKey, sortDir, onSort, className }: SortableHeaderProps) {
  const isActive = currentSortKey === sortKey;
  return (
    <th
      className={cn('cursor-pointer select-none px-4 py-3 hover:text-slate-700', className)}
      onClick={() => onSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        <span className={cn('text-[10px] leading-none', isActive ? 'text-terracota' : 'text-slate-300')}>
          {isActive ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </span>
    </th>
  );
}
