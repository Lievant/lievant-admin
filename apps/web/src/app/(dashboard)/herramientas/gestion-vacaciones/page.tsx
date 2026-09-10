import { errorKindOf, getMyTeamVacations, type ErrorKind, type TeamVacationRow } from '@/lib/api';
import { TeamVacationsScreen } from './team-vacations-screen';

export default async function GestionVacacionesPage() {
  let team: TeamVacationRow[] = [];
  let errorKind: ErrorKind | null = null;

  try {
    team = await getMyTeamVacations();
  } catch (err) {
    errorKind = errorKindOf(err);
  }

  return (
    <div className="mx-auto max-w-screen-xl px-6 py-8">
      <TeamVacationsScreen team={team} errorKind={errorKind} />
    </div>
  );
}
