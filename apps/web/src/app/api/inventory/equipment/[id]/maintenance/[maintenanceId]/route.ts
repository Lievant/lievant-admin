import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; maintenanceId: string }> },
): Promise<NextResponse> {
  const { id, maintenanceId } = await params;
  const accessToken = request.cookies.get('access_token')?.value;

  const res = await fetch(`${API_URL}/inventory/equipment/${id}/maintenance/${maintenanceId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: await request.text(),
  });

  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; maintenanceId: string }> },
): Promise<NextResponse> {
  const { id, maintenanceId } = await params;
  const accessToken = request.cookies.get('access_token')?.value;

  const res = await fetch(`${API_URL}/inventory/equipment/${id}/maintenance/${maintenanceId}`, {
    method: 'DELETE',
    headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
  });

  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}
