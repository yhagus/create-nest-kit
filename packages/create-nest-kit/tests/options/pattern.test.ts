import { describe, expect, it } from 'vitest';
import { generateProject } from '../support/cli.ts';
import { listFiles, readPackageJson } from '../support/project.ts';

/** The files of the users feature module, relative to it. */
async function usersModuleFiles(projectDir: string): Promise<string[]> {
  const prefix = 'src/modules/users/';
  return (await listFiles(projectDir))
    .filter((file) => file.startsWith(prefix))
    .map((file) => file.slice(prefix.length));
}

describe('--pattern', () => {
  it('service: a feature module is a controller calling a service', async () => {
    const projectDir = await generateProject(['--pattern', 'service']);

    expect(await usersModuleFiles(projectDir)).toEqual(
      expect.arrayContaining(['users.controller.ts', 'users.module.ts', 'users.service.ts']),
    );
    expect((await readPackageJson(projectDir)).dependencies).not.toHaveProperty('@nestjs/cqrs');
  });

  it('cqrs: a feature module keeps its module and controller at its root, the rest in role folders', async () => {
    const projectDir = await generateProject(['--pattern', 'cqrs']);

    const files = await usersModuleFiles(projectDir);
    expect(files.filter((file) => !file.includes('/'))).toEqual([
      'users.controller.ts',
      'users.module.ts',
    ]);
    expect(files).toEqual(
      expect.arrayContaining([
        'commands/handlers/create-user.handler.ts',
        'commands/impl/create-user.command.ts',
        'queries/handlers/get-user.handler.ts',
        'queries/impl/get-user.query.ts',
        'models/user.ts',
        'providers/users.repository.ts',
        'schemas/users.dto.ts',
      ]),
    );
    expect((await readPackageJson(projectDir)).dependencies).toHaveProperty('@nestjs/cqrs');
  });
});
