import { LeaderRequisitionsScreen } from './leader-requisitions-screen';

export const dynamic = 'force-dynamic';

/** Solicitud de Puesto (líderes): solo sesión; el API verifica que el usuario sea líder. */
export default function SolicitudPuestoPage() {
  return (
    <div className="mx-auto max-w-screen-xl px-4 py-6 sm:px-6 sm:py-8">
      <LeaderRequisitionsScreen />
    </div>
  );
}
