import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY, RequiredPermission } from '../decorators/permission.decorator';
import { User } from '../entities/user.entity';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RequiredPermission | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required) return true;

    const { user } = context.switchToHttp().getRequest<{ user: User }>();

    const isSuperAdmin = user.roles?.some((r) => r.name === 'SUPER_ADMIN') ?? false;

    // SUPER_ADMIN bypasa cualquier verificación de permiso
    if (isSuperAdmin) return true;

    // section='admin' es exclusivo de SUPER_ADMIN — ningún override individual
    // puede conceder acceso a gestión de usuarios/roles/catálogos del sistema
    if (required.section === 'admin') {
      throw new ForbiddenException('Solo SUPER_ADMIN puede acceder a esta sección');
    }

    // Override directo del usuario (granted=false revoca, granted=true concede)
    const override = user.userPermissions?.find(
      (up) =>
        up.permission?.section === required.section &&
        up.permission?.module === required.module &&
        up.permission?.action === required.action,
    );

    if (override !== undefined) {
      if (!override.granted) {
        throw new ForbiddenException('No tienes permisos para acceder a este recurso');
      }
      return true;
    }

    // Verificación vía roles
    const hasViaRole =
      user.roles?.some((role) =>
        role.permissions?.some(
          (p) =>
            p.section === required.section &&
            p.module === required.module &&
            p.action === required.action,
        ),
      ) ?? false;

    if (!hasViaRole) {
      throw new ForbiddenException('No tienes permisos para acceder a este recurso');
    }

    return true;
  }
}
