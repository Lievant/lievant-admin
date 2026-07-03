'use client';

import type { ProjectDetail } from '@/lib/api';

interface Props {
  project: ProjectDetail;
}

export function OperationsTab({ project }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-2 font-semibold text-navy">Operaciones</h2>
      <p className="text-sm text-slate-400">
        Este tab mostrará el seguimiento operacional del proyecto <span className="font-medium text-slate-600">{project.displayId}</span>. Próximamente.
      </p>
    </div>
  );
}
