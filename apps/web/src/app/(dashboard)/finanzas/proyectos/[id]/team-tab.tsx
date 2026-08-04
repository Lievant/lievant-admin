'use client';

import { useState } from 'react';
import type { EmployeeListItem, ProjectDetail } from '@/lib/api';
import { PlusIcon } from '@/components/icons';

interface Props {
  project: ProjectDetail;
  employees: EmployeeListItem[];
  onUpdate: (p: ProjectDetail) => void;
}

export function TeamTab({ project, employees, onUpdate }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [role, setRole] = useState('');
  const [hours, setHours] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeMembers = project.members.filter((m) => m.isActive);
  const memberEmpIds = new Set(project.members.map((m) => m.employeeId));

  async function handleAdd() {
    if (!selectedEmployeeId) return;
    setAdding(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { employeeId: selectedEmployeeId };
      if (role) body.role = role;
      if (hours) body.estimatedHoursMonthly = hours;

      const res = await fetch(`/api/projects/${project.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const newMember = await res.json();
      const emp = employees.find((e) => e.id === selectedEmployeeId);
      onUpdate({
        ...project,
        members: [
          ...project.members,
          {
            ...newMember,
            employeeName: emp?.fullName ?? null,
            employeeEmail: emp?.corporateEmail ?? null,
          },
        ],
      });
      setShowAdd(false);
      setSelectedEmployeeId('');
      setRole('');
      setHours('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al agregar');
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(employeeId: string) {
    if (!confirm('¿Remover este miembro del proyecto?')) return;
    try {
      const res = await fetch(`/api/projects/${project.id}/members/${employeeId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      onUpdate({ ...project, members: project.members.filter((m) => m.employeeId !== employeeId) });
    } catch {
      // silently fail — retry possible
    }
  }

  const availableEmployees = employees.filter((e) => !memberEmpIds.has(e.id));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-navy">Equipo del proyecto</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <PlusIcon className="h-4 w-4" />
          Agregar
        </button>
      </div>

      {/* PM row */}
      {project.projectManagerName && (
        <div className="mb-4 flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3">
          {project.projectManagerEmail && (
            <MemberAvatar name={project.projectManagerName} email={project.projectManagerEmail} />
          )}
          <div>
            <p className="text-sm font-medium text-navy">{project.projectManagerName}</p>
            <p className="text-xs text-slate-400">Project Manager</p>
          </div>
          <span className="ml-auto rounded-full bg-black/10 px-2 py-0.5 text-xs font-medium text-black">PM</span>
        </div>
      )}

      {/* Members */}
      {activeMembers.length === 0 && !project.projectManagerName && (
        <p className="py-8 text-center text-sm text-slate-400">Sin miembros asignados.</p>
      )}
      <ul className="space-y-2">
        {activeMembers.map((m) => (
          <li key={m.id} className="flex items-center gap-3 rounded-lg px-4 py-3 hover:bg-slate-50">
            {m.employeeEmail && (
              <MemberAvatar name={m.employeeName ?? m.employeeId} email={m.employeeEmail} />
            )}
            <div>
              <p className="text-sm font-medium text-navy">{m.employeeName ?? m.employeeId}</p>
              {m.role && <p className="text-xs text-slate-400">{m.role}</p>}
            </div>
            {m.estimatedHoursMonthly && (
              <span className="ml-auto text-xs text-slate-400">{m.estimatedHoursMonthly}h/mes</span>
            )}
            <button
              onClick={() => handleRemove(m.employeeId)}
              className="ml-2 text-xs text-red-400 hover:text-red-600"
            >
              Remover
            </button>
          </li>
        ))}
      </ul>

      {/* Add form */}
      {showAdd && (
        <div className="mt-4 rounded-lg border border-slate-200 p-4">
          <h3 className="mb-3 text-sm font-medium text-slate-700">Agregar miembro</h3>
          <div className="space-y-3">
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none"
            >
              <option value="">— Seleccionar empleado —</option>
              {availableEmployees.map((e) => (
                <option key={e.id} value={e.id}>{e.fullName}</option>
              ))}
            </select>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Rol (ej. Desarrollador, Diseñador…)"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none"
            />
            <input
              type="number"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="Horas estimadas/mes"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setShowAdd(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleAdd}
                disabled={adding || !selectedEmployeeId}
                className="rounded-lg bg-navy px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {adding ? 'Agregando…' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MemberAvatar({ name, email }: { name: string; email: string }) {
  const initial = name.slice(0, 1).toUpperCase();
  return (
    <div className="relative h-8 w-8 shrink-0">
      <img
        src={`/api/users/${encodeURIComponent(email)}/photo`}
        alt={name}
        className="h-8 w-8 rounded-full object-cover"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
          if (fb) fb.style.display = 'flex';
        }}
      />
      <div className="hidden h-8 w-8 items-center justify-center rounded-full bg-black text-xs font-semibold text-white">
        {initial}
      </div>
    </div>
  );
}
