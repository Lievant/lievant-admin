import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const accessToken = request.cookies.get('access_token')?.value;

  const res = await fetch(`${API_URL}/credit-cards/reports/${id}/download`, {
    headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
  });

  if (!res.ok) {
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // El .xlsx se reenvía como stream para no bufferizarlo en la compute de Amplify.
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
