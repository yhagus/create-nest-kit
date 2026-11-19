// Prints the commit part of a CHANGELOG section: every commit since the last release, grouped by
// Conventional Commit type, then by scope, each linked by its short id. Commits without a scope go
// under `general`. See docs/agents/releasing.md.
//
//   node scripts/release-notes.ts <previous-tag> <new-tag> [<ref>]
//
// <ref> defaults to HEAD; pass the new tag once it exists.
import { execFileSync } from 'node:child_process';

interface Commit {
  hash: string;
  type: string;
  scope: string | undefined;
  subject: string;
  isBreaking: boolean;
}

/** Type → heading, in the order the sections are printed. */
const SECTIONS: [heading: string, types: string[]][] = [
  ['Features', ['feat']],
  ['Bug fixes', ['fix']],
  ['Performance', ['perf']],
  ['Refactors', ['refactor']],
  ['Docs', ['docs']],
  ['Tests', ['test']],
  ['Build and CI', ['build', 'ci']],
  ['Chores', ['chore', 'style', 'revert']],
];

const UNSCOPED = 'general';
const HEADER = /^(\w+)(?:\(([^)]+)\))?(!)?: (.+)$/;
const FIELD_SEPARATOR = '\u001f';
const RECORD_SEPARATOR = '\u001e';

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

/** https://github.com/<owner>/<repo>, from the origin remote's ssh or https URL. */
function repositoryUrl(): string {
  const remote = git('remote', 'get-url', 'origin');
  const repositoryPath = /github\.com[:/](.+?)(?:\.git)?$/.exec(remote)?.[1];
  if (!repositoryPath) throw new Error(`origin is not a GitHub remote: ${remote}`);
  return `https://github.com/${repositoryPath}`;
}

function parseCommit(record: string): Commit {
  const [hash = '', header = '', body = ''] = record.split(FIELD_SEPARATOR);
  const match = HEADER.exec(header);
  if (!match) return { hash, type: 'other', scope: undefined, subject: header, isBreaking: false };
  const [, type = '', scope, bang, subject = ''] = match;
  const isBreaking = bang === '!' || body.includes('BREAKING CHANGE');
  return { hash, type, scope, subject, isBreaking };
}

function isReleaseCommit(commit: Commit): boolean {
  return commit.type === 'chore' && commit.scope === 'release';
}

function commitsBetween(from: string, to: string): Commit[] {
  const log = git(
    'log',
    '--no-merges',
    `--format=%H${FIELD_SEPARATOR}%s${FIELD_SEPARATOR}%b${RECORD_SEPARATOR}`,
    `${from}..${to}`,
  );
  return log
    .split(RECORD_SEPARATOR)
    .map((record) => record.trim())
    .filter((record) => record.length > 0)
    .map(parseCommit)
    .filter((commit) => !isReleaseCommit(commit));
}

function lineOf(commit: Commit, repository: string): string {
  const header = `${commit.type}${commit.scope ? `(${commit.scope})` : ''}: ${commit.subject}`;
  const link = `[${commit.hash.slice(0, 7)}](${repository}/commit/${commit.hash})`;
  return `  * ${link} ${header}${commit.isBreaking ? ' (**breaking**)' : ''}`;
}

function sectionOf(heading: string, commits: Commit[], repository: string): string[] {
  if (commits.length === 0) return [];
  const commitsByScope = new Map<string, Commit[]>();
  for (const commit of commits) {
    const scope = commit.scope ?? UNSCOPED;
    commitsByScope.set(scope, [...(commitsByScope.get(scope) ?? []), commit]);
  }
  const scopes = [...commitsByScope.keys()].toSorted((a, b) => a.localeCompare(b));
  return [
    `#### ${heading}`,
    ...scopes.flatMap((scope) => [
      `* \`${scope}\``,
      ...(commitsByScope.get(scope) ?? []).map((commit) => lineOf(commit, repository)),
    ]),
    '',
  ];
}

const [previousTag, newTag, ref = 'HEAD'] = process.argv.slice(2);
if (!previousTag || !newTag) {
  console.error('usage: node scripts/release-notes.ts <previous-tag> <new-tag> [<ref>]');
  process.exit(1);
}

const repository = repositoryUrl();
const commits = commitsBetween(previousTag, ref);
const knownTypes = new Set(SECTIONS.flatMap(([, types]) => types));
const lines = [
  ...SECTIONS.flatMap(([heading, types]) =>
    sectionOf(
      heading,
      commits.filter((commit) => types.includes(commit.type)),
      repository,
    ),
  ),
  ...sectionOf(
    'Other',
    commits.filter((commit) => !knownTypes.has(commit.type)),
    repository,
  ),
  `**Full Changelog**: ${repository}/compare/${previousTag}...${newTag}`,
];
console.log(lines.join('\n'));
