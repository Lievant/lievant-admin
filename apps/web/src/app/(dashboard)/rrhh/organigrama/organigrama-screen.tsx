'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SearchIcon } from '@/components/icons';
import { usePermission } from '@/hooks/use-permission';
import { useCurrentUser } from '@/components/user-provider';
import { OrgPersonModal } from './org-person-modal';
import { OrgPhoto } from './org-photo';
import {
  ancestorsOf,
  allCollapsed,
  centerOn,
  clampScale,
  defaultCollapsed,
  descendantCount,
  findNode,
  fitTransform,
  flatten,
  isSynthetic,
  layoutTree,
  searchNodes,
  visibleTree,
  type OrgPerson,
  type OrgTreeNode,
} from './org-tree';

export interface OrgChartData {
  root: OrgTreeNode | null;
  stats: { employees: number; roots: number; orphans: number; cycles: number };
  locations: string[];
}

const NODE_W = 208;
const NODE_H = 92;
const LAYOUT = { nodeWidth: NODE_W, nodeHeight: NODE_H, gapX: 24, gapY: 48 };
const BTN = 'rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50';

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return mobile;
}

function NodeCard({
  node,
  collapsed,
  highlighted,
  onOpen,
  onToggle,
}: {
  node: OrgTreeNode;
  /** Total de descendientes ocultos si está contraído; 0 si no. */
  collapsed: number;
  highlighted: boolean;
  onOpen: (p: OrgPerson) => void;
  onToggle: (id: string) => void;
}) {
  const hasChildren = collapsed > 0 || node.children.length > 0;
  if (isSynthetic(node)) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-3 text-sm font-semibold text-slate-500">
        {node.fullName}
        {hasChildren && (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            className="ml-2 rounded-full border border-slate-200 px-2 text-xs"
            aria-label={collapsed > 0 ? 'Expandir' : 'Contraer'}
          >
            {collapsed > 0 ? `+${collapsed}` : '−'}
          </button>
        )}
      </div>
    );
  }
  return (
    <div
      className={`relative flex h-full w-full items-center gap-3 rounded-xl border bg-white px-3 shadow-sm ${
        highlighted ? 'border-black ring-2 ring-black' : 'border-slate-200'
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(node)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-black"
        aria-label={`Ver detalle de ${node.fullName}`}
      >
        <OrgPhoto name={node.fullName} photoUrl={node.photoUrl} size={44} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-navy">{node.fullName}</span>
          <span className="block truncate text-xs text-slate-600">{node.position}</span>
          {node.area && <span className="block truncate text-[11px] text-slate-400">{node.area}</span>}
        </span>
      </button>
      {hasChildren && (
        <button
          type="button"
          onClick={() => onToggle(node.id)}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
          aria-label={collapsed > 0 ? `Expandir (${collapsed})` : 'Contraer'}
        >
          {collapsed > 0 ? `+${collapsed}` : '−'}
        </button>
      )}
    </div>
  );
}

/** Vista compacta para móvil: solo nombre y cargo, sin foto; el mismo modal al tocar. */
function MobileNode({
  node,
  depth,
  collapsed,
  highlightId,
  onOpen,
  onToggle,
}: {
  node: OrgTreeNode;
  depth: number;
  collapsed: Set<string>;
  highlightId: string | null;
  onOpen: (p: OrgPerson) => void;
  onToggle: (id: string) => void;
}) {
  const isCollapsed = collapsed.has(node.id);
  const hasChildren = node.children.length > 0;
  return (
    <li>
      <div
        className={`flex items-center gap-2 rounded-md py-1.5 pr-2 ${highlightId === node.id ? 'bg-slate-100 ring-1 ring-black' : ''}`}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            className="h-6 w-6 shrink-0 rounded border border-slate-200 text-xs text-slate-600"
            aria-label={isCollapsed ? 'Expandir' : 'Contraer'}
          >
            {isCollapsed ? '+' : '−'}
          </button>
        ) : (
          <span className="h-6 w-6 shrink-0" />
        )}
        {isSynthetic(node) ? (
          <span className="text-sm font-semibold text-slate-500">{node.fullName}</span>
        ) : (
          <button type="button" onClick={() => onOpen(node)} className="min-w-0 text-left">
            <span className="block truncate text-sm font-semibold text-navy">{node.fullName}</span>
            <span className="block truncate text-xs text-slate-500">{node.position}</span>
          </button>
        )}
      </div>
      {hasChildren && !isCollapsed && (
        <ul>
          {node.children.map((c) => (
            <MobileNode key={c.id} node={c} depth={depth + 1} collapsed={collapsed} highlightId={highlightId} onOpen={onOpen} onToggle={onToggle} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function OrganigramaScreen({ initial, initialError }: { initial: OrgChartData | null; initialError: boolean }) {
  const isMobile = useIsMobile();
  const user = useCurrentUser();
  const hasFilePermission = usePermission('rrhh', 'empleados', 'read');
  // Sin usuario resuelto no se asume permiso: el expediente es más sensible que el organigrama.
  const canOpenFile = Boolean(user?.roles.some((r) => r.name === 'SUPER_ADMIN')) || hasFilePermission;

  const [data, setData] = useState<OrgChartData | null>(initial);
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(() => defaultCollapsed(initial?.root ?? null));
  const [focusId, setFocusId] = useState<string | null>(null);
  const [selected, setSelected] = useState<OrgPerson | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });

  const viewportRef = useRef<HTMLDivElement>(null);
  const needsFit = useRef(true);
  const pendingCenter = useRef<string | null>(null);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);

  const fullRoot = data?.root ?? null;
  const displayRoot = useMemo(() => (focusId ? findNode(fullRoot, focusId) : fullRoot), [fullRoot, focusId]);
  const visible = useMemo(() => (displayRoot ? visibleTree(displayRoot, collapsed) : null), [displayRoot, collapsed]);
  const layout = useMemo(() => (visible ? layoutTree(visible, LAYOUT) : null), [visible]);
  const nodeById = useMemo(() => new Map(flatten(displayRoot).map((n) => [n.id, n])), [displayRoot]);
  const positions = useMemo(() => new Map((layout?.nodes ?? []).map((n) => [n.id, n])), [layout]);
  const results = useMemo(() => searchNodes(fullRoot, query), [fullRoot, query]);

  const fit = useCallback(() => {
    const el = viewportRef.current;
    if (!el || !layout) return;
    setTransform(fitTransform(layout, { width: el.clientWidth, height: el.clientHeight }));
  }, [layout]);

  // Ajuste automático la primera vez y cada vez que cambia la raíz mostrada.
  useLayoutEffect(() => {
    if (isMobile || !layout) return;
    if (pendingCenter.current) {
      const pos = positions.get(pendingCenter.current);
      const el = viewportRef.current;
      if (pos && el) {
        setTransform((t) => centerOn(pos, LAYOUT, { width: el.clientWidth, height: el.clientHeight }, Math.max(t.k, 0.9)));
        pendingCenter.current = null;
        return;
      }
    }
    // Solo se ajusta cuando el contenedor ya tiene tamaño; si no (pestaña oculta o
    // aún sin medir), queda pendiente y lo resuelve el ResizeObserver de abajo.
    if (needsFit.current && (viewportRef.current?.clientWidth ?? 0) > 0) {
      needsFit.current = false;
      fit();
    }
  }, [layout, positions, fit, isMobile]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || isMobile || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (needsFit.current && el.clientWidth > 0) {
        needsFit.current = false;
        fit();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fit, isMobile, layout]);

  // Rueda del ratón: zoom alrededor del cursor. Escucha no pasiva para poder evitar el scroll de la página.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || isMobile) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setTransform((t) => {
        const k = clampScale(t.k * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
        const ratio = k / t.k;
        return { k, x: px - (px - t.x) * ratio, y: py - (py - t.y) * ratio };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [isMobile, layout]);

  function zoomBy(factor: number) {
    const el = viewportRef.current;
    if (!el) return;
    const px = el.clientWidth / 2;
    const py = el.clientHeight / 2;
    setTransform((t) => {
      const k = clampScale(t.k * factor);
      const ratio = k / t.k;
      return { k, x: px - (px - t.x) * ratio, y: py - (py - t.y) * ratio };
    });
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    drag.current = { sx: e.clientX, sy: e.clientY, ox: transform.x, oy: transform.y, moved: false };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    setTransform((t) => ({ ...t, x: d.ox + dx, y: d.oy + dy }));
  }
  function endDrag() {
    if (drag.current?.moved) {
      // Evita que el clic que cierra el arrastre abra una tarjeta.
      justDragged.current = true;
      setTimeout(() => (justDragged.current = false), 0);
    }
    drag.current = null;
  }

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function open(p: OrgPerson) {
    if (justDragged.current) return;
    setSelected(p);
  }

  function focusOn(id: string | null) {
    needsFit.current = true;
    setFocusId(id);
    setHighlightId(null);
  }

  function expandAll() {
    needsFit.current = true;
    setCollapsed(new Set());
  }
  function collapseAll() {
    needsFit.current = true;
    setCollapsed(allCollapsed(displayRoot));
  }

  /** Abre los ancestros del nodo buscado, lo resalta y (en escritorio) lo centra. */
  function reveal(person: OrgPerson) {
    const inFocus = focusId ? nodeById.has(person.id) : true;
    if (!inFocus) setFocusId(null);
    setCollapsed((prev) => {
      const next = new Set(prev);
      for (const id of ancestorsOf(fullRoot, person.id)) next.delete(id);
      return next;
    });
    setHighlightId(person.id);
    pendingCenter.current = person.id;
    setQuery('');
  }

  async function changeLocation(value: string) {
    setLocation(value);
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/employees/org-chart${value ? `?location=${encodeURIComponent(value)}` : ''}`);
      if (!res.ok) throw new Error();
      const next = (await res.json()) as OrgChartData;
      setData({ ...next, locations: next.locations.length > 0 ? next.locations : (data?.locations ?? []) });
      setCollapsed(defaultCollapsed(next.root));
      setFocusId(null);
      setHighlightId(null);
      needsFit.current = true;
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const people = data?.stats.employees ?? 0;

  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Organigrama</h1>
          <p className="mt-1 text-sm text-slate-500">
            {people} persona{people !== 1 ? 's' : ''} activa{people !== 1 ? 's' : ''}
            {location ? ` en ${location}` : ''} · se genera solo desde «Reporta a» del expediente
          </p>
        </div>
      </header>

      {error && (
        <div role="alert" className="mt-4 rounded-lg border border-black/30 bg-black/5 px-4 py-3 text-sm text-black">
          No se pudo cargar el organigrama. Intenta de nuevo.
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5">
            <SearchIcon className="h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre…"
              aria-label="Buscar persona"
              className="w-full text-sm text-navy placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          {results.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
              {results.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => reveal(p)} className="block w-full px-3 py-2 text-left hover:bg-slate-50">
                    <span className="block text-sm font-medium text-navy">{p.fullName}</span>
                    <span className="block text-xs text-slate-400">{p.position}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {(data?.locations.length ?? 0) > 0 && (
          <select
            aria-label="Ubicación"
            value={location}
            onChange={(e) => void changeLocation(e.target.value)}
            disabled={loading}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 focus:border-black focus:outline-none"
          >
            <option value="">Ubicación: Todas</option>
            {data!.locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        )}

        <button type="button" onClick={expandAll} className={BTN}>
          Expandir Todo
        </button>
        <button type="button" onClick={collapseAll} className={BTN}>
          Contraer Todo
        </button>
        {focusId && (
          <button type="button" onClick={() => focusOn(null)} className={BTN}>
            Ver Árbol Completo
          </button>
        )}
        {!isMobile && (
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => zoomBy(1 / 1.2)} className={BTN} aria-label="Alejar">
              −
            </button>
            <span className="w-12 text-center text-xs text-slate-500">{Math.round(transform.k * 100)}%</span>
            <button type="button" onClick={() => zoomBy(1.2)} className={BTN} aria-label="Acercar">
              +
            </button>
            <button type="button" onClick={fit} className={BTN}>
              Ajustar a Pantalla
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-slate-400">Cargando…</p>
      ) : !visible ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-500">
          No hay empleados activos para mostrar{location ? ` en ${location}` : ''}.
        </div>
      ) : isMobile ? (
        <ul className="mt-4 rounded-xl border border-slate-200 bg-white p-2">
          <MobileNode node={visible} depth={0} collapsed={collapsed} highlightId={highlightId} onOpen={open} onToggle={toggle} />
        </ul>
      ) : (
        <div
          ref={viewportRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          className="relative mt-4 h-[calc(100vh-260px)] min-h-[420px] cursor-grab touch-none select-none overflow-hidden rounded-xl border border-slate-200 bg-slate-50 active:cursor-grabbing"
          aria-label="Organigrama: arrastra para mover y usa la rueda para acercar"
        >
          {layout && (
            <div
              className="absolute left-0 top-0"
              style={{
                width: layout.width,
                height: layout.height,
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
                transformOrigin: '0 0',
              }}
            >
              <svg width={layout.width} height={layout.height} className="pointer-events-none absolute left-0 top-0" aria-hidden="true">
                {layout.nodes
                  .filter((n) => n.parentId)
                  .map((n) => {
                    const parent = positions.get(n.parentId!)!;
                    const x1 = parent.x + NODE_W / 2;
                    const y1 = parent.y + NODE_H;
                    const x2 = n.x + NODE_W / 2;
                    const y2 = n.y;
                    const mid = (y1 + y2) / 2;
                    return <path key={n.id} d={`M${x1},${y1} V${mid} H${x2} V${y2}`} fill="none" stroke="#cbd5e1" strokeWidth={1.5} />;
                  })}
              </svg>
              {layout.nodes.map((n) => {
                const node = nodeById.get(n.id);
                if (!node) return null;
                return (
                  <div key={n.id} className="absolute" style={{ left: n.x, top: n.y, width: NODE_W, height: NODE_H }}>
                    <NodeCard
                      node={node}
                      collapsed={collapsed.has(n.id) ? descendantCount(node) : 0}
                      highlighted={highlightId === n.id}
                      onOpen={open}
                      onToggle={toggle}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {data && (data.stats.orphans > 0 || data.stats.cycles > 0) && (
        <p className="mt-3 text-xs text-slate-400">
          {data.stats.orphans > 0 && `${data.stats.orphans} persona${data.stats.orphans !== 1 ? 's' : ''} sin jefe activo se muestra${data.stats.orphans !== 1 ? 'n' : ''} como raíz. `}
          {data.stats.cycles > 0 && `Se detectó${data.stats.cycles !== 1 ? 'ron' : ''} ${data.stats.cycles} ciclo${data.stats.cycles !== 1 ? 's' : ''} en «Reporta a» y se rompió${data.stats.cycles !== 1 ? 'eron' : ''} para poder dibujar el árbol.`}
        </p>
      )}

      {selected && (
        <OrgPersonModal
          person={selected}
          canOpenFile={canOpenFile}
          onFocus={(id) => focusOn(id)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
