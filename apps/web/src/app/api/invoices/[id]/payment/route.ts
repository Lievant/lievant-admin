import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  const accessToken = request.cookies.get('access_token')?.value;
  const contentType = request.headers.get('content-type');

  const apiResponse = await fetch(`${API_URL}/invoices/${id}/payment`, {
    method: 'POST',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(contentType ? { 'Content-Type': contentType } : {}),
    },
    body: request.body,
    duplex: 'half',
  } as RequestInit);

  const body = await apiResponse.text();

  return new NextResponse(body, {
    status: apiResponse.status,
    headers: { 'Content-Type': apiResponse.headers.get('content-type') ?? 'application/json' },
  });
}
