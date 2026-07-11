import {
  errorKindOf,
  getMyVacationBalance,
  getMyVacationRequests,
  type ErrorKind,
  type MyVacationBalance,
  type VacationRequestItem,
} from '@/lib/api';
import { VacationsScreen } from './vacations-screen';

export default async function VacacionesPage() {
  let balance: MyVacationBalance | null = null;
  let requests: VacationRequestItem[] = [];
  let errorKind: ErrorKind | null = null;

  try {
    [balance, requests] = await Promise.all([getMyVacationBalance(), getMyVacationRequests()]);
  } catch (err) {
    errorKind = errorKindOf(err);
  }

  return (
    <div className="mx-auto max-w-screen-xl px-6 py-8">
      <VacationsScreen balance={balance} requests={requests} errorKind={errorKind} />
    </div>
  );
}
