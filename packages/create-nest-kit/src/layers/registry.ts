import { TEMPLATES_DIR } from '../paths.ts';
import { jwtAuthLayer } from './auth/jwt.ts';
import { nestAuthLayer } from './auth/nest.ts';
import { baseLayer } from './base.ts';
import { mongodbLayer } from './database/mongodb.ts';
import { postgresLayer } from './database/postgres.ts';
import { drizzleAuthJwtLayer } from './persistence/drizzle/auth-jwt.ts';
import { drizzleAuthNestLayer } from './persistence/drizzle/auth-nest.ts';
import { drizzleCoreLayer } from './persistence/drizzle/core.ts';
import { mikroormAuthJwtLayer } from './persistence/mikroorm/auth-jwt.ts';
import { mikroormAuthNestLayer } from './persistence/mikroorm/auth-nest.ts';
import { mikroormCoreLayer } from './persistence/mikroorm/core.ts';
import { mongooseAuthJwtLayer } from './persistence/mongoose/auth-jwt.ts';
import { mongooseAuthNestLayer } from './persistence/mongoose/auth-nest.ts';
import { mongooseCoreLayer } from './persistence/mongoose/core.ts';
import { prismaAuthJwtLayer } from './persistence/prisma/auth-jwt.ts';
import { prismaAuthNestLayer } from './persistence/prisma/auth-nest.ts';
import { prismaCoreLayer } from './persistence/prisma/core.ts';
import { typeormAuthJwtLayer } from './persistence/typeorm/auth-jwt.ts';
import { typeormAuthNestLayer } from './persistence/typeorm/auth-nest.ts';
import { typeormCoreLayer } from './persistence/typeorm/core.ts';
import { fastifyLayer } from './platform/fastify.ts';
import { expressLayer } from './platform/express.ts';
import type { LayerManifest, LayerSet } from './types.ts';
import { arktypeValidationLayer } from './validation/arktype.ts';
import { classValidatorValidationLayer } from './validation/class-validator.ts';
import { valibotValidationLayer } from './validation/valibot.ts';
import { zodValidationLayer } from './validation/zod.ts';

/**
 * Every layer in composition order:
 * base → platform → database → validation → persistence core → persistence auth → auth.
 * Later layers may rely on files from earlier ones, but never overwrite them.
 */
export const LAYERS: readonly LayerManifest[] = [
  baseLayer,
  fastifyLayer,
  expressLayer,
  postgresLayer,
  mongodbLayer,
  zodValidationLayer,
  classValidatorValidationLayer,
  valibotValidationLayer,
  arktypeValidationLayer,
  drizzleCoreLayer,
  drizzleAuthJwtLayer,
  drizzleAuthNestLayer,
  prismaCoreLayer,
  prismaAuthJwtLayer,
  prismaAuthNestLayer,
  typeormCoreLayer,
  typeormAuthJwtLayer,
  typeormAuthNestLayer,
  mikroormCoreLayer,
  mikroormAuthJwtLayer,
  mikroormAuthNestLayer,
  mongooseCoreLayer,
  mongooseAuthJwtLayer,
  mongooseAuthNestLayer,
  jwtAuthLayer,
  nestAuthLayer,
];

export const BUILT_IN_LAYER_SET: LayerSet = { layers: LAYERS, templatesDir: TEMPLATES_DIR };
