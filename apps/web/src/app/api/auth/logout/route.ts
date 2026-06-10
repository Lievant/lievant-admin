import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const accessToken = request.cookies.get('access_token')?.value;

  if (accessToken) {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      // El logout es best-effort: las cookies se limpian de todas formas.
    }
  }

  const response = NextResponse.redirect(`${appUrl}/login`);
  response.cookies.delete('access_token');
  response.cookies.delete('refresh_token');

  return response;
}
