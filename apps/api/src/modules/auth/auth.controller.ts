import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiCookieAuth, ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import type { Env } from '../../config/env';
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from './auth.constants';
import { LoginDto, MeResponseDto, SessionResponseDto } from './auth.dto';
import { AuthService, type SessionResult } from './auth.service';
import type { AuthenticatedUser } from './auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { AcceptInvitationDto, AcceptInvitationResponseDto } from './invitations.dto';
import { InvitationsService } from './invitations.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly cookieSecure: boolean;

  constructor(
    private readonly auth: AuthService,
    private readonly invitations: InvitationsService,
    config: ConfigService<Env, true>,
  ) {
    this.cookieSecure =
      config.get('COOKIE_SECURE', { infer: true }) ??
      config.get('NODE_ENV', { infer: true }) === 'production';
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponseDto> {
    const session = await this.auth.login(dto.email, dto.password);
    return this.respondWithSession(res, session);
  }

  @Public()
  @ApiCookieAuth('refresh_token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponseDto> {
    const session = await this.auth.refresh(this.readRefreshCookie(req));
    return this.respondWithSession(res, session);
  }

  @Public()
  @ApiCookieAuth('refresh_token')
  @ApiNoContentResponse()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(this.readRefreshCookie(req));
    res.clearCookie(REFRESH_COOKIE_NAME, this.cookieOptions());
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('accept-invitation')
  acceptInvitation(@Body() dto: AcceptInvitationDto): Promise<AcceptInvitationResponseDto> {
    return this.invitations.accept(dto);
  }

  private respondWithSession(res: Response, session: SessionResult): SessionResponseDto {
    res.cookie(REFRESH_COOKIE_NAME, session.refreshToken, {
      ...this.cookieOptions(),
      expires: session.refreshExpiresAt,
    });
    return {
      access_token: session.accessToken,
      token_type: 'Bearer',
      expires_in: session.expiresIn,
      user: MeResponseDto.from(session.user),
    };
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
    };
  }

  private readRefreshCookie(req: Request): string | undefined {
    const value = (req.cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE_NAME];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }
}

@ApiTags('auth')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  @Get()
  me(@CurrentUser() user: AuthenticatedUser): MeResponseDto {
    return MeResponseDto.from(user);
  }
}
