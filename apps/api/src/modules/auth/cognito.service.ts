import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

export interface CognitoTokens {
  idToken: string;
  accessToken: string;
  refreshToken?: string | undefined;
}

export interface CognitoIdTokenClaims {
  sub: string;
  email: string;
  name?: string;
  'cognito:username': string;
}

interface CognitoTokenResponse {
  id_token: string;
  access_token: string;
  refresh_token?: string;
}

@Injectable()
export class CognitoService {
  private readonly verifier;

  constructor(private readonly configService: ConfigService) {
    this.verifier = CognitoJwtVerifier.create({
      userPoolId: this.configService.getOrThrow<string>('COGNITO_USER_POOL_ID'),
      tokenUse: 'id',
      clientId: this.configService.getOrThrow<string>('COGNITO_CLIENT_ID'),
    });
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<CognitoTokens> {
    const domain = this.configService.getOrThrow<string>('COGNITO_DOMAIN');
    const clientId = this.configService.getOrThrow<string>('COGNITO_CLIENT_ID');

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
    });

    let response: Response;
    try {
      response = await fetch(`https://${domain}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
    } catch {
      throw new UnauthorizedException('No se pudo contactar a Cognito para validar el código de autorización');
    }

    if (!response.ok) {
      throw new UnauthorizedException('No se pudo validar el código de autorización con Cognito');
    }

    const data = (await response.json()) as CognitoTokenResponse;

    return {
      idToken: data.id_token,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  }

  async verifyIdToken(idToken: string): Promise<CognitoIdTokenClaims> {
    try {
      const payload = await this.verifier.verify(idToken);
      return payload as unknown as CognitoIdTokenClaims;
    } catch {
      throw new UnauthorizedException('El token de Cognito no es válido');
    }
  }
}
