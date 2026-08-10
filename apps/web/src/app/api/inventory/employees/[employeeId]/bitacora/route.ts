import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> },
): Promise<NextResponse> {
  const { employeeId } = await params;
  const token = request.cookies.get('access_token')?.value;

  const res = await fetch(`${API_URL}/inventory/employees/${employeeId}/bitacora/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  });

  // El error del backend (p. ej. sin responsiva) viaja como JSON.
  if (!res.ok) {
    return new NextResponse(await res.text(), {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
    });
  }

  // arrayBuffer y no text(): el .docx es binario.
  const buffer = await res.arrayBuffer();
  const headers = new Headers();
  headers.set(
    'Content-Type',
    res.headers.get('content-type') ??
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  );
  const disposition = res.headers.get('content-disposition');
  if (disposition) headers.set('Content-Disposition', disposition);

  return new NextResponse(buffer, { status: 200, headers });
}
