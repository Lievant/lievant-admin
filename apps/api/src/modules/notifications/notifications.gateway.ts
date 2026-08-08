import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import type { Notification } from './entities/notification.entity';

/**
 * Empuja las notificaciones nuevas al navegador del destinatario.
 *
 * Cada usuario se une a una room con su propio id, así que emitir a `userId`
 * llega a todas sus pestañas y a ningún otro usuario.
 *
 * La identidad NO se toma de `handshake.auth.userId`: eso lo escribe el cliente
 * y bastaría con mandar el id ajeno para escuchar las notificaciones de otro.
 * Se exige el mismo access token JWT que la API REST y el id sale del payload
 * firmado.
 */
@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  handleConnection(client: Socket): void {
    const raw = client.handshake.auth?.token as unknown;
    const token = typeof raw === 'string' ? raw.replace(/^Bearer\s+/i, '') : null;

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET', 'CHANGE_THIS_IN_SECRETS_MANAGER'),
      });

      // Los refresh tokens no habilitan sesión de socket, igual que en la API REST.
      if (payload.type !== 'access' || !payload.sub) {
        client.disconnect(true);
        return;
      }

      void client.join(payload.sub);
      client.data.userId = payload.sub;
    } catch {
      // Token inválido o expirado: se cierra sin filtrar el motivo.
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    // socket.io saca al cliente de sus rooms solo; queda el log para depurar.
    this.logger.debug(`Socket desconectado: ${String(client.data?.userId ?? 'anónimo')}`);
  }

  /** Notificación recién creada → a todas las pestañas del destinatario. */
  sendToUser(userId: string, notification: Notification): void {
    // El server no existe si el adaptador WS no arrancó (p. ej. en tests).
    if (!this.server) return;
    this.server.to(userId).emit('new_notification', notification);
  }

  /** Empuja el conteo tras leer/responder, para que el badge no quede obsoleto. */
  sendUnreadCount(userId: string, count: number): void {
    if (!this.server) return;
    this.server.to(userId).emit('unread_count', { count });
  }
}
