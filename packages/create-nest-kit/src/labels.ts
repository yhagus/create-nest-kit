import type {
  AuthStyle,
  Database,
  DevEnvironment,
  Orm,
  Pattern,
  Platform,
  ProjectOptions,
  ProjectType,
  Validation,
} from './options.ts';

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  api: 'API only',
  fullstack: 'API + web',
};

/** Shown next to each project type in the wizard. */
export const PROJECT_TYPE_HINTS: Record<ProjectType, string> = {
  api: 'the NestJS API',
  fullstack: 'plus a Nuxt front end in web/, its own package, run with bun',
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  fastify: 'Fastify',
  express: 'Express',
  node: 'Node (native node:http)',
};

export const DATABASE_LABELS: Record<Database, string> = {
  postgres: 'PostgreSQL',
  mongodb: 'MongoDB',
};

export const ORM_LABELS: Record<Orm, string> = {
  drizzle: 'Drizzle',
  prisma: 'Prisma 7',
  typeorm: 'TypeORM',
  mikroorm: 'MikroORM',
  mongoose: 'Mongoose',
};

export const AUTH_LABELS: Record<AuthStyle, string> = {
  jwt: 'Hand-rolled @nestjs/jwt + argon2id',
  nest: 'Official @nestjs/authentication + @nestjs/authorization',
};

export const VALIDATION_LABELS: Record<Validation, string> = {
  zod: 'Zod',
  'class-validator': 'class-validator',
  valibot: 'Valibot',
  arktype: 'ArkType',
};

/** Shown next to each library in the wizard. */
export const VALIDATION_HINTS: Record<Validation, string> = {
  zod: 'schemas with inferred TypeScript types',
  'class-validator': 'decorators on DTO classes',
  valibot: 'modular, tree-shakable schemas',
  arktype: 'types written in TypeScript syntax',
};

export const DEV_ENVIRONMENT_LABELS: Record<DevEnvironment, string> = {
  local: 'Local Node.js',
  docker: 'Docker',
};

/** Shown next to each dev environment in the wizard. */
export const DEV_ENVIRONMENT_HINTS: Record<DevEnvironment, string> = {
  local: 'the API runs on your machine, the databases in Docker',
  docker: 'the API runs in a container too',
};

export const PATTERN_LABELS: Record<Pattern, string> = {
  service: 'Controller + service',
  cqrs: 'CQRS',
};

/** Shown next to each pattern in the wizard. */
export const PATTERN_HINTS: Record<Pattern, string> = {
  service: "controllers call services, Nest's default",
  cqrs: 'commands and queries with their own handlers (@nestjs/cqrs)',
};

export function onOffLabel(isEnabled: boolean): string {
  return isEnabled ? 'on' : 'off';
}

function yesNoLabel(isEnabled: boolean): string {
  return isEnabled ? 'yes' : 'no';
}

/** The chosen options as `[label, value]` rows, for the README table and the pre-write summary. */
export function describeOptions(options: ProjectOptions): [string, string][] {
  return [
    ['Project type', PROJECT_TYPE_LABELS[options.projectType]],
    ['HTTP platform', PLATFORM_LABELS[options.platform]],
    ['Database', DATABASE_LABELS[options.database]],
    ['ORM / ODM', ORM_LABELS[options.orm]],
    ['Auth style', AUTH_LABELS[options.auth]],
    ['Validation library', VALIDATION_LABELS[options.validation]],
    ['Application pattern', PATTERN_LABELS[options.pattern]],
    ['Email verification', onOffLabel(options.emailVerification)],
    ['CSRF protection', onOffLabel(options.csrf)],
    ['Package manager', options.packageManager],
    ['Dev environment', DEV_ENVIRONMENT_LABELS[options.devEnvironment]],
  ];
}

/** `describeOptions` plus where and what gets written, for the confirmation summary. */
export function describeRun(options: ProjectOptions, location: string): [string, string][] {
  return [
    ['Location', location],
    ['Package name', options.name],
    ...describeOptions(options),
    ['Install dependencies', yesNoLabel(options.install)],
    ['Initialize git', yesNoLabel(options.git)],
  ];
}
