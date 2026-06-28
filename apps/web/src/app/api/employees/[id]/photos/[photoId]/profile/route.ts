import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> },
): Promise<NextResponse> {
  const { id, photoId } = await params;
  const accessToken = request.cookies.get('access_token')?.value;

  const apiResponse = await fetch(`${API_URL}/employees/${id}/photos/${photoId}/profile`, {
    method: 'PATCH',
    headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
  });

  const body = await apiResponse.text();
  return new NextResponse(body || null, {
    status: apiResponse.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
