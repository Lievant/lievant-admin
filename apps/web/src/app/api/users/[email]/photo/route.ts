import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> },
): Promise<NextResponse> {
  const { email } = await params;
  const accessToken = request.cookies.get('access_token')?.value;

  const apiResponse = await fetch(`${API_URL}/auth/users/${encodeURIComponent(email)}/photo`, {
    headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
  });

  if (!apiResponse.ok) {
    return new NextResponse(null, { status: apiResponse.status });
  }

  const imageBuffer = await apiResponse.arrayBuffer();
  return new NextResponse(imageBuffer, {
    status: 200,
    headers: {
      'Content-Type': apiResponse.headers.get('Content-Type') ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
