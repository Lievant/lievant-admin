import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService, AuthTokens, MeResponse, SsoLoginResult } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { SsoCallbackDto } from './dto/sso-callback.dto';
import { SetUserPermissionDto } from './dto/set-user-permission.dto';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';
import { UserPermission } from './entities/user-permission.entity';
import { User } from './entities/user.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { RolesService } from './roles.service';
import { UsersService } from './users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly rolesService: RolesService,
    private readonly usersService: UsersService,
  ) {}

  @Post('sso/callback')
  @HttpCode(HttpStatus.OK)
  ssoCallback(@Body() dto: SsoCallbackDto): Promise<SsoLoginResult> {
    return this.authService.loginWithSso(dto.code, dto.redirectUri);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: User): Promise<MeResponse> {
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

  @UseGuards(JwtAuthGuard)
  @Get('roles')
  getRoles(): Promise<Role[]> {
    return this.rolesService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('permissions')
  listPermissions(): Promise<Permission[]> {
    return this.usersService.listAllPermissions();
  }

  @UseGuards(JwtAuthGuard)
  @Get('users/:id/permissions')
  getUserPermissions(@Param('id', ParseUUIDPipe) id: string): Promise<UserPermission[]> {
    return this.usersService.getUserPermissionOverrides(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('users/:id/permissions')
  setUserPermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserPermissionDto,
    @CurrentUser() actor: User,
  ): Promise<UserPermission> {
    return this.usersService.setUserPermission(id, dto.permissionId, dto.granted, actor.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('users/:id/permissions/:permissionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeUserPermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ): Promise<void> {
    return this.usersService.removeUserPermission(id, permissionId);
  }
}
