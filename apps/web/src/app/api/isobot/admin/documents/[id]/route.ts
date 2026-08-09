import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

function authHeaders(req: NextRequest) {
  const token = req.cookies.get('access_token')?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const formData = await request.formData();
  const upstreamForm = new FormData();
  for (const [key, value] of formData.entries()) {
    upstreamForm.append(key, value);
  }

  const res = await fetch(`${API_URL}/isobot/admin/documents/${id}`, {
    method: 'PUT',
    headers: authHeaders(request),
    body: upstreamForm,
  });
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const res = await fetch(`${API_URL}/isobot/admin/documents/${id}`, {
    method: 'DELETE',
    headers: authHeaders(request),
  });
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}
