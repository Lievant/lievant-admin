import {
  errorKindOf,
  listAccountPasswords,
  listPasswordApplications,
  listPasswordTeamEmployees,
  listPasswordVisiblePeople,
  type AccountPasswordItem,
  type ErrorKind,
  type PasswordApplication,
  type PasswordTeamEmployee,
  type PasswordVisiblePerson,
} from '@/lib/api';
import { NoPermissions } from '@/components/ui/no-permissions';
import { PasswordsScreen } from './passwords-screen';

export const dynamic = 'force-dynamic';

export default async function PasswordsPage() {
  let accounts: AccountPasswordItem[] = [];
  let applications: PasswordApplication[] = [];
  let team: PasswordTeamEmployee[] = [];
  let people: PasswordVisiblePerson[] = [];
  let errorKind: ErrorKind | null = null;

  try {
    [accounts, applications, team, people] = await Promise.all([
      listAccountPasswords(),
      listPasswordApplications(),
      listPasswordTeamEmployees(),
      listPasswordVisiblePeople(),
    ]);
  } catch (err) {
    errorKind = errorKindOf(err);
  }

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
        team={team}
        people={people}
        apiUnavailable={errorKind === 'unavailable'}
      />
    </div>
  );
}
