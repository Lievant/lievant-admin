import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

/** RIAC: devuelve el Excel como archivo (con su Content-Disposition); si falla, el error JSON del API. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const accessToken = request.cookies.get('access_token')?.value;

  const res = await fetch(`${API_URL}/employees/trainings/report/export${request.nextUrl.search}`, {
    headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    cache: 'no-store',
  });

  if (!res.ok) {
    return new NextResponse(await res.text(), {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
    });
  }

  return new NextResponse(res.body, {
    status: res.status,
    headers: {
      'Content-Type':
        res.headers.get('content-type') ?? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ...(res.headers.get('content-disposition')
        ? { 'Content-Disposition': res.headers.get('content-disposition') as string }
        : {}),
    },
  });
}
