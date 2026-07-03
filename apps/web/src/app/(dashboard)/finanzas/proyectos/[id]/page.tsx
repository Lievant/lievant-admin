import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProject, listEmployees } from '@/lib/api';
import { ProjectDetailScreen } from './project-detail-screen';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;

  let project;
  try {
    project = await getProject(id);
  } catch {
    notFound();
  }

  const empPage = await (async () => {
    try { return await listEmployees({ status: 'active', limit: 200 }); } catch { return null; }
  })();
  const employees = empPage?.data ?? [];

  return (
    <div className="mx-auto max-w-screen-xl px-6 py-8">
      <div className="mb-6">
        <Link href="/finanzas/proyectos" className="text-sm text-slate-500 hover:text-navy">
          ← Volver a proyectos
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-navy">{project.name}</h1>
          <span className="font-mono text-sm text-slate-400">{project.displayId}</span>
        </div>
      </div>
      <ProjectDetailScreen project={project} employees={employees} />
    </div>
  );
}
