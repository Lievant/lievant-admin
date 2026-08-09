import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get('access_token')?.value;
  const qs = request.nextUrl.searchParams.toString();

  const res = await fetch(`${API_URL}/inventory/employees${qs ? `?${qs}` : ''}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  });
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}
