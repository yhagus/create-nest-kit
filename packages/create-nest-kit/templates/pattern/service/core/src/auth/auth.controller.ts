import {
  Controller,
  Cookies,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import { ValidBody } from '../common/validation.js';
import { AuthThrottle } from '../infra/throttler/auth-throttle.js';
import { type SessionView, toSessionView } from '../modules/sessions/session.view.js';
import { SessionsService } from '../modules/sessions/sessions.service.js';
import { toUserView, type UserView } from '../modules/users/user.view.js';
import type { User } from '../modules/users/user.js';
import { UsersService } from '../modules/users/users.service.js';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResendVerificationDto,
  ResetPasswordDto,
  UpdateProfileDto,
  VerifyEmailDto,
} from './auth.dto.js';
import { InvalidRefreshTokenException } from './auth.exceptions.js';
import { AuthService } from './auth.service.js';
import { Authenticated, CurrentSessionId, CurrentUser, Public } from './decorators.js';
import { REFRESH_COOKIE, RefreshCookie } from './refresh-cookie.js';
import type { LoginView, TokenPairView } from './token-pair.view.js';

/** Sign-up, sign-in and the signed-in user's own account and devices. */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly sessionsService: SessionsService,
    private readonly refreshCookie: RefreshCookie,
  ) {}

  @Post('register')
  @Public()
  @AuthThrottle('register')
  async register(@ValidBody(RegisterDto) dto: RegisterDto): Promise<UserView> {
    return toUserView(await this.authService.register(dto));
  }

  /** Also sets the refresh token as an HttpOnly cookie for browsers. */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Public()
  @AuthThrottle('login')
  async login(
    @ValidBody(LoginDto) dto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) response: unknown,
  ): Promise<LoginView> {
    const { user, ...issued } = await this.authService.login(dto, {
      ip,
      userAgent: userAgent ?? null,
    });
    this.refreshCookie.set(response, issued);
    return { ...issued.tokens, user: toUserView(user) };
  }

  /** Takes the refresh token from the body or, failing that, from the cookie. */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Public()
  async refresh(
    @ValidBody(RefreshDto) dto: RefreshDto,
    @Cookies(REFRESH_COOKIE) cookieToken: string | undefined,
    @Res({ passthrough: true }) response: unknown,
  ): Promise<TokenPairView> {
    const refreshToken = dto.refreshToken ?? cookieToken;
    if (!refreshToken) throw new InvalidRefreshTokenException();
    const issued = await this.authService.refresh(refreshToken);
    this.refreshCookie.set(response, issued);
    return issued.tokens;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Authenticated()
  async logout(
    @CurrentSessionId() sessionId: string,
    @Res({ passthrough: true }) response: unknown,
  ): Promise<void> {
    await this.authService.logout(sessionId);
    this.refreshCookie.clear(response);
  }

  @Get('me')
  @Authenticated()
  me(@CurrentUser() user: User): UserView {
    return toUserView(user);
  }

  @Patch('me')
  @Authenticated()
  async updateProfile(
    @CurrentUser() user: User,
    @ValidBody(UpdateProfileDto) dto: UpdateProfileDto,
  ): Promise<UserView> {
    return toUserView(await this.usersService.updateUser(user.id, { name: dto.name }));
  }

  /** The caller's active sessions, newest first; `current` marks the one making this request. */
  @Get('sessions')
  @Authenticated()
  async listSessions(
    @CurrentUser() user: User,
    @CurrentSessionId() sessionId: string,
  ): Promise<SessionView[]> {
    const sessions = await this.sessionsService.listActive(user.id);
    return sessions.map((session) => toSessionView(session, sessionId));
  }

  /** Signs out every other device. */
  @Delete('sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Authenticated()
  revokeOtherSessions(
    @CurrentUser() user: User,
    @CurrentSessionId() sessionId: string,
  ): Promise<void> {
    return this.sessionsService.revokeAllForUser(user.id, { except: sessionId });
  }

  /** Signs out one of the caller's devices at once; 404 for anyone else's session. */
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Authenticated()
  revokeSession(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.sessionsService.revokeForUser(user.id, id);
  }

  @Post('password/change')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Authenticated()
  changePassword(
    @CurrentUser() user: User,
    @CurrentSessionId() sessionId: string,
    @ValidBody(ChangePasswordDto) dto: ChangePasswordDto,
  ): Promise<void> {
    return this.authService.changePassword(user, sessionId, dto);
  }

  /** Always 202, so the response doesn't reveal whether the email has an account. */
  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  @Public()
  @AuthThrottle('mail')
  forgotPassword(@ValidBody(ForgotPasswordDto) dto: ForgotPasswordDto): Promise<void> {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Public()
  @AuthThrottle('reset')
  resetPassword(@ValidBody(ResetPasswordDto) dto: ResetPasswordDto): Promise<void> {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Post('email/verify')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Public()
  verifyEmail(@ValidBody(VerifyEmailDto) dto: VerifyEmailDto): Promise<void> {
    return this.authService.verifyEmail(dto.token);
  }

  /** Always 202, so the response doesn't reveal whether the email has an account. */
  @Post('email/resend')
  @HttpCode(HttpStatus.ACCEPTED)
  @Public()
  @AuthThrottle('mail')
  resendVerification(@ValidBody(ResendVerificationDto) dto: ResendVerificationDto): Promise<void> {
    return this.authService.resendVerification(dto.email);
  }
}
