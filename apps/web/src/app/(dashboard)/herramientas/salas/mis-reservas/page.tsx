import { errorKindOf, listMyBookings, type ErrorKind } from '@/lib/api';
import { MyBookingsScreen } from './my-bookings-screen';

async function safe<T>(promise: Promise<T>): Promise<{ data: T | null; errorKind: ErrorKind | null }> {
  try {
    return { data: await promise, errorKind: null };
  } catch (err) {
    return { data: null, errorKind: errorKindOf(err) };
  }
}

export default async function MisReservasPage() {
  const { data: bookings, errorKind } = await safe(listMyBookings());

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <MyBookingsScreen bookings={bookings ?? []} errorKind={errorKind} />
    </div>
  );
}
