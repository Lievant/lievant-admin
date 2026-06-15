import { listMyBookings } from '@/lib/api';
import { MyBookingsScreen } from './my-bookings-screen';

async function safe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

export default async function MisReservasPage() {
  const bookings = await safe(listMyBookings());

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <MyBookingsScreen bookings={bookings ?? []} apiUnavailable={bookings === null} />
    </div>
  );
}
