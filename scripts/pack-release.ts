// Packs the built CLI into release/create-nest-kit.tar.gz plus its .sha256, the two assets install.sh
// downloads from a GitHub Release, and writes release/install.sh: the installer with this version's
// tag stamped as its default, so the copy attached to a release installs that release. Run
// `pnpm build` first.
//
// Archive layout: create-nest-kit/{dist/cli.js, dist/run.js, templates/**, package.json, LICENSE},
// the same relative layout as the package, so the bundle finds ../templates/ and ../package.json.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PACKAGE_DIR = path.join(ROOT, 'packages/create-nest-kit');
export const RELEASE_DIR = path.join(ROOT, 'release');
export const ARCHIVE_NAME = 'create-nest-kit.tar.gz';
export const INSTALLER_NAME = 'install.sh';
/** The line install.sh ships with in the repo, meaning "the latest release". */
const UNSTAMPED_DEFAULT_VERSION = 'DEFAULT_VERSION=""';
/** The top-level folder inside the archive; install.sh runs `<it>/dist/cli.js`. */
const ARCHIVE_FOLDER = 'create-nest-kit';
const PACKED_ENTRIES = ['dist', 'templates', 'package.json', 'LICENSE'];

export interface PackedRelease {
  archivePath: string;
  sha256: string;
  installerPath: string;
}

export async function packRelease(): Promise<PackedRelease> {
  await assertBuilt();
  const stagingDir = await mkdtemp(path.join(os.tmpdir(), 'create-nest-kit-pack-'));
  try {
    for (const entry of PACKED_ENTRIES) {
      await cp(path.join(PACKAGE_DIR, entry), path.join(stagingDir, ARCHIVE_FOLDER, entry), {
        recursive: true,
      });
    }
    await rm(RELEASE_DIR, { recursive: true, force: true });
    await mkdir(RELEASE_DIR);

    const archivePath = path.join(RELEASE_DIR, ARCHIVE_NAME);
    // ustar is the format every tar reads, busybox included. COPYFILE_DISABLE keeps macOS's tar from
    // adding ._* metadata files.
    await execFileAsync(
      'tar',
      ['--format=ustar', '-czf', archivePath, '-C', stagingDir, ARCHIVE_FOLDER],
      { env: { ...process.env, COPYFILE_DISABLE: '1' } },
    );

    const sha256 = await sha256Of(archivePath);
    // The format `sha256sum -c` reads: "<hash>  <file name>".
    await writeFile(`${archivePath}.sha256`, `${sha256}  ${ARCHIVE_NAME}\n`);

    const installerPath = await writeStampedInstaller(`v${await packageVersion()}`);
    return { archivePath, sha256, installerPath };
  } finally {
    await rm(stagingDir, { recursive: true, force: true });
  }
}

async function assertBuilt(): Promise<void> {
  const cliPath = path.join(PACKAGE_DIR, 'dist/cli.js');
  try {
    await access(cliPath);
  } catch (error) {
    throw new Error(`${cliPath} is missing; run \`pnpm build\` first`, { cause: error });
  }
}

async function packageVersion(): Promise<string> {
  const packageJson: unknown = JSON.parse(
    await readFile(path.join(PACKAGE_DIR, 'package.json'), 'utf8'),
  );
  if (
    typeof packageJson !== 'object' ||
    packageJson === null ||
    !('version' in packageJson) ||
    typeof packageJson.version !== 'string'
  ) {
    throw new Error(`${PACKAGE_DIR}/package.json has no version`);
  }
  return packageJson.version;
}

/** Copies install.sh into release/ with `tag` as the version it installs by default. */
async function writeStampedInstaller(tag: string): Promise<string> {
  const installer = await readFile(path.join(ROOT, INSTALLER_NAME), 'utf8');
  if (!installer.includes(UNSTAMPED_DEFAULT_VERSION)) {
    throw new Error(`${INSTALLER_NAME} has no \`${UNSTAMPED_DEFAULT_VERSION}\` line to stamp`);
  }
  const installerPath = path.join(RELEASE_DIR, INSTALLER_NAME);
  await writeFile(
    installerPath,
    installer.replace(UNSTAMPED_DEFAULT_VERSION, `DEFAULT_VERSION="${tag}"`),
  );
  return installerPath;
}

async function sha256Of(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

if (import.meta.main) {
  const { archivePath, sha256, installerPath } = await packRelease();
  console.log(archivePath);
  console.log(`sha256 ${sha256}`);
  console.log(installerPath);
}
