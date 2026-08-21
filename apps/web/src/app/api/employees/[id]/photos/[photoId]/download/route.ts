import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> },
): Promise<NextResponse> {
  const { id, photoId } = await params;
  const accessToken = request.cookies.get('access_token')?.value;

  const apiResponse = await fetch(`${API_URL}/employees/${id}/photos/${photoId}/download`, {
    headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
  });

  if (!apiResponse.ok) {
    const body = await apiResponse.text();
    return new NextResponse(body, {
      status: apiResponse.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Se reenvía el body tal cual (stream) para no cargar la foto en memoria.
  return new NextResponse(apiResponse.body, {
    status: apiResponse.status,
    headers: {
      'Content-Type': apiResponse.headers.get('content-type') ?? 'application/octet-stream',
      ...(apiResponse.headers.get('content-disposition')
        ? { 'Content-Disposition': apiResponse.headers.get('content-disposition') as string }
        : {}),
    },
  });
}
