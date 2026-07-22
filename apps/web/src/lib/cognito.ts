export function getCognitoAuthorizeUrl(state: string): string {
  const domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const params = new URLSearchParams({
    client_id: clientId ?? '',
    response_type: 'code',
    scope: 'openid email profile',
    redirect_uri: `${appUrl}/api/auth/callback`,
    identity_provider: 'Microsoft',
    state,
  });

  return `https://${domain}/oauth2/authorize?${params.toString()}`;
}

export function getCognitoCallbackRedirectUri(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return `${appUrl}/api/auth/callback`;
}
