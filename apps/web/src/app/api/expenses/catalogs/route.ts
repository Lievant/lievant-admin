import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

function auth(request: NextRequest): Record<string, string> {
  const token = request.cookies.get('access_token')?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function relay(res: Response): Promise<NextResponse> {
  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return relay(await fetch(`${API_URL}/expenses/catalogs`, { headers: auth(request) }));
}
