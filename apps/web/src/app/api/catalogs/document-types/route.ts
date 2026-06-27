import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const accessToken = request.cookies.get('access_token')?.value;
  const qs = request.nextUrl.search;

  const apiResponse = await fetch(`${API_URL}/catalogs/document_types/active${qs}`, {
    headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
  });

  const body = await apiResponse.text();
  return new NextResponse(body, {
    status: apiResponse.status,
    headers: { 'Content-Type': apiResponse.headers.get('content-type') ?? 'application/json' },
  });
}
