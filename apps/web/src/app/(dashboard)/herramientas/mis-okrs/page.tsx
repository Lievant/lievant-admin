import { MyOkrsScreen } from './my-okrs-screen';

export const dynamic = 'force-dynamic';

/** Mis OKRs (líderes): solo sesión; el API verifica que sea líder y acota todo a sus directos. */
export default function MisOkrsPage() {
  return (
    <div className="mx-auto max-w-screen-xl px-4 py-6 sm:px-6 sm:py-8">
      <MyOkrsScreen />
    </div>
  );
}
