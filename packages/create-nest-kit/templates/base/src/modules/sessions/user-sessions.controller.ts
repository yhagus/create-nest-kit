import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { RequirePermissions } from '../../auth/decorators.js';
import { Permission } from '../permissions/permission.js';
import { type SessionView, toSessionView } from './session.view.js';
import { SessionsService } from './sessions.service.js';

/** An administrator's view of another user's sessions. Users manage their own under /auth/sessions. */
@Controller('users/:userId/sessions')
export class UserSessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  /** The user's active sessions, newest first. */
  @Get()
  @RequirePermissions(Permission.SessionsRead)
  async list(@Param('userId', ParseUUIDPipe) userId: string): Promise<SessionView[]> {
    const sessions = await this.sessionsService.listActive(userId);
    return sessions.map((session) => toSessionView(session));
  }

  /** Signs the device out at once: its access and refresh tokens stop working. */
  @Delete(':sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.SessionsRevoke)
  revoke(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<void> {
    return this.sessionsService.revokeForUser(userId, sessionId);
  }
}
