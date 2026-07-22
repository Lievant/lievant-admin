import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

function authHeaders(req: NextRequest) {
  const token = req.cookies.get('access_token')?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; empId: string }> }): Promise<NextResponse> {
  const { id, empId } = await params;
  const res = await fetch(`${API_URL}/projects/${id}/members/${empId}`, {
    method: 'DELETE',
    headers: authHeaders(request),
  });
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}
