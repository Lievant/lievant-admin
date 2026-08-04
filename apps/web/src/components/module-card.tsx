import Link from 'next/link';
import { ModuleIconView } from '@/components/icons';
import type { ModuleDef } from '@/lib/modules';

export function ModuleCard({ module }: { module: ModuleDef }) {
  return (
    <Link
      href={module.href}
      className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-black hover:shadow-md"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-black/10 text-black transition-colors group-hover:bg-black group-hover:text-white">
        <ModuleIconView icon={module.icon} className="h-6 w-6" />
      </div>
      <div>
        <h3 className="font-semibold text-navy">{module.name}</h3>
        <p className="mt-1 text-sm text-slate-500">{module.description}</p>
      </div>
    </Link>
  );
}
