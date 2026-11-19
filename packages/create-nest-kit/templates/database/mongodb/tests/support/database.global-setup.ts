import { MongoDBContainer } from '@testcontainers/mongodb';

const MONGODB_IMAGE = 'mongo:8';
const DATABASE_NAME = 'test';

export interface StartedDatabase {
  /** Environment variables that point the app at the database. */
  env: Record<string, string>;
  stop(): Promise<void>;
}

/**
 * Starts MongoDB as a single-node replica set, so transactions work; the global setup creates
 * the indexes with `db:migrate`. The member advertises a host name only the container knows, so
 * clients connect to it directly.
 */
export async function startDatabase(): Promise<StartedDatabase> {
  const container = await new MongoDBContainer(MONGODB_IMAGE)
    // MongoDB 8 refuses to start on Linux kernels 6.19 to 7.0.13 (SERVER-121912) unless glibc keeps
    // rseq. docker-compose.yml sets the same; remove both once MongoDB ships a fix.
    .withEnvironment({ GLIBC_TUNABLES: 'glibc.pthread.rseq=1' })
    .start();
  const uri = new URL(container.getConnectionString());
  uri.pathname = `/${DATABASE_NAME}`;
  uri.searchParams.set('directConnection', 'true');
  return {
    env: { MONGODB_URI: uri.toString() },
    stop: async () => {
      await container.stop();
    },
  };
}
