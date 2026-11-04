import { TEMPLATES_DIR } from '../paths.ts';
import { jwtAuthLayer } from './auth/jwt.ts';
import { nestAuthLayer } from './auth/nest.ts';
import { baseLayer } from './base.ts';
import { mongodbLayer } from './database/mongodb.ts';
import { cqrsAuthJwtLayer } from './pattern/cqrs/auth-jwt.ts';
import { cqrsAuthNestLayer } from './pattern/cqrs/auth-nest.ts';
import { cqrsCoreLayer } from './pattern/cqrs/core.ts';
import { serviceAuthJwtLayer } from './pattern/service/auth-jwt.ts';
import { serviceAuthNestLayer } from './pattern/service/auth-nest.ts';
import { serviceCoreLayer } from './pattern/service/core.ts';
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
import { nodeLayer } from './platform/node.ts';
import type { LayerManifest, LayerSet } from './types.ts';
import { arktypeValidationLayer } from './validation/arktype.ts';
import { classValidatorValidationLayer } from './validation/class-validator.ts';
import { valibotValidationLayer } from './validation/valibot.ts';
import { zodValidationLayer } from './validation/zod.ts';
import { nuxtWebLayer } from './web/nuxt.ts';

/**
 * Every layer in composition order:
 * base → platform → database → validation → pattern core → persistence core → persistence auth →
 * auth → pattern auth → web.
 * Later layers may rely on files from earlier ones, but never overwrite them.
 */
export const LAYERS: readonly LayerManifest[] = [
  baseLayer,
  fastifyLayer,
  expressLayer,
  nodeLayer,
  postgresLayer,
  mongodbLayer,
  zodValidationLayer,
  classValidatorValidationLayer,
  valibotValidationLayer,
  arktypeValidationLayer,
  serviceCoreLayer,
  cqrsCoreLayer,
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
  serviceAuthJwtLayer,
  serviceAuthNestLayer,
  cqrsAuthJwtLayer,
  cqrsAuthNestLayer,
  nuxtWebLayer,
];

export const BUILT_IN_LAYER_SET: LayerSet = { layers: LAYERS, templatesDir: TEMPLATES_DIR };
