import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  composeProject,
  CompositionError,
  toTargetPath,
  writeProject,
} from '../../src/generate/compose.ts';
import { parseProjectOptions } from '../../src/options.ts';
import {
  collidingLayer,
  fixtureLayers,
  fixtureTemplatesDir,
  layerSet,
} from '../fixtures/layers.ts';

const options = parseProjectOptions({ name: 'demo', directory: 'demo' });

describe('composeProject', () => {
  it('maps leading underscores in template paths to dots', async () => {
    const plan = await composeProject(options, layerSet);
    const targets = plan.templateFiles.map((file) => file.target);

    expect(targets).toContain('.gitignore');
    expect(targets).toContain('.github/dependabot.yml');
    expect(targets).not.toContain('_gitignore');
  });

  it('keeps one literal underscore for a path segment starting with two', () => {
    expect(toTargetPath(path.join('drizzle', 'meta', '__journal.json'))).toBe(
      'drizzle/meta/_journal.json',
    );
  });

  it('reports a path provided by two layers, naming both', async () => {
    const layers = [...fixtureLayers, collidingLayer];

    await expect(
      composeProject(options, { layers, templatesDir: fixtureTemplatesDir }),
    ).rejects.toThrow('src/main.ts is provided by more than one layer: base, collide');
  });

  it('reports a template that would overwrite a rendered file', async () => {
    const layers = [...fixtureLayers, { ...collidingLayer, id: 'rendered-clash' }];

    await expect(
      composeProject(options, { layers, templatesDir: fixtureTemplatesDir }),
    ).rejects.toThrow(
      'package.json is provided by more than one layer: rendered-clash, create-nest-kit (rendered)',
    );
  });

  it('reports every slot no layer fills', async () => {
    const layers = fixtureLayers.filter((layer) => layer.id !== 'auth/jwt');

    const error = await composeProject(options, {
      layers,
      templatesDir: fixtureTemplatesDir,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CompositionError);
    expect(error).toHaveProperty('problems', [
      'slot src/auth/auth.module.ts is not provided by any layer',
      'slot src/auth/decorators.ts is not provided by any layer',
    ]);
  });
});

describe('writeProject', () => {
  let targetDir: string;

  beforeEach(async () => {
    targetDir = await mkdtemp(path.join(tmpdir(), 'create-nest-kit-compose-'));
  });

  afterEach(async () => {
    await rm(targetDir, { recursive: true, force: true });
  });

  it('copies templates byte for byte, leaving placeholder-like text alone', async () => {
    const plan = await composeProject(options, layerSet);

    await writeProject(plan, targetDir);

    const source = await readFile(path.join(fixtureTemplatesDir, 'base/src/main.ts'));
    const written = await readFile(path.join(targetDir, 'src/main.ts'));
    expect(written.equals(source)).toBe(true);
    expect(written.toString()).toContain('{{name}} <%= name %> ${options.name}');
  });

  it('replaces a symlink at a planned path instead of writing through it', async () => {
    const plan = await composeProject(options, layerSet);
    const outsideFile = path.join(targetDir, 'outside.txt');
    await writeFile(outsideFile, 'untouched');
    await symlink(outsideFile, path.join(targetDir, '.gitignore'));

    await writeProject(plan, targetDir);

    expect((await lstat(path.join(targetDir, '.gitignore'))).isFile()).toBe(true);
    expect(await readFile(outsideFile, 'utf8')).toBe('untouched');
  });
});
