import path from 'node:path';
import type { ProjectOptions } from '../options.ts';

/**
 * One step of the layout transformation: maps a path in the templates' layout to the path the
 * file gets in the generated project, or returns it unchanged when the step doesn't apply.
 * Paths use `/` separators and are relative to the project root.
 */
export type Relocation = (filePath: string, options: ProjectOptions) => string;

/** The role folders of a feature module in the CQRS layout, after the official NestJS CQRS example. */
export type RoleFolder = 'decorators' | 'guards' | 'models' | 'providers' | 'schemas';

/**
 * The role folder of every file the layers put at a feature-module root, keyed by file name
 * (names are unique across modules). Classified by reading each file: an injectable, or a port
 * bound to one, goes to `providers/`; types, views, exceptions and pure helpers to `models/`;
 * validation DTOs to `schemas/`.
 */
const ROLE_FOLDER_BY_FILE_NAME: Readonly<Record<string, RoleFolder>> = {
  // src/auth (base, auth/jwt, auth/nest, pattern/cqrs/auth-*, validation/*)
  'access-rule.ts': 'models',
  'access-token.provider.ts': 'providers',
  'access-tokens.ts': 'providers',
  'argon2-password-hasher.ts': 'providers',
  'auth-flows.ts': 'providers',
  'auth.dto.ts': 'schemas',
  'auth.exceptions.ts': 'models',
  'auth.types.ts': 'models',
  'authentication-types.ts': 'models',
  'decorators.ts': 'decorators',
  'email-verification-mailer.ts': 'providers',
  'issued-tokens.ts': 'models',
  'jwt-auth.guard.ts': 'guards',
  'link-token.ts': 'models',
  'password-hasher.ts': 'providers',
  'password-reset-mailer.ts': 'providers',
  'permission.policy.ts': 'providers',
  'permissions.guard.ts': 'guards',
  'random-token.ts': 'models',
  'refresh-cookie.ts': 'providers',
  'refresh-token-families.ts': 'providers',
  'refresh-token-revocation.hook.ts': 'providers',
  'refresh-tokens.repository.ts': 'providers',
  'scrypt-password-hasher.ts': 'providers',
  'session-tokens.ts': 'providers',
  'token-length.ts': 'models',
  'token-pair.view.ts': 'models',
  'verification-mail-sender.ts': 'providers',
  'verification-tokens.repository.ts': 'providers',
  'verification-tokens.ts': 'providers',
  // src/modules/permissions
  'permission.ts': 'models',
  // src/modules/roles
  'distinct-permissions.ts': 'models',
  'role.ts': 'models',
  'role.view.ts': 'models',
  'roles.dto.ts': 'schemas',
  'roles.exceptions.ts': 'models',
  'roles.repository.ts': 'providers',
  // src/modules/sessions
  'expired-sessions-purger.ts': 'providers',
  'revoked-sessions-enforcer.ts': 'providers',
  'session-deny-list.ts': 'providers',
  'session-revocation-hook.ts': 'providers',
  'session.ts': 'models',
  'session.view.ts': 'models',
  'sessions.repository.ts': 'providers',
  // src/modules/users
  'email.ts': 'models',
  'existing-role-ids.ts': 'models',
  'user.ts': 'models',
  'user.view.ts': 'models',
  'users.dto.ts': 'schemas',
  'users.exceptions.ts': 'models',
  'users.repository.ts': 'providers',
};

/** The only files that stay at a feature-module root in the CQRS layout. */
const MODULE_ROOT_FILE = /\.(module|controller)\.ts$/;

/**
 * In the CQRS layout, a feature module keeps only its module and controllers at its root; every
 * other file moves into a role folder. `commands/` and `queries/` are laid out in the templates.
 */
export const cqrsRoleFolders: Relocation = (filePath, options) => {
  if (options.pattern !== 'cqrs') return filePath;
  const moduleDir = featureModuleDirOf(filePath);
  if (moduleDir === undefined) return filePath;

  const fileName = path.posix.basename(filePath);
  if (MODULE_ROOT_FILE.test(fileName)) return filePath;
  const roleFolder = ROLE_FOLDER_BY_FILE_NAME[fileName];
  if (roleFolder === undefined) {
    throw new Error(
      `${filePath} has no role folder for the CQRS layout: add it to ROLE_FOLDER_BY_FILE_NAME in src/generate/relocate.ts`,
    );
  }
  return `${moduleDir}/${roleFolder}/${fileName}`;
};

/** `src/auth` or `src/modules/<module>` for a `.ts` file directly inside one, otherwise undefined. */
function featureModuleDirOf(filePath: string): string | undefined {
  if (!filePath.endsWith('.ts')) return undefined;
  const segments = filePath.split('/');
  const isInAuth = segments.length === 3 && segments[0] === 'src' && segments[1] === 'auth';
  const isInFeatureModule =
    segments.length === 4 && segments[0] === 'src' && segments[1] === 'modules';
  if (!isInAuth && !isInFeatureModule) return undefined;
  return segments.slice(0, -1).join('/');
}

/**
 * The top-level folders of the templates' layout that the flat layout dissolves, and the prefix
 * their content gets: `src/modules/users/` → `src/users/`, `src/infra/mail/` → `src/mail/`,
 * `src/common/` → `src/libs/`.
 */
const FLAT_FOLDER_PREFIXES: readonly (readonly [nested: string, flat: string])[] = [
  ['src/modules/', 'src/'],
  ['src/infra/', 'src/'],
  ['src/common/', 'src/libs/'],
];

/**
 * In the flat layout, every module is a top-level folder of `src/`, and the code they share lives
 * in `src/libs/`. Runs after `cqrsRoleFolders`, which knows feature modules by their nested path.
 */
export const flatLayout: Relocation = (filePath, options) => {
  if (options.layout !== 'flat') return filePath;
  for (const [nestedPrefix, flatPrefix] of FLAT_FOLDER_PREFIXES) {
    if (filePath.startsWith(nestedPrefix)) {
      return `${flatPrefix}${filePath.slice(nestedPrefix.length)}`;
    }
  }
  return filePath;
};

/** Every relocation, applied in order. */
const RELOCATIONS: readonly Relocation[] = [cqrsRoleFolders, flatLayout];

/**
 * Where a file of the templates' layout (`src/modules/users/user.ts`) ends up in a project with
 * these options. Also used by README sections, so the paths they mention can't drift.
 */
export function projectPath(templatePath: string, options: ProjectOptions): string {
  return RELOCATIONS.reduce((current, relocate) => relocate(current, options), templatePath);
}

/**
 * The folder, with a trailing `/`, that a file of the templates' layout ends up in. The module
 * segment may be a placeholder such as `*`, to name that folder in every module.
 */
export function projectFolder(templatePath: string, options: ProjectOptions): string {
  return `${path.posix.dirname(projectPath(templatePath, options))}/`;
}
