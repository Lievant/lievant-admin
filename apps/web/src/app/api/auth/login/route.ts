import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { getCognitoAuthorizeUrl } from '@/lib/cognito';

export function GET(): NextResponse {
  const state = randomUUID();
  const response = NextResponse.redirect(getCognitoAuthorizeUrl(state));

  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
  });

  return response;
}
