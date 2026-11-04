import { JwtModule } from '@nestjs/jwt';
import { CommandBus } from '@nestjs/cqrs';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakePasswordHasher } from '../../../../test/fakes/fake-password-hasher.js';
import { createInMemoryRepositories } from '../../../../test/fakes/in-memory-repositories.js';
import { InMemoryRefreshTokensRepository } from '../../../../test/fakes/in-memory-refresh-tokens.repository.js';
import { handlerTestingModule } from '../../../../test/support/handler-testing-module.js';
import { AccessTokens } from '../../access-tokens.js';
import { InvalidCredentialsException } from '../../auth.exceptions.js';
import { PasswordHasher } from '../../password-hasher.js';
import { RefreshTokensRepository } from '../../refresh-tokens.repository.js';
import { SessionTokens } from '../../session-tokens.js';
import { LoginCommand } from './login.command.js';
import { LoginHandler } from './login.handler.js';

const HOUR_MS = 3_600_000;

/** Records which hashes passwords were checked against. */
class RecordingPasswordHasher extends FakePasswordHasher {
  readonly checkedHashes: (string | null)[] = [];

  override async verify(plain: string, hash: string | null): Promise<boolean> {
    this.checkedHashes.push(hash);
    return super.verify(plain, hash);
  }
}

describe('LoginHandler', () => {
  let commandBus: CommandBus;
  let passwordHasher: RecordingPasswordHasher;

  beforeEach(async () => {
    passwordHasher = new RecordingPasswordHasher();
    const repositories = createInMemoryRepositories();
    const moduleRef = await handlerTestingModule({
      repositories,
      config: {
        EMAIL_VERIFICATION_ENABLED: true,
        ACCESS_TOKEN_TTL: HOUR_MS,
        REFRESH_TOKEN_TTL: HOUR_MS,
        SESSION_ABSOLUTE_TTL: HOUR_MS,
      },
      imports: [JwtModule.register({ secret: 'unit-test-secret' })],
      providers: [
        LoginHandler,
        SessionTokens,
        AccessTokens,
        {
          provide: RefreshTokensRepository,
          useValue: new InMemoryRefreshTokensRepository(repositories.store),
        },
      ],
    })
      .overrideProvider(PasswordHasher)
      .useValue(passwordHasher)
      .compile();
    await moduleRef.init();
    commandBus = moduleRef.get(CommandBus);
  });

  it('still checks a password for an unknown email, so timing does not reveal accounts', async () => {
    await expect(
      commandBus.execute(
        new LoginCommand(
          { email: 'nobody@example.com', password: 'correct horse' },
          { userAgent: null, ip: null },
        ),
      ),
    ).rejects.toThrow(InvalidCredentialsException);

    expect(passwordHasher.checkedHashes).toEqual([null]);
  });
});
