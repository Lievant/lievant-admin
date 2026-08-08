import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

function auth(request: NextRequest): Record<string, string> {
  const token = request.cookies.get('access_token')?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function relay(res: Response): Promise<NextResponse> {
  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}

// El multipart se reenvía tal cual: fijar Content-Type rompería el boundary.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> },
): Promise<NextResponse> {
  const { id, lineId } = await params;
  return relay(await fetch(`${API_URL}/credit-cards/reports/${id}/lines/${lineId}/invoice`, {
    method: 'POST',
    headers: auth(request),
    body: await request.formData(),
  }));
}
