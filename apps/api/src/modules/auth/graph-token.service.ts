import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

const APP_TOKEN_CACHE_KEY = 'graph:app-token';
const APP_TOKEN_CACHE_TTL_SECONDS = 55 * 60; // El token de Azure AD expira a los 60 minutos

export interface GraphAttendee {
  emailAddress: { address: string; name?: string };
  type: 'required' | 'optional';
}

export interface CalendarEventDto {
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  body?: { contentType: 'HTML' | 'Text'; content: string };
  location?: { displayName: string };
  attendees?: GraphAttendee[];
  // Cuando es true, Graph genera automáticamente una reunión de Teams (con link)
  // que los invitados reciben en la invitación, igual que al agendar desde Outlook.
  isOnlineMeeting?: boolean;
  onlineMeetingProvider?: 'teamsForBusiness';
}

interface AzureAdTokenResponse {
  access_token: string;
}

interface GraphCalendarEventResponse {
  id: string;
  // Graph devuelve el link de Teams aquí cuando el evento se creó con
  // isOnlineMeeting: true. Si no, la propiedad no viene.
  onlineMeeting?: { joinUrl?: string } | null;
}

/** Resultado de crear un evento: id de Graph y link de Teams si se generó. */
export interface CreatedCalendarEvent {
  id: string;
  joinUrl: string | null;
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

  /**
   * Crea el evento y devuelve también el link de Teams. Antes solo se devolvía
   * el id y el `joinUrl` que Graph ya generaba se descartaba, por lo que la
   * reserva nunca podía mostrar el botón de "Unirse a Teams".
   */
  async createCalendarEvent(userEmail: string, event: CalendarEventDto): Promise<CreatedCalendarEvent> {
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
      const errBody = await response.text().catch(() => '');
      // Logging explícito del error real de Graph para diagnóstico (Ajuste 6).
      console.error(`[Graph] createCalendarEvent ${userEmail} → ${response.status}: ${errBody}`);
      throw new InternalServerErrorException(
        `No se pudo crear el evento en el calendario de Microsoft (Graph ${response.status})`,
      );
    }

    const data = (await response.json()) as GraphCalendarEventResponse;
    return { id: data.id, joinUrl: data.onlineMeeting?.joinUrl ?? null };
  }

  /**
   * Actualiza el evento y devuelve el link de Teams que quede tras el PATCH.
   * Importa para las reservas creadas antes de que se persistiera el joinUrl: al
   * editarlas, Graph crea la reunión y esta es la única oportunidad de guardarlo.
   * Devuelve null si Graph no lo entrega o si el evento ya no existe (404).
   */
  async updateCalendarEvent(
    userEmail: string,
    eventId: string,
    event: Partial<CalendarEventDto>,
  ): Promise<{ joinUrl: string | null }> {
    const token = await this.getAppToken();

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${userEmail}/calendar/events/${eventId}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      },
    );

    if (!response.ok && response.status !== 404) {
      const errBody = await response.text().catch(() => '');
      console.error(`[Graph] updateCalendarEvent ${userEmail} → ${response.status}: ${errBody}`);
      throw new InternalServerErrorException(
        `No se pudo actualizar el evento en el calendario de Microsoft (Graph ${response.status})`,
      );
    }

    if (!response.ok) return { joinUrl: null };

    const data = (await response.json().catch(() => null)) as GraphCalendarEventResponse | null;
    return { joinUrl: data?.onlineMeeting?.joinUrl ?? null };
  }

  async getUserPhoto(userEmail: string): Promise<Buffer | null> {
    try {
      const token = await this.getAppToken();
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/users/${userEmail}/photo/$value`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error(`[Graph] getUserPhoto ${userEmail} → ${response.status}: ${errText}`);
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err) {
      console.error(`[Graph] getUserPhoto error:`, err);
      return null;
    }
  }

  /**
   * Cancela un evento notificando a los invitados. A diferencia de DELETE (que borra
   * silenciosamente), la acción /cancel hace que M365 envíe el correo de cancelación
   * a todos los asistentes. Solo aplica cuando el usuario es el organizador (que es
   * nuestro caso: el evento se creó en su calendario). Si /cancel falla, cae a DELETE
   * para no dejar el evento colgado.
   */
  async cancelCalendarEvent(userEmail: string, eventId: string, comment?: string): Promise<void> {
    const token = await this.getAppToken();

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${userEmail}/events/${eventId}/cancel`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: comment ?? 'La reserva de sala ha sido cancelada.' }),
      },
    );

    if (response.ok || response.status === 404) {
      return;
    }

    const errBody = await response.text().catch(() => '');
    console.error(`[Graph] cancelCalendarEvent ${userEmail} → ${response.status}: ${errBody}`);
    // Fallback: eliminar el evento directamente (sin notificación) para no dejarlo colgado.
    await this.deleteCalendarEvent(userEmail, eventId);
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
