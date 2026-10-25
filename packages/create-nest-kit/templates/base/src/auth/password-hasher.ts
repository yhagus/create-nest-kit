/**
 * Hashes and checks passwords. The auth layer binds the implementation
 * (argon2id or scrypt), so the domain never depends on the algorithm.
 */
export abstract class PasswordHasher {
  abstract hash(plain: string): Promise<string>;

  /**
   * Whether `plain` matches `hash`. With a `null` hash (an unknown user) it still spends
   * the time of a real check and returns false, so response times don't reveal which
   * emails are registered.
   */
  abstract verify(plain: string, hash: string | null): Promise<boolean>;
}
