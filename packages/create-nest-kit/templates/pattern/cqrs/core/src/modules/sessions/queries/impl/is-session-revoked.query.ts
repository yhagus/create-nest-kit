import { Query } from '@nestjs/cqrs';

/** Whether the session was revoked recently enough that its access tokens may still be unexpired. */
export class IsSessionRevokedQuery extends Query<boolean> {
  constructor(readonly sessionId: string) {
    super();
  }
}
