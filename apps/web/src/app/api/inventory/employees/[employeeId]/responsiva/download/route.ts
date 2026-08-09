import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> },
): Promise<NextResponse> {
  const { employeeId } = await params;
  const token = request.cookies.get('access_token')?.value;

  const res = await fetch(`${API_URL}/inventory/employees/${employeeId}/responsiva/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  });

  // Un error del backend viaja como JSON; solo el caso bueno es binario.
  if (!res.ok) {
    return new NextResponse(await res.text(), {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
    });
  }

  // arrayBuffer y no text(): el .docx es binario y text() lo corrompería.
  const buffer = await res.arrayBuffer();
  const headers = new Headers();
  headers.set(
    'Content-Type',
    res.headers.get('content-type') ??
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  );
  // Se conserva el Content-Disposition del backend, que ya trae el nombre con
  // el folio y el acentuado en filename*.
  const disposition = res.headers.get('content-disposition');
  if (disposition) headers.set('Content-Disposition', disposition);

  return new NextResponse(buffer, { status: 200, headers });
}
