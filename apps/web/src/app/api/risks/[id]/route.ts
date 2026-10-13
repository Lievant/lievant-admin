import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

function authHeaders(req: NextRequest): Record<string, string> {
  const token = req.cookies.get('access_token')?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function relay(res: Response): Promise<NextResponse> {
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const { id } = await params;
  return relay(await fetch(`${API_URL}/risks/${id}`, { headers: authHeaders(request), cache: 'no-store' }));
}

export async function PATCH(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const { id } = await params;
  return relay(
    await fetch(`${API_URL}/risks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(request) },
      body: await request.text(),
    }),
  );
}

/** Baja lógica en el API. */
export async function DELETE(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const { id } = await params;
  return relay(await fetch(`${API_URL}/risks/${id}`, { method: 'DELETE', headers: authHeaders(request) }));
}
