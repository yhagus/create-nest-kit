import { describe, expect, it } from 'vitest';
import { rewriteRelativeImports } from '../../src/generate/rewrite-imports.ts';

/** A layout where `user.ts` moves to `models/` and everything else stays. */
const PROJECT_PATH_BY_TEMPLATE_PATH = new Map([
  ['src/modules/users/user.ts', 'src/modules/users/models/user.ts'],
  ['src/modules/users/users.module.ts', 'src/modules/users/users.module.ts'],
  ['src/common/error-code.ts', 'src/common/error-code.ts'],
  ['src/common/pagination.ts', 'src/common/pagination.ts'],
]);
const projectPathOf = (templatePath: string) => PROJECT_PATH_BY_TEMPLATE_PATH.get(templatePath);

describe('rewriteRelativeImports', () => {
  it('points the imports of a moved file at their targets from its new folder', () => {
    const content = "import { ErrorCode } from '../../common/error-code.js';\n";

    const rewritten = rewriteRelativeImports(
      content,
      {
        templatePath: 'src/modules/users/user.ts',
        projectPath: 'src/modules/users/models/user.ts',
      },
      projectPathOf,
    );

    expect(rewritten).toBe("import { ErrorCode } from '../../../common/error-code.js';\n");
  });

  it('follows a moved target in imports, re-exports, import() and vi.mock()', () => {
    const content = [
      "import type { User } from './user.js';",
      "export { toUser } from './user.js';",
      "const lazy = () => import('./user.js');",
      "vi.mock('./user.js');",
      '',
    ].join('\n');

    const rewritten = rewriteRelativeImports(
      content,
      {
        templatePath: 'src/modules/users/users.module.ts',
        projectPath: 'src/modules/users/users.module.ts',
      },
      projectPathOf,
    );

    expect(rewritten).toBe(
      [
        "import type { User } from './models/user.js';",
        "export { toUser } from './models/user.js';",
        "const lazy = () => import('./models/user.js');",
        "vi.mock('./models/user.js');",
        '',
      ].join('\n'),
    );
  });

  it('wraps an import that relocation pushed past the print width, one binding per line', () => {
    const content =
      "import { type User, UserEmailTakenException, UserNotVerifiedEmailException } from './user.js';\n";

    const rewritten = rewriteRelativeImports(
      content,
      {
        templatePath: 'src/modules/users/users.module.ts',
        projectPath: 'src/modules/users/commands/handlers/users-flow.handler.ts',
      },
      projectPathOf,
    );

    expect(rewritten).toBe(
      [
        'import {',
        '  type User,',
        '  UserEmailTakenException,',
        '  UserNotVerifiedEmailException,',
        "} from '../../models/user.js';",
        '',
      ].join('\n'),
    );
  });

  it('keeps the exact text of an import neither of whose ends moved', () => {
    const content =
      "import { ErrorCode } from './../common/error-code.js';\nimport { z } from 'zod';\n";

    const rewritten = rewriteRelativeImports(
      content,
      { templatePath: 'src/common/pagination.ts', projectPath: 'src/common/pagination.ts' },
      projectPathOf,
    );

    expect(rewritten).toBe(content);
  });

  it('refuses an import of a file no layer provides', () => {
    const content = "import { Missing } from './missing.js';\n";

    expect(() =>
      rewriteRelativeImports(
        content,
        { templatePath: 'src/common/pagination.ts', projectPath: 'src/common/pagination.ts' },
        projectPathOf,
      ),
    ).toThrow(
      "src/common/pagination.ts imports './missing.js', which resolves to src/common/missing.ts",
    );
  });
});

/** The flat layout: modules are top-level folders of `src/`, shared code is in `src/libs/`. */
const FLAT_PROJECT_PATH_BY_TEMPLATE_PATH = new Map([
  ['src/modules/users/user.ts', 'src/users/user.ts'],
  ['src/modules/users/users.module.ts', 'src/users/users.module.ts'],
  ['src/modules/roles/role.ts', 'src/roles/role.ts'],
  ['src/common/error-code.ts', 'src/libs/error-code.ts'],
  ['src/app.module.ts', 'src/app.module.ts'],
  ['src/config/env.ts', 'src/config/env.ts'],
  ['test/support/app.ts', 'test/support/app.ts'],
  ['test/fakes/in-memory-store.ts', 'test/fakes/in-memory-store.ts'],
]);
const flatProjectPathOf = (templatePath: string) =>
  FLAT_PROJECT_PATH_BY_TEMPLATE_PATH.get(templatePath);

describe('rewriteRelativeImports with the @/ alias across modules', () => {
  it('imports a file of another module, moved or not, through @/', () => {
    const content = [
      "import { ErrorCode } from '../../common/error-code.js';",
      "import type { Role } from '../roles/role.js';",
      '',
    ].join('\n');

    const rewritten = rewriteRelativeImports(
      content,
      { templatePath: 'src/modules/users/user.ts', projectPath: 'src/users/user.ts' },
      flatProjectPathOf,
      'alias-across-modules',
    );

    expect(rewritten).toBe(
      [
        "import { ErrorCode } from '@/libs/error-code.js';",
        "import type { Role } from '@/roles/role.js';",
        '',
      ].join('\n'),
    );
  });

  it('keeps an import inside the same module relative', () => {
    const content = "import type { User } from './user.js';\n";

    const rewritten = rewriteRelativeImports(
      content,
      {
        templatePath: 'src/modules/users/users.module.ts',
        projectPath: 'src/users/users.module.ts',
      },
      flatProjectPathOf,
      'alias-across-modules',
    );

    expect(rewritten).toBe(content);
  });

  it('imports through @/ from a file directly in src/, whose imports all leave its folder', () => {
    const content = "import { UsersModule } from './modules/users/users.module.js';\n";

    const rewritten = rewriteRelativeImports(
      content,
      { templatePath: 'src/app.module.ts', projectPath: 'src/app.module.ts' },
      flatProjectPathOf,
      'alias-across-modules',
    );

    expect(rewritten).toBe("import { UsersModule } from '@/users/users.module.js';\n");
  });

  it('imports src/ from the tests through @/, and other test files relatively', () => {
    const content = [
      "import { env } from '../../src/config/env.js';",
      "import { InMemoryStore } from '../fakes/in-memory-store.js';",
      '',
    ].join('\n');

    const rewritten = rewriteRelativeImports(
      content,
      { templatePath: 'test/support/app.ts', projectPath: 'test/support/app.ts' },
      flatProjectPathOf,
      'alias-across-modules',
    );

    expect(rewritten).toBe(
      [
        "import { env } from '@/config/env.js';",
        "import { InMemoryStore } from '../fakes/in-memory-store.js';",
        '',
      ].join('\n'),
    );
  });

  it('puts a wrapped import that now fits the print width back on one line', () => {
    const content = [
      'import {',
      '  ErrorCode,',
      '  type ErrorCodeValue,',
      '  isErrorCode,',
      '  toErrorCode,',
      "} from '../../common/error-code.js';",
      '',
    ].join('\n');

    const rewritten = rewriteRelativeImports(
      content,
      { templatePath: 'src/modules/users/user.ts', projectPath: 'src/users/user.ts' },
      flatProjectPathOf,
      'alias-across-modules',
    );

    expect(rewritten).toBe(
      "import { ErrorCode, type ErrorCodeValue, isErrorCode, toErrorCode } from '@/libs/error-code.js';\n",
    );
  });
});
