import { describe, expect, it } from 'vitest';
import { projectFolder, projectPath } from '../../src/generate/relocate.ts';
import { parseProjectOptions } from '../../src/options.ts';

const cqrs = parseProjectOptions({ name: 'demo', directory: 'demo', pattern: 'cqrs' });
const service = parseProjectOptions({ name: 'demo', directory: 'demo', pattern: 'service' });
const flatService = parseProjectOptions({
  name: 'demo',
  directory: 'demo',
  pattern: 'service',
  layout: 'flat',
});
const flatCqrs = parseProjectOptions({
  name: 'demo',
  directory: 'demo',
  pattern: 'cqrs',
  layout: 'flat',
});

describe('projectPath in a CQRS project', () => {
  it('moves a file at a feature-module root into its role folder', () => {
    expect(projectPath('src/modules/users/users.repository.ts', cqrs)).toBe(
      'src/modules/users/providers/users.repository.ts',
    );
    expect(projectPath('src/auth/jwt-auth.guard.ts', cqrs)).toBe(
      'src/auth/guards/jwt-auth.guard.ts',
    );
    expect(projectPath('src/modules/users/users.dto.ts', cqrs)).toBe(
      'src/modules/users/schemas/users.dto.ts',
    );
  });

  it('leaves modules, controllers and files already in a folder at their place', () => {
    expect(projectPath('src/auth/auth-http.module.ts', cqrs)).toBe('src/auth/auth-http.module.ts');
    expect(projectPath('src/modules/roles/roles.controller.ts', cqrs)).toBe(
      'src/modules/roles/roles.controller.ts',
    );
    expect(projectPath('src/modules/roles/commands/handlers/index.ts', cqrs)).toBe(
      'src/modules/roles/commands/handlers/index.ts',
    );
  });

  it('leaves files outside the feature modules at their place', () => {
    expect(projectPath('src/modules/features.module.ts', cqrs)).toBe(
      'src/modules/features.module.ts',
    );
    expect(projectPath('src/common/error-code.ts', cqrs)).toBe('src/common/error-code.ts');
    expect(projectPath('tests/support/http.ts', cqrs)).toBe('tests/support/http.ts');
  });

  it('refuses a feature-module file that has no role folder yet', () => {
    expect(() => projectPath('src/modules/users/mystery.ts', cqrs)).toThrow(
      'src/modules/users/mystery.ts has no role folder for the CQRS layout',
    );
  });
});

describe('projectPath in a service project', () => {
  it('keeps the layout of the templates', () => {
    expect(projectPath('src/modules/users/users.repository.ts', service)).toBe(
      'src/modules/users/users.repository.ts',
    );
    expect(projectPath('src/modules/users/mystery.ts', service)).toBe(
      'src/modules/users/mystery.ts',
    );
  });
});

describe('projectPath in a flat project', () => {
  it('makes each feature module and infrastructure module a top-level folder of src/', () => {
    expect(projectPath('src/modules/users/users.repository.ts', flatService)).toBe(
      'src/users/users.repository.ts',
    );
    expect(projectPath('src/modules/features.module.ts', flatService)).toBe(
      'src/features.module.ts',
    );
    expect(projectPath('src/infra/mail/templates/layout.html', flatService)).toBe(
      'src/mail/templates/layout.html',
    );
  });

  it('moves the shared code from src/common/ to src/libs/', () => {
    expect(projectPath('src/common/error-code.ts', flatService)).toBe('src/libs/error-code.ts');
  });

  it('leaves auth, config, database and the tests at their place', () => {
    expect(projectPath('src/auth/auth.module.ts', flatService)).toBe('src/auth/auth.module.ts');
    expect(projectPath('src/config/env.ts', flatService)).toBe('src/config/env.ts');
    expect(projectPath('src/database/database.module.ts', flatService)).toBe(
      'src/database/database.module.ts',
    );
    expect(projectPath('tests/support/http.ts', flatService)).toBe('tests/support/http.ts');
  });

  it('keeps the role folders of a CQRS project', () => {
    expect(projectPath('src/modules/users/users.repository.ts', flatCqrs)).toBe(
      'src/users/providers/users.repository.ts',
    );
    expect(
      projectPath('src/modules/users/commands/handlers/create-user.handler.ts', flatCqrs),
    ).toBe('src/users/commands/handlers/create-user.handler.ts');
  });
});

describe('projectFolder', () => {
  it('names the folder of a role in every module', () => {
    expect(projectFolder('src/modules/*/users.repository.ts', cqrs)).toBe(
      'src/modules/*/providers/',
    );
    expect(projectFolder('src/modules/*/users.repository.ts', service)).toBe('src/modules/*/');
    expect(projectFolder('src/modules/*/users.repository.ts', flatCqrs)).toBe('src/*/providers/');
  });
});
