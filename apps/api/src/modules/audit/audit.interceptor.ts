import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AuditService } from './audit.service';

const WRITE_METHODS = ['POST', 'PATCH', 'PUT', 'DELETE'];

const METHOD_ACTION: Record<string, string> = {
  POST: 'create',
  PATCH: 'update',
  PUT: 'update',
  DELETE: 'delete',
};

/**
 * Primer segmento de la ruta después del prefijo del API. `/api/v1/tickets/123`
 * da 'tickets'. Es deliberadamente simple: la lista de módulos auditados vive
 * en audit.module_config, así que un segmento que no esté ahí se ignora solo.
 */
function moduleFromUrl(url: string): string | null {
  const path = url.split('?')[0] ?? '';
  const parts = path.split('/').filter(Boolean);
  const vIndex = parts.findIndex((p) => /^v\d+$/.test(p));
  const candidate = vIndex >= 0 ? parts[vIndex + 1] : parts[parts.length > 1 ? 1 : 0];
  return candidate ?? null;
}

interface RequestUser {
  id?: string;
  email?: string;
  name?: string;
  area?: string;
}

/**
 * Registra automáticamente las escrituras exitosas y los errores 5xx.
 *
 * Todo lo que hace es fire-and-forget: ni el log de actividad ni el de errores
 * pueden retrasar ni tumbar la operación que están observando, así que no se
 * espera su promesa y sus fallos se tragan dentro del propio servicio.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest();
    const method: string = request.method;
    const url: string = request.originalUrl ?? request.url ?? '';
    const user: RequestUser | undefined = request.user;
    const module = moduleFromUrl(url);
    const startedAt = Date.now();

    const ip: string | null = request.headers?.['x-forwarded-for'] ?? request.ip ?? null;
    const userAgent: string | null = request.headers?.['user-agent'] ?? null;

    // La sesión se refresca en cualquier request autenticado, no solo en las
    // escrituras: si solo contáramos escrituras, alguien que pasa la mañana
    // consultando aparecería como inactivo.
    if (user?.id) {
      void this.auditService.touchSession(user.id, module);
    }

    if (!WRITE_METHODS.includes(method)) return next.handle();

    return next.handle().pipe(
      tap((response) => {
        void this.logWrite(module, method, user, ip, response);
      }),
      catchError((err: unknown) => {
        void this.logFailure(err, { module, method, url, user, ip, userAgent, startedAt, request });
        return throwError(() => err);
      }),
    );
  }

  private async logWrite(
    module: string | null,
    method: string,
    user: RequestUser | undefined,
    ip: string | null,
    response: unknown,
  ) {
    if (!(await this.auditService.shouldLogWrite(module)) || !module) return;

    const body = (response ?? {}) as Record<string, unknown>;
    const entityName =
      (body.name as string) ??
      (body.fullName as string) ??
      (body.title as string) ??
      (body.displayId as string) ??
      null;

    await this.auditService.logActivity({
      userId: user?.id ?? null,
      userEmail: user?.email ?? null,
      userName: user?.name ?? null,
      department: user?.area ?? null,
      action: METHOD_ACTION[method] ?? 'update',
      module,
      entityId: (body.id as string) ?? null,
      entityName,
      ipAddress: ip,
    });
  }

  /**
   * Solo se guardan los 5xx. Un 400 o un 403 son el sistema funcionando —el
   * cliente mandó algo inválido o no tenía permiso—; meterlos aquí ahogaría los
   * bugs reales entre miles de validaciones fallidas.
   *
   * El 403 sí se registra, pero como evento de seguridad, que es donde importa.
   */
  private async logFailure(
    err: unknown,
    ctx: {
      module: string | null;
      method: string;
      url: string;
      user: RequestUser | undefined;
      ip: string | null;
      userAgent: string | null;
      startedAt: number;
      request: { body?: Record<string, unknown> };
    },
  ) {
    const status = err instanceof HttpException ? err.getStatus() : 500;

    if (status === 403) {
      await this.auditService.logSecurity({
        eventType: 'access_denied',
        userId: ctx.user?.id ?? null,
        userEmail: ctx.user?.email ?? null,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
        module: ctx.module,
        resourceId: ctx.url,
        severity: 'warning',
      });
      return;
    }

    if (status < 500) return;

    const error = err as Error;
    await this.auditService.logError({
      errorCode: error?.name ?? null,
      message: error?.message ?? 'Error desconocido',
      stackTrace: error?.stack ?? null,
      module: ctx.module,
      endpoint: ctx.url.slice(0, 500),
      httpMethod: ctx.method,
      httpStatus: status,
      userId: ctx.user?.id ?? null,
      userEmail: ctx.user?.email ?? null,
      requestBody: ctx.request?.body ?? null,
      durationMs: Date.now() - ctx.startedAt,
    });
  }
}
