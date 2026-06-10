import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AuthService, AuthTokens, SsoLoginResult } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { SsoCallbackDto } from './dto/sso-callback.dto';
import { User } from './entities/user.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sso/callback')
  @HttpCode(HttpStatus.OK)
  ssoCallback(@Body() dto: SsoCallbackDto): Promise<SsoLoginResult> {
    return this.authService.loginWithSso(dto.code, dto.redirectUri);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: User): Promise<User> {
    return this.authService.getMe(user.id);
  }

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  refresh(@CurrentUser() user: User): Promise<AuthTokens> {
    return this.authService.refreshTokens(user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@CurrentUser() user: User): Promise<void> {
    return this.authService.logout(user.id);
  }
}
