import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  try {
    const data = await apiFetch(`/auth/users/${id}/effective-permissions`);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ sections: [] });
  }
}
