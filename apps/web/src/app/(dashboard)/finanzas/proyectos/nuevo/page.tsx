import Link from 'next/link';
import { listClients, listEmployees } from '@/lib/api';
import { NewProjectForm } from './new-project-form';

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try { return await p; } catch { return null; }
}

export default async function NuevoProyectoPage() {
  const [clients, employees] = await Promise.all([
    safe(listClients({ status: 'active', limit: 100 })),
    safe(listEmployees({ status: 'active', limit: 200 })),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <Link href="/finanzas/proyectos" className="text-sm text-slate-500 hover:text-navy">
          ← Volver a proyectos
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-navy">Nuevo proyecto</h1>
      </div>
      <NewProjectForm
        clients={clients?.data ?? []}
        employees={employees?.data ?? []}
      />
    </div>
  );
}
