import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

/** Reenvía al API de HelpDesk con el token de la cookie. Sin caché: son datos por usuario. */
export async function proxyHelpdesk(
  request: NextRequest,
  path: string,
  method: 'GET' | 'POST' | 'PATCH' = 'GET',
): Promise<NextResponse> {
  const accessToken = request.cookies.get('access_token')?.value;
  const hasBody = method !== 'GET';
  const res = await fetch(`${API_URL}/helpdesk${path}`, {
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
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json', 'Cache-Control': 'no-store' },
  });
}
