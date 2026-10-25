// Fills a database with what the app needs to start: the system roles and a first admin.
// Run with `db:seed`; it is safe to run again, e.g. after adding a permission.
import { existsSync } from 'node:fs';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { AppConfig } from '../config/app-config.js';
import { parseEnv } from '../config/env.js';
import { RolesService } from '../modules/roles/roles.service.js';
import { UsersService } from '../modules/users/users.service.js';

const ENV_FILE = '.env';
const ADMIN_NAME = 'Admin';

/** What `seedDatabase` did, for the script to report. */
export interface SeedReport {
  adminEmail: string;
  /** False when the admin already existed; its password is then left unchanged. */
  adminCreated: boolean;
}

/**
 * Syncs the system roles and creates the admin from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD, or
 * gives an existing one the `admin` role and a verified email.
 */
export async function seedDatabase(app: INestApplicationContext): Promise<SeedReport> {
  const config = app.get(AppConfig);
  const adminEmail = config.get('SEED_ADMIN_EMAIL');
  const adminPassword = config.get('SEED_ADMIN_PASSWORD');
  if (!adminEmail || !adminPassword) {
    throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to seed the admin user');
  }

  const { admin: adminRole } = await app.get(RolesService).syncSystemRoles();

  const users = app.get(UsersService);
  const existing = await users.findByEmail(adminEmail);
  if (existing) {
    // The password is only set on creation, so a password changed since then is kept.
    await users.updateUser(existing.id, {
      roleIds: [...existing.roles.map((role) => role.id), adminRole.id],
      emailVerified: existing.emailVerifiedAt === null ? true : undefined,
    });
    return { adminEmail: existing.email, adminCreated: false };
  }

  const admin = await users.createUser({
    email: adminEmail,
    password: adminPassword,
    name: ADMIN_NAME,
    roleIds: [adminRole.id],
    emailVerified: true,
  });
  return { adminEmail: admin.email, adminCreated: true };
}

// Runs only as the `db:seed` entry point, not when a test imports `seedDatabase`.
if (import.meta.main) {
  if (existsSync(ENV_FILE)) {
    process.loadEnvFile(ENV_FILE);
  }

  // Only problems from the app itself; the script reports its own progress.
  const app = await NestFactory.createApplicationContext(
    AppModule.forRoot({ env: parseEnv(process.env) }),
    { logger: ['error', 'warn'] },
  );

  try {
    const { adminEmail, adminCreated } = await seedDatabase(app);
    console.log('System roles are up to date');
    console.log(
      adminCreated
        ? `Created the admin ${adminEmail}`
        : `Updated the existing admin ${adminEmail}; its password is unchanged`,
    );
  } finally {
    await app.close();
  }
}
