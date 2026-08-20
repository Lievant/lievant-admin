import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const token = request.cookies.get('access_token')?.value;

  const res = await fetch(`${API_URL}/clients/${id}/contracts/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: await request.text(),
  });

  // Error del API → se reenvía como JSON para que el modal muestre el mensaje.
  if (!res.ok) {
    return new NextResponse(await res.text(), {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
    });
  }

  // El .docx puede rondar los 100 KB: se reenvía el binario tal cual, con el
  // Content-Disposition del API para que el navegador conserve el nombre.
  return new NextResponse(await res.arrayBuffer(), {
    status: 200,
    headers: {
      'Content-Type':
        res.headers.get('content-type') ??
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': res.headers.get('content-disposition') ?? 'attachment',
    },
  });
}
