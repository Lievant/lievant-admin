import { notFound } from 'next/navigation';
import { ApiError, getRoom, type Room } from '@/lib/api';
import { RoomDetailScreen } from './room-detail-screen';

interface RoomDetailPageProps {
  params: Promise<{ roomId: string }>;
}

export default async function RoomDetailPage({ params }: RoomDetailPageProps) {
  const { roomId } = await params;

  let room: Room | null = null;
  let fetchError: string | null = null;

  try {
    room = await getRoom(roomId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    fetchError = err instanceof ApiError ? err.message : 'No se pudo conectar con la API.';
  }

  if (!room) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-10">
        <div className="rounded-lg border border-black/30 bg-black/5 px-4 py-3 text-sm text-black">
          {fetchError}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <RoomDetailScreen room={room} />
    </div>
  );
}
