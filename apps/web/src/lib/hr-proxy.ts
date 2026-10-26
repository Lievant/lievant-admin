import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

/**
 * Reenvía la petición a `/hr/<path>` del API con el token de la cookie. Los
 * Client Components de la Matriz de Puestos hablan con el API solo por aquí.
 */
export async function proxyHr(request: NextRequest, path: string): Promise<NextResponse> {
  const accessToken = request.cookies.get('access_token')?.value;
  const hasBody = request.method !== 'GET' && request.method !== 'DELETE';

  const res = await fetch(`${API_URL}/hr${path}${request.nextUrl.search}`, {
    method: request.method,
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    ...(hasBody ? { body: await request.text() } : {}),
    cache: 'no-store',
  });

  // Un 204 (baja lógica) no admite cuerpo.
  if (res.status === 204) return new NextResponse(null, { status: 204 });

  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}
