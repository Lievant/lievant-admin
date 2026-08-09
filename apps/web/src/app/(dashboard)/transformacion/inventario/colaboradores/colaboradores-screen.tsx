'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { avatarColor, initials } from '@/lib/avatar';
import { SearchIcon } from '@/components/icons';

export interface EmployeeWithEquipment {
  id: string;
  fullName: string;
  area: string | null;
  position: string;
  corporateEmail: string | null;
  photoUrl: string | null;
  equipmentCount: number;
  responsivaCode: string | null;
  hasResponsiva: boolean;
}

interface EmployeesPage {
  data: EmployeeWithEquipment[];
  nextCursor: string | null;
  total: number;
}

export function EmployeePhoto({
  name,
  photoUrl,
  size = 'md',
}: {
  name: string;
  photoUrl: string | null;
  size?: 'md' | 'lg';
}) {
  const [src, setSrc] = useState<string | null>(photoUrl);
  const dim = size === 'lg' ? 'h-16 w-16 text-lg' : 'h-10 w-10 text-xs';

  return (
    <div
      className={`flex ${dim} flex-shrink-0 items-center justify-center rounded-full font-bold text-white`}
      style={{ backgroundColor: avatarColor(name) }}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          className="h-full w-full rounded-full object-cover"
          onError={() => setSrc(null)}
        />
      ) : (
        initials(name)
      )}
    </div>
  );
}

export function ResponsivaBadge({ code }: { code: string | null }) {
  if (code) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
        Con responsiva
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
      Sin responsiva
    </span>
  );
}

export function ColaboradoresScreen() {
  const [items, setItems] = useState<EmployeeWithEquipment[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setSearch(texto), 350);
    return () => clearTimeout(id);
  }, [texto]);

  const url = useCallback(
    (cursor?: string) => {
      const p = new URLSearchParams();
      if (search) p.set('search', search);
      if (cursor) p.set('cursor', cursor);
      p.set('limit', '20');
      return `/api/inventory/employees?${p.toString()}`;
    },
    [search],
  );

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(url());
      if (res.status === 403) {
        setError('No tienes permiso para ver el inventario.');
        return;
      }
      if (!res.ok) {
        setError('No se pudo cargar la lista de colaboradores.');
        return;
      }
      const page = (await res.json()) as EmployeesPage;
      setItems(page.data);
      setTotal(page.total);
      setNextCursor(page.nextCursor);
      setError(null);
    } catch {
      setError('No se pudo cargar la lista de colaboradores.');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function cargarMas() {
    if (!nextCursor || cargandoMas) return;
    setCargandoMas(true);
    try {
      const res = await fetch(url(nextCursor));
      if (res.ok) {
        const page = (await res.json()) as EmployeesPage;
        setItems((prev) => [...prev, ...page.data]);
        setNextCursor(page.nextCursor);
      }
    } finally {
      setCargandoMas(false);
    }
  }

  const sinResponsiva = items.filter((i) => !i.hasResponsiva).length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy">Colaboradores con equipo</h1>
          <p className="mt-1 text-sm text-slate-500">
            Quién tiene qué equipo asignado y si su carta responsiva TIC-RE-02 ya fue generada.
          </p>
        </div>
        <Link
          href="/transformacion/inventario"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-navy hover:text-navy"
        >
          ← Volver a Inventario
        </Link>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar colaborador…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-navy placeholder:text-slate-400 focus:border-navy focus:outline-none"
          />
        </div>
        <p className="text-sm text-slate-500">
          {total} con equipo
          {sinResponsiva > 0 && (
            <span className="ml-2 text-rose-600">· {sinResponsiva} sin responsiva en pantalla</span>
          )}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Cargando colaboradores…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400">
          {search ? 'Ningún colaborador coincide con la búsqueda.' : 'No hay colaboradores con equipo asignado.'}
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((emp) => (
              <Link
                key={emp.id}
                href={`/transformacion/inventario/colaboradores/${emp.id}`}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-navy"
              >
                <EmployeePhoto name={emp.fullName} photoUrl={emp.photoUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-navy">{emp.fullName}</p>
                  <p className="truncate text-xs text-slate-500">{emp.area ?? 'Sin área'}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {emp.equipmentCount} {emp.equipmentCount === 1 ? 'equipo' : 'equipos'}
                    </span>
                    <ResponsivaBadge code={emp.responsivaCode} />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
            <span>
              {items.length} de {total}
            </span>
            {nextCursor && (
              <button
                type="button"
                onClick={() => void cargarMas()}
                disabled={cargandoMas}
                className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-navy hover:border-navy disabled:opacity-60"
              >
                {cargandoMas ? 'Cargando…' : 'Cargar más'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
