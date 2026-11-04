import { DiscoveryModule } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeAppConfig } from '../../test/fakes/fake-app-config.js';
import { FakePasswordHasher } from '../../test/fakes/fake-password-hasher.js';
import { createInMemoryRepositories } from '../../test/fakes/in-memory-repositories.js';
import { InMemoryRefreshTokensRepository } from '../../test/fakes/in-memory-refresh-tokens.repository.js';
import { InMemorySessionDenyList } from '../../test/fakes/in-memory-session-deny-list.js';
import { InMemoryVerificationTokensRepository } from '../../test/fakes/in-memory-verification-tokens.repository.js';
import { AppConfig } from '../config/app-config.js';
import { MailQueue } from '../infra/mail/mail.queue.js';
import { RolesRepository } from '../modules/roles/roles.repository.js';
import { RolesService } from '../modules/roles/roles.service.js';
import { SessionDenyList } from '../modules/sessions/session-deny-list.js';
import { SessionsRepository } from '../modules/sessions/sessions.repository.js';
import { SessionsService } from '../modules/sessions/sessions.service.js';
import { UsersRepository } from '../modules/users/users.repository.js';
import { UsersService } from '../modules/users/users.service.js';
import { AccessTokens } from './access-tokens.js';
import { InvalidCredentialsException } from './auth.exceptions.js';
import { JwtAuthService } from './jwt-auth.service.js';
import { PasswordHasher } from './password-hasher.js';
import { RefreshTokensRepository } from './refresh-tokens.repository.js';
import { SessionTokens } from './session-tokens.js';
import { VerificationTokens } from './verification-tokens.js';
import { VerificationTokensRepository } from './verification-tokens.repository.js';

const HOUR_MS = 3_600_000;

/** Records which hashes passwords were checked against. */
class RecordingPasswordHasher extends FakePasswordHasher {
  readonly checkedHashes: (string | null)[] = [];

  override async verify(plain: string, hash: string | null): Promise<boolean> {
    this.checkedHashes.push(hash);
    return super.verify(plain, hash);
  }
}

describe('JwtAuthService', () => {
  let authService: JwtAuthService;
  let passwordHasher: RecordingPasswordHasher;

  beforeEach(async () => {
    passwordHasher = new RecordingPasswordHasher();
    const repositories = createInMemoryRepositories();
    const moduleRef = await Test.createTestingModule({
      imports: [DiscoveryModule, JwtModule.register({ secret: 'unit-test-secret' })],
      providers: [
        JwtAuthService,
        UsersService,
        RolesService,
        SessionsService,
        AccessTokens,
        SessionTokens,
        VerificationTokens,
        { provide: UsersRepository, useValue: repositories.users },
        { provide: RolesRepository, useValue: repositories.roles },
        { provide: SessionsRepository, useValue: repositories.sessions },
        {
          provide: RefreshTokensRepository,
          useValue: new InMemoryRefreshTokensRepository(repositories.store),
        },
        {
          provide: VerificationTokensRepository,
          useValue: new InMemoryVerificationTokensRepository(repositories.store),
        },
        { provide: PasswordHasher, useValue: passwordHasher },
        { provide: SessionDenyList, useClass: InMemorySessionDenyList },
        { provide: MailQueue, useValue: { enqueue: async () => undefined } },
        {
          provide: AppConfig,
          useValue: fakeAppConfig({
            EMAIL_VERIFICATION_ENABLED: true,
            ACCESS_TOKEN_TTL: HOUR_MS,
            REFRESH_TOKEN_TTL: HOUR_MS,
            SESSION_ABSOLUTE_TTL: HOUR_MS,
          }),
        },
      ],
    }).compile();
    await moduleRef.init();
    authService = moduleRef.get(JwtAuthService);
  });

  it('still checks a password for an unknown email, so timing does not reveal accounts', async () => {
    await expect(
      authService.login(
        { email: 'nobody@example.com', password: 'correct horse' },
        { userAgent: null, ip: null },
      ),
    ).rejects.toThrow(InvalidCredentialsException);

    expect(passwordHasher.checkedHashes).toEqual([null]);
  });
});
