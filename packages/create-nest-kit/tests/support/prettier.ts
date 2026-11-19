import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as prettier from 'prettier';
import { PACKAGE_ROOT } from './paths.ts';
import { listFiles } from './project.ts';

// Generated projects run `prettier --check .` as their format:check. Both checks below use this
// repo's Prettier, the version projects pin.

const PRETTIER_CLI = path.join(PACKAGE_ROOT, 'node_modules/prettier/bin/prettier.cjs');

/** `prettier --check .` in the project, as its format:check runs it: the output when it fails. */
export function prettierCheckFailure(projectDir: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [PRETTIER_CLI, '--check', '.'],
      { cwd: projectDir },
      (error, stdout, stderr) => resolve(error ? `${stdout}${stderr}`.trim() : undefined),
    );
  });
}

/** Whether a file is formatted, by its path in the project, content and config. */
const formattedByFile = new Map<string, Promise<boolean>>();

/**
 * The files of the project that `prettier --check .` would flag, found through Prettier's API with
 * the project's own config and ignore files. Faster than the CLI across many projects, since a
 * file another project already had (same path, content and config) is not checked again.
 */
export async function unformattedFiles(projectDir: string): Promise<string[]> {
  const ignorePath = ['.gitignore', '.prettierignore'].map((name) => path.join(projectDir, name));
  const config = await prettier.resolveConfig(path.join(projectDir, 'package.json'));
  const files = await listFiles(projectDir);
  const results = await Promise.all(
    files.map(async (file) => {
      const filepath = path.join(projectDir, file);
      const { ignored, inferredParser } = await prettier.getFileInfo(filepath, { ignorePath });
      if (ignored || inferredParser === null) return undefined;
      const content = await readFile(filepath, 'utf8');
      const key = JSON.stringify([file, content, config]);
      const isFormatted =
        formattedByFile.get(key) ?? prettier.check(content, { ...config, filepath });
      formattedByFile.set(key, isFormatted);
      return (await isFormatted) ? undefined : file;
    }),
  );
  return results.filter((file) => file !== undefined);
}
