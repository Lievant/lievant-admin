import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const body = await request.json() as unknown;
  try {
    const result = await apiFetch(`/auth/users/${id}/permissions`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return NextResponse.json(result ?? null);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al actualizar permiso';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
