import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

/**
 * Reenvía la petición a `/sim-cards/<path>` del API con el token de la cookie.
 * Es la única vía por la que los Client Components hablan con el módulo de
 * líneas telefónicas: nunca importan `lib/api.ts`.
 */
export async function proxySimCards(request: NextRequest, path: string): Promise<NextResponse> {
  const accessToken = request.cookies.get('access_token')?.value;
  const hasBody = request.method !== 'GET' && request.method !== 'DELETE';

  const res = await fetch(`${API_URL}/sim-cards${path}${request.nextUrl.search}`, {
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
