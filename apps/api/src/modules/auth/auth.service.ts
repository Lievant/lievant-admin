import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { CognitoService } from './cognito.service';
import { User } from './entities/user.entity';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { UsersService } from './users.service';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SsoLoginResult extends AuthTokens {
  user: User;
}

export interface MeResponse {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  location: string | null;
  roles: { id: string; name: string }[];
  permissions: { section: string; module: string; action: string }[];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly cognitoService: CognitoService,
  ) {}

  async validateUser(userId: string): Promise<User> {
    const user = await this.usersService.findById(userId);

    if (!user.isActive) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    return user;
  }

  async getMe(userId: string): Promise<MeResponse> {
    const user = await this.usersService.findById(userId);

    const permMap = new Map<string, { section: string; module: string; action: string }>();
    for (const role of user.roles ?? []) {
      for (const perm of role.permissions ?? []) {
        if (perm.section && perm.module && perm.action) {
          permMap.set(`${perm.section}:${perm.module}:${perm.action}`, {
            section: perm.section,
            module: perm.module,
            action: perm.action,
          });
        }
      }
    }

    for (const up of user.userPermissions ?? []) {
      const p = up.permission;
      if (!p?.section || !p?.module || !p?.action) continue;
      const key = `${p.section}:${p.module}:${p.action}`;
      if (up.granted) {
        permMap.set(key, { section: p.section, module: p.module, action: p.action });
      } else {
        permMap.delete(key);
      }
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      location: user.location,
      roles: (user.roles ?? []).map((r) => ({ id: r.id, name: r.name })),
      permissions: Array.from(permMap.values()),
    };
  }

  issueTokens(user: User): AuthTokens {
    const roles = user.roles?.map((role) => role.name) ?? [];

    const accessPayload: JwtPayload = { sub: user.id, email: user.email, roles, type: 'access' };
    const refreshPayload: JwtPayload = { sub: user.id, email: user.email, roles, type: 'refresh' };

    return {
      accessToken: this.jwtService.sign(accessPayload, {
        expiresIn: this.configService.get<string>('JWT_EXPIRY', '15m'),
      }),
      refreshToken: this.jwtService.sign(refreshPayload, {
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRY', '7d'),
      }),
    };
  }

  async refreshTokens(user: User): Promise<AuthTokens> {
    if (!user.isActive) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    return this.issueTokens(user);
  }

  async logout(_userId: string): Promise<void> {
    // Stateless JWT: el cliente descarta los tokens. Si se agrega
    // almacenamiento de refresh tokens, aquí se invalidarían.
  }

  async loginWithSso(code: string, redirectUri: string): Promise<SsoLoginResult> {
    const { idToken } = await this.cognitoService.exchangeCodeForTokens(code, redirectUri);
    const claims = await this.cognitoService.verifyIdToken(idToken);

    let user = await this.usersService.findByCognitoId(claims.sub);

    if (!user) {
      user = await this.usersService.linkCognitoIdByEmail(claims.email, claims.sub);
    }

    if (!user) {
      throw new ForbiddenException(
        'Tu cuenta no está registrada en el sistema. Contacta a un administrador.',
      );
    }

    if (!user.isActive) {
      throw new ForbiddenException('Usuario inactivo');
    }

    await this.usersService.recordLogin(user.id);

    return { ...this.issueTokens(user), user };
  }
}
