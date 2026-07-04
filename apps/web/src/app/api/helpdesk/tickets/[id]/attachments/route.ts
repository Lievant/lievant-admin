import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const accessToken = request.cookies.get('access_token')?.value;

  const res = await fetch(`${API_URL}/helpdesk/tickets/${id}/attachments`, {
    headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
  });

  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const accessToken = request.cookies.get('access_token')?.value;

  // Forward FormData as-is; do NOT set Content-Type manually (browser adds boundary)
  const body = await request.arrayBuffer();
  const contentType = request.headers.get('content-type') ?? 'multipart/form-data';

  const res = await fetch(`${API_URL}/helpdesk/tickets/${id}/attachments`, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body,
  });

  const resBody = await res.text();
  return new NextResponse(resBody, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}
