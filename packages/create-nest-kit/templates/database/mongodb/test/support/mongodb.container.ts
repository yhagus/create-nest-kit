import { MongoDBContainer, type StartedMongoDBContainer } from '@testcontainers/mongodb';

const MONGODB_IMAGE = 'mongo:8';
const DATABASE_NAME = 'test';

export interface StartedMongoDB {
  container: StartedMongoDBContainer;
  /** Points at a database in the container. */
  uri: string;
}

/**
 * Starts MongoDB as a single-node replica set, so transactions work. The member advertises a
 * host name only the container knows, so clients connect to it directly.
 */
export async function startMongoDB(): Promise<StartedMongoDB> {
  const container = await new MongoDBContainer(MONGODB_IMAGE).start();
  const uri = new URL(container.getConnectionString());
  uri.pathname = `/${DATABASE_NAME}`;
  uri.searchParams.set('directConnection', 'true');
  return { container, uri: uri.toString() };
}
