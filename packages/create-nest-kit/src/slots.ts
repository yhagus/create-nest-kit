/**
 * Paths that code in one layer imports but a variant layer provides. Every generated
 * project must contain each of them, provided by exactly one layer.
 * Add a path here when code starts importing a new variant file from another layer.
 */
export const REQUIRED_SLOTS: readonly string[] = [
  // platform/*
  'src/bootstrap/create-app.ts',
  // database/*
  'src/config/database.env.ts',
  // validation/<library>
  'src/common/validation.ts',
  'src/config/env.schema.ts',
  'src/auth/auth.dto.ts',
  'src/modules/users/users.dto.ts',
  'src/modules/roles/roles.dto.ts',
  // pattern/<pattern>/core
  'src/modules/features.module.ts',
  'src/seed/seed.ts',
  // persistence/<orm>/core
  'src/database/database.module.ts',
  'src/database/database.health.ts',
  // auth/*
  'src/auth/auth.module.ts',
  'src/auth/decorators.ts',
  // persistence/<orm>/auth-<auth>, imported by that auth style's auth.module.ts
  'src/database/auth-persistence.module.ts',
  // pattern/<pattern>/auth-<auth>, spread into that auth style's auth.module.ts
  'src/auth/auth-flows.ts',
  // database/* or persistence/<orm>/core
  'test/support/database.global-setup.ts',
  'test/support/reset-database.ts',
];
