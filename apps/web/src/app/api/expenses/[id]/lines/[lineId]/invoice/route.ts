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

type Ctx = { params: Promise<{ id: string; lineId: string }> };

// El multipart se reenvía tal cual: fijar Content-Type manualmente rompería el
// boundary que generó el navegador.
export async function POST(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const { id, lineId } = await params;
  return relay(
    await fetch(`${API_URL}/expenses/${id}/lines/${lineId}/invoice`, {
      method: 'POST',
      headers: auth(request),
      body: await request.formData(),
    }),
  );
}

export async function GET(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const { id, lineId } = await params;
  return relay(
    await fetch(`${API_URL}/expenses/${id}/lines/${lineId}/invoice`, { headers: auth(request) }),
  );
}
