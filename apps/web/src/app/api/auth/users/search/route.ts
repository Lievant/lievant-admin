import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const q = request.nextUrl.searchParams.get('q') ?? '';
  const limit = request.nextUrl.searchParams.get('limit') ?? '10';
  try {
    const data = await apiFetch(`/auth/users/search?q=${encodeURIComponent(q)}&limit=${limit}`);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([]);
  }
}
