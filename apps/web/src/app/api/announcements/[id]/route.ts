import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const accessToken = request.cookies.get('access_token')?.value;

  const apiResponse = await fetch(`${API_URL}/auth/announcements/${id}`, {
    method: 'DELETE',
    headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    cache: 'no-store',
  });

  return new NextResponse(null, { status: apiResponse.status });
}
