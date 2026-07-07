import { LockIcon } from '@/components/icons';

export function NoPermissions() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <LockIcon className="mb-4 h-12 w-12 text-slate-300" />
      <h2 className="mb-2 text-lg font-medium text-navy">Acceso restringido</h2>
      <p className="max-w-sm text-sm text-slate-500">
        No tienes permisos para ver esta sección. Contacta a tu administrador si crees que es un error.
      </p>
    </div>
  );
}
