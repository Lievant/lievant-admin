import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

// Proxy del reporte de Headcount: con format=xlsx reenvía el archivo como stream
// (con su Content-Disposition); sin él, el JSON de la tabla.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const accessToken = request.cookies.get('access_token')?.value;
  const qs = request.nextUrl.search;

  const res = await fetch(`${API_URL}/employees/headcount${qs}`, {
    headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
  });

  if (!res.ok || request.nextUrl.searchParams.get('format') !== 'xlsx') {
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
    });
  }

  return new NextResponse(res.body, {
    status: res.status,
    headers: {
      'Content-Type':
        res.headers.get('content-type') ??
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ...(res.headers.get('content-disposition')
        ? { 'Content-Disposition': res.headers.get('content-disposition') as string }
        : {}),
    },
  });
}
