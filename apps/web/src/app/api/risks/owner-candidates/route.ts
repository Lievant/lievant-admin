import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

/** Candidatos a dueño (id, nombre, correo). El permiso sgsi.riesgos.write lo exige el API. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const q = request.nextUrl.searchParams.get('q') ?? '';
  const token = request.cookies.get('access_token')?.value;
  const res = await fetch(`${API_URL}/risks/owner-candidates?q=${encodeURIComponent(q)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  });
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}
