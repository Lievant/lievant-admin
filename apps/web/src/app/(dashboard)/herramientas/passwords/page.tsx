import {
  errorKindOf,
  listAccountPasswords,
  listPasswordApplications,
  listPasswordVisiblePeople,
  type AccountPasswordItem,
  type ErrorKind,
  type PasswordApplication,
  type PasswordVisiblePerson,
} from '@/lib/api';
import { NoPermissions } from '@/components/ui/no-permissions';
import { PasswordsScreen } from './passwords-screen';

export const dynamic = 'force-dynamic';

export default async function PasswordsPage() {
  let accounts: AccountPasswordItem[] = [];
  let applications: PasswordApplication[] = [];
  let people: PasswordVisiblePerson[] = [];
  let errorKind: ErrorKind | null = null;

  // Cada llamada por separado: que una falle no debe pasar por "sin expediente"
  // ni vaciar lo que sí cargó (un fallo del API se muestra como fallo).
  const [accountsRes, applicationsRes, peopleRes] = await Promise.allSettled([
    listAccountPasswords(),
    listPasswordApplications(),
    listPasswordVisiblePeople(),
  ]);
  if (accountsRes.status === 'fulfilled') accounts = accountsRes.value;
  if (applicationsRes.status === 'fulfilled') applications = applicationsRes.value;
  if (peopleRes.status === 'fulfilled') people = peopleRes.value;
  const failed = [accountsRes, applicationsRes, peopleRes].find((r) => r.status === 'rejected');
  if (failed && failed.status === 'rejected') errorKind = errorKindOf(failed.reason);

  if (errorKind === 'forbidden') {
    return (
      <div className="mx-auto max-w-screen-xl px-6 py-8">
        <NoPermissions />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <PasswordsScreen
        accounts={accounts}
        applications={applications}
        people={people}
        apiUnavailable={errorKind === 'unavailable'}
      />
    </div>
  );
}
