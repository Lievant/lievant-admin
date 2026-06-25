import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

const APP_TOKEN_CACHE_KEY = 'graph:app-token';
const APP_TOKEN_CACHE_TTL_SECONDS = 55 * 60; // El token de Azure AD expira a los 60 minutos

export interface CalendarEventDto {
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  body?: { contentType: 'HTML' | 'Text'; content: string };
  location?: { displayName: string };
}

interface AzureAdTokenResponse {
  access_token: string;
}

interface GraphCalendarEventResponse {
  id: string;
}

/**
 * NOTA: Para que getAppToken funcione, la app registration de Azure AD necesita
 * permisos de APLICACIÓN (no delegados) "Calendars.ReadWrite" con consentimiento
 * de administrador. Esto es independiente de los scopes delegados configurados
 * en el Identity Provider de Cognito. Paulo otorgará este permiso en el portal
 * de Azure AD — hasta entonces, getAppToken devolverá un error de Azure AD.
 */
@Injectable()
export class GraphTokenService {
  private memoryTokenCache: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async getAppToken(): Promise<string> {
    if (this.redisService.isAvailable) {
      const cached = await this.redisService.get(APP_TOKEN_CACHE_KEY);
      if (cached) {
        return cached;
      }
    } else if (this.memoryTokenCache && this.memoryTokenCache.expiresAt > Date.now()) {
      return this.memoryTokenCache.value;
    }

    const tenantId = this.configService.getOrThrow<string>('AZURE_AD_TENANT_ID');
    const clientId = this.configService.getOrThrow<string>('MICROSOFT_CLIENT_ID');
    const clientSecret = this.configService.getOrThrow<string>('MICROSOFT_CLIENT_SECRET');

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
    });

    let response: Response;
    try {
      response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
    } catch {
      throw new UnauthorizedException('No se pudo contactar a Azure AD para obtener el token de aplicación');
    }

    if (!response.ok) {
      throw new UnauthorizedException('No se pudo obtener el token de aplicación de Microsoft Graph');
    }

    const data = (await response.json()) as AzureAdTokenResponse;

    if (this.redisService.isAvailable) {
      await this.redisService.set(APP_TOKEN_CACHE_KEY, data.access_token, APP_TOKEN_CACHE_TTL_SECONDS);
    } else {
      this.memoryTokenCache = {
        value: data.access_token,
        expiresAt: Date.now() + APP_TOKEN_CACHE_TTL_SECONDS * 1000,
      };
    }

    return data.access_token;
  }

  async createCalendarEvent(userEmail: string, event: CalendarEventDto): Promise<string> {
    const token = await this.getAppToken();

    const response = await fetch(`https://graph.microsoft.com/v1.0/users/${userEmail}/calendar/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      throw new InternalServerErrorException('No se pudo crear el evento en el calendario de Microsoft');
    }

    const data = (await response.json()) as GraphCalendarEventResponse;
    return data.id;
  }

  async deleteCalendarEvent(userEmail: string, eventId: string): Promise<void> {
    const token = await this.getAppToken();

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${userEmail}/calendar/events/${eventId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!response.ok && response.status !== 404) {
      throw new InternalServerErrorException('No se pudo eliminar el evento del calendario de Microsoft');
    }
  }
}
