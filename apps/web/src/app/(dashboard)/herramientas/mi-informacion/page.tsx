import { MiInformacionScreen } from './mi-informacion-screen';

export const dynamic = 'force-dynamic';

/** Mi Información: cualquier usuario autenticado; el API deduce el expediente de la sesión. */
export default function MiInformacionPage() {
  return (
    <div className="mx-auto max-w-screen-xl px-4 py-6 sm:px-6 sm:py-8">
      <MiInformacionScreen />
    </div>
  );
}
