import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

/**
 * Reenvía la petición al API con el token de la cookie. Siempre `no-store`:
 * nada de este módulo (clasificación C3) debe quedar en el Data Cache de Next.
 */
export async function proxyPasswords(
  request: NextRequest,
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
): Promise<NextResponse> {
  const accessToken = request.cookies.get('access_token')?.value;
  const hasBody = method === 'POST' || method === 'PATCH';

  const res = await fetch(`${API_URL}/passwords${path}${request.nextUrl.search}`, {
    method,
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(hasBody ? { body: await request.text() } : {}),
    cache: 'no-store',
  });

  const body = res.status === 204 ? null : await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
