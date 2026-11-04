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
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ValidBody } from '../common/validation.js';
import { AuthThrottle } from '../infra/throttler/auth-throttle.js';
import { RevokeAllUserSessionsCommand } from '../modules/sessions/commands/revoke-all-user-sessions/revoke-all-user-sessions.command.js';
import { RevokeUserSessionCommand } from '../modules/sessions/commands/revoke-user-session/revoke-user-session.command.js';
import { ListActiveSessionsQuery } from '../modules/sessions/queries/list-active-sessions/list-active-sessions.query.js';
import { type SessionView, toSessionView } from '../modules/sessions/session.view.js';
import { UpdateUserCommand } from '../modules/users/commands/update-user/update-user.command.js';
import { toUserView, type UserView } from '../modules/users/user.view.js';
import type { User } from '../modules/users/user.js';
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
import { ChangePasswordCommand } from './commands/change-password/change-password.command.js';
import { ForgotPasswordCommand } from './commands/forgot-password/forgot-password.command.js';
import { LoginCommand } from './commands/login/login.command.js';
import { LogoutCommand } from './commands/logout/logout.command.js';
import { RefreshTokensCommand } from './commands/refresh-tokens/refresh-tokens.command.js';
import { RegisterCommand } from './commands/register/register.command.js';
import { ResendVerificationCommand } from './commands/resend-verification/resend-verification.command.js';
import { ResetPasswordCommand } from './commands/reset-password/reset-password.command.js';
import { VerifyEmailCommand } from './commands/verify-email/verify-email.command.js';
import { Authenticated, CurrentSessionId, CurrentUser, Public } from './decorators.js';
import { REFRESH_COOKIE, RefreshCookie } from './refresh-cookie.js';
import type { LoginView, TokenPairView } from './token-pair.view.js';

/** Sign-up, sign-in and the signed-in user's own account and devices. */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly refreshCookie: RefreshCookie,
  ) {}

  @Post('register')
  @Public()
  @AuthThrottle('register')
  async register(@ValidBody(RegisterDto) dto: RegisterDto): Promise<UserView> {
    return toUserView(await this.commandBus.execute(new RegisterCommand(dto)));
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
    const { user, ...issued } = await this.commandBus.execute(
      new LoginCommand(dto, { ip, userAgent: userAgent ?? null }),
    );
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
    const issued = await this.commandBus.execute(new RefreshTokensCommand(refreshToken));
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
    await this.commandBus.execute(new LogoutCommand(sessionId));
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
    const updated = await this.commandBus.execute(
      new UpdateUserCommand(user.id, { name: dto.name }),
    );
    return toUserView(updated);
  }

  /** The caller's active sessions, newest first; `current` marks the one making this request. */
  @Get('sessions')
  @Authenticated()
  async listSessions(
    @CurrentUser() user: User,
    @CurrentSessionId() sessionId: string,
  ): Promise<SessionView[]> {
    const sessions = await this.queryBus.execute(new ListActiveSessionsQuery(user.id));
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
    return this.commandBus.execute(new RevokeAllUserSessionsCommand(user.id, sessionId));
  }

  /** Signs out one of the caller's devices at once; 404 for anyone else's session. */
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Authenticated()
  revokeSession(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.commandBus.execute(new RevokeUserSessionCommand(user.id, id));
  }

  @Post('password/change')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Authenticated()
  changePassword(
    @CurrentUser() user: User,
    @CurrentSessionId() sessionId: string,
    @ValidBody(ChangePasswordDto) dto: ChangePasswordDto,
  ): Promise<void> {
    return this.commandBus.execute(new ChangePasswordCommand(user, sessionId, dto));
  }

  /** Always 202, so the response doesn't reveal whether the email has an account. */
  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  @Public()
  @AuthThrottle('mail')
  forgotPassword(@ValidBody(ForgotPasswordDto) dto: ForgotPasswordDto): Promise<void> {
    return this.commandBus.execute(new ForgotPasswordCommand(dto.email));
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Public()
  @AuthThrottle('reset')
  resetPassword(@ValidBody(ResetPasswordDto) dto: ResetPasswordDto): Promise<void> {
    return this.commandBus.execute(new ResetPasswordCommand(dto.token, dto.password));
  }

  @Post('email/verify')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Public()
  verifyEmail(@ValidBody(VerifyEmailDto) dto: VerifyEmailDto): Promise<void> {
    return this.commandBus.execute(new VerifyEmailCommand(dto.token));
  }

  /** Always 202, so the response doesn't reveal whether the email has an account. */
  @Post('email/resend')
  @HttpCode(HttpStatus.ACCEPTED)
  @Public()
  @AuthThrottle('mail')
  resendVerification(@ValidBody(ResendVerificationDto) dto: ResendVerificationDto): Promise<void> {
    return this.commandBus.execute(new ResendVerificationCommand(dto.email));
  }
}
