import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

/**
 * Reenvía la petición a `/audits/equipment/<path>` del API con el token de la cookie.
 * Es la única vía por la que los Client Components hablan con la
 * Auditoría de Equipos: nunca importan `lib/api.ts`.
 */
export async function proxyEquipmentAudits(request: NextRequest, path: string): Promise<NextResponse> {
  const accessToken = request.cookies.get('access_token')?.value;
  const hasBody = request.method !== 'GET' && request.method !== 'DELETE';

  const res = await fetch(`${API_URL}/audits/equipment${path}${request.nextUrl.search}`, {
    method: request.method,
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    ...(hasBody ? { body: await request.text() } : {}),
    cache: 'no-store',
  });

  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}
