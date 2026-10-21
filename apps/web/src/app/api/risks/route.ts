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

/** Matriz de Riesgos: lista (sgsi.riesgos.read). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return relay(await fetch(`${API_URL}/risks`, { headers: authHeaders(request), cache: 'no-store' }));
}

/** Alta de un riesgo (sgsi.riesgos.write). El permiso lo exige el API. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return relay(
    await fetch(`${API_URL}/risks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(request) },
      body: await request.text(),
    }),
  );
}
