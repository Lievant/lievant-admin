import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> },
): Promise<NextResponse> {
  const { id, lineId } = await params;
  const token = request.cookies.get('access_token')?.value;

  const res = await fetch(`${API_URL}/expenses/${id}/lines/${lineId}/invoice/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: await request.text(),
  });

  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}
