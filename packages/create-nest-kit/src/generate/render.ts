import type { MergedManifest } from '../layers/merge.ts';
import type { ProjectOptions } from '../options.ts';
import { renderCiWorkflow } from './render-ci.ts';
import { renderDockerCompose } from './render-compose.ts';
import { renderEnv, renderEnvExample } from './render-env.ts';
import { renderGitlabCi } from './render-gitlab-ci.ts';
import { renderPackageJson } from './render-package-json.ts';
import { renderReadme } from './render-readme.ts';

/** A file whose content the generator computes from the merged manifest. */
export interface RenderedFile {
  target: string;
  content: string;
}

export function renderAggregateFiles(
  options: ProjectOptions,
  manifest: MergedManifest,
): RenderedFile[] {
  return [
    { target: 'package.json', content: renderPackageJson(options, manifest) },
    { target: '.env.example', content: renderEnvExample(manifest) },
    { target: '.env', content: renderEnv(manifest) },
    { target: 'docker-compose.yml', content: renderDockerCompose(options, manifest) },
    { target: 'README.md', content: renderReadme(options, manifest) },
    ...renderCiFiles(options),
  ];
}

/** The pipeline config of the chosen CI provider, if any. */
function renderCiFiles(options: ProjectOptions): RenderedFile[] {
  switch (options.ci) {
    case 'github':
      return [{ target: '.github/workflows/ci.yml', content: renderCiWorkflow(options) }];
    case 'gitlab':
      return [{ target: '.gitlab-ci.yml', content: renderGitlabCi(options) }];
    case 'none':
      return [];
  }
}
