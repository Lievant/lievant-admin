import type { SortDir } from '@/lib/sort-rows';

interface SortColumnHeaderProps<K extends string> {
  label: string;
  column: K;
  sort: { key: K; dir: SortDir } | null;
  onSort: (key: K) => void;
  align?: 'left' | 'center' | 'right';
}

/**
 * Encabezado ordenable accesible: botón dentro del `<th>` y `aria-sort`
 * (ascending, descending o none). Activa: ▲/▼; inactiva: ⇅ tenue.
 */
export function SortColumnHeader<K extends string>({
  label,
  column,
  sort,
  onSort,
  align = 'left',
}: SortColumnHeaderProps<K>) {
  const active = sort?.key === column;
  const justify =
    align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
  return (
    <th
      className="px-4 py-3"
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`flex w-full items-center gap-1 ${justify} uppercase tracking-wide hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy`}
      >
        {label}
        <span aria-hidden="true" className={`text-[10px] leading-none ${active ? 'text-black' : 'text-slate-300'}`}>
          {active ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </button>
    </th>
  );
}
