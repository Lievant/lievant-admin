import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiFetch } from '@/lib/api';
import { getCognitoCallbackRedirectUri } from '@/lib/cognito';

const ACCESS_TOKEN_MAX_AGE = 60 * 60;
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7;

interface SsoCallbackResponse {
  accessToken: string;
  refreshToken: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const { searchParams } = request.nextUrl;

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const storedState = request.cookies.get('oauth_state')?.value;

  if (error || !code || !state || !storedState || state !== storedState) {
    const response = NextResponse.redirect(`${appUrl}/login?error=sso`);
    response.cookies.delete('oauth_state');
    return response;
  }

  try {
    const tokens = await apiFetch<SsoCallbackResponse>('/auth/sso/callback', {
      method: 'POST',
      body: JSON.stringify({ code, redirectUri: getCognitoCallbackRedirectUri() }),
    });

    const response = NextResponse.redirect(`${appUrl}/dashboard`);

    response.cookies.set('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: ACCESS_TOKEN_MAX_AGE,
      path: '/',
    });
    response.cookies.set('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: REFRESH_TOKEN_MAX_AGE,
      path: '/',
    });
    response.cookies.delete('oauth_state');

    return response;
  } catch (err) {
    const reason = err instanceof ApiError && err.status === 403 ? 'unregistered' : 'sso';
    const response = NextResponse.redirect(`${appUrl}/login?error=${reason}`);
    response.cookies.delete('oauth_state');
    return response;
  }
}
