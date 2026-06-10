import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from './entities/user.entity';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { UsersService } from './users.service';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateUser(userId: string): Promise<User> {
    const user = await this.usersService.findById(userId);

    if (!user.isActive) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    return user;
  }

  async getMe(userId: string): Promise<User> {
    return this.usersService.findById(userId);
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
}
