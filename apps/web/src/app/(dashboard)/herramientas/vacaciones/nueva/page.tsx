import { getMyVacationBalance, type MyVacationBalance } from '@/lib/api';
import { NewVacationForm } from './new-vacation-form';

export default async function NuevaVacacionPage() {
  let balance: MyVacationBalance | null = null;
  try {
    balance = await getMyVacationBalance();
  } catch {
    balance = null;
  }

  return <NewVacationForm balance={balance} />;
}
