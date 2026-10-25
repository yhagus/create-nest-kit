import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/database/prisma.service.js';

/** Where Prisma records the applied migrations, in the same schema as the app's tables. */
const MIGRATIONS_TABLE = '_prisma_migrations';

/** Empties every table in the `public` schema except Prisma's migration history. */
export async function resetDatabase(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  const tables = await prisma.$queryRaw<{ quotedName: string }[]>`
    select quote_ident(tablename) as "quotedName"
    from pg_tables
    where schemaname = 'public' and tablename <> ${MIGRATIONS_TABLE}`;
  if (tables.length === 0) return;

  // Table names can't be query parameters; quote_ident() above made them safe to splice in.
  const tableList = tables.map((table) => table.quotedName).join(', ');
  await prisma.$executeRawUnsafe(`truncate table ${tableList} restart identity cascade`);
}
