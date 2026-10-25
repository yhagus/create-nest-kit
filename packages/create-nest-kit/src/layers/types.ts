import type { ProjectOptions } from '../options.ts';

/** A value, or a function of the chosen options that returns it. */
export type OptionDependent<T> = T | ((options: ProjectOptions) => T);

export interface EnvVar {
  key: string;
  /** Written to `.env` and `.env.example`. For a secret, this is only the `.env.example` placeholder. */
  value: OptionDependent<string>;
  /** Shown as a `#` comment above the variable. */
  comment?: string;
  /** When true, `.env` gets a random 48-byte base64url value instead of `value`. */
  secret?: boolean;
}

export interface ComposeContribution {
  /** docker-compose service definitions, keyed by service name. */
  services?: Record<string, unknown>;
  /** Named volumes the services use. */
  volumes?: string[];
}

export interface ReadmeSection {
  title: string;
  body: OptionDependent<string>;
}

/**
 * One layer of the generated project: the files under `templates/<id>/` plus
 * the data the aggregate files (package.json, .env, compose, README, CI) are rendered from.
 * See docs/layers.md.
 */
export interface LayerManifest {
  /** Also the template directory: `templates/<id>/`. */
  id: string;
  /** `planned` layers are disabled in the wizard, refused by the CLI and skipped by the matrix and coverage tests. */
  status: 'ready' | 'planned';
  /** Whether this layer is part of a project with these options. */
  when(options: ProjectOptions): boolean;
  /** Exact versions only (`1.2.3`), never ranges. */
  dependencies?: Record<string, string>;
  /** Exact versions only (`1.2.3`), never ranges. */
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  /** Extra top-level package.json fields, deep-merged across layers (arrays are unioned). */
  packageJson?: Record<string, unknown>;
  env?: EnvVar[];
  compose?: ComposeContribution;
  readme?: ReadmeSection[];
}

/** The layers a CLI run composes, and where their template folders live. */
export interface LayerSet {
  /** Every known layer, in composition order. */
  layers: readonly LayerManifest[];
  /** Directory that holds one `<layer id>/` folder per layer. */
  templatesDir: string;
}
