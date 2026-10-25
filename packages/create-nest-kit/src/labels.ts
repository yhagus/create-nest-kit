import type { AuthStyle, Database, Orm, Platform, ProjectOptions, Validation } from './options.ts';

export const PLATFORM_LABELS: Record<Platform, string> = {
  fastify: 'Fastify',
  express: 'Express',
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

export function onOffLabel(isEnabled: boolean): string {
  return isEnabled ? 'on' : 'off';
}

function yesNoLabel(isEnabled: boolean): string {
  return isEnabled ? 'yes' : 'no';
}

/** The chosen options as `[label, value]` rows, for the README table and the pre-write summary. */
export function describeOptions(options: ProjectOptions): [string, string][] {
  return [
    ['HTTP platform', PLATFORM_LABELS[options.platform]],
    ['Database', DATABASE_LABELS[options.database]],
    ['ORM / ODM', ORM_LABELS[options.orm]],
    ['Auth style', AUTH_LABELS[options.auth]],
    ['Validation library', VALIDATION_LABELS[options.validation]],
    ['Email verification', onOffLabel(options.emailVerification)],
    ['CSRF protection', onOffLabel(options.csrf)],
    ['Package manager', options.packageManager],
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
