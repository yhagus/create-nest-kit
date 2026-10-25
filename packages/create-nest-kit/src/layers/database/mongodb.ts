import { TESTCONTAINERS_VERSION } from '../base.ts';
import type { LayerManifest } from '../types.ts';

const REPLICA_SET = 'rs0';

/**
 * Turns the container into a single-node replica set on its first health check, because
 * MongoDB only runs transactions on a replica set. Healthy once the node is the primary.
 */
const INITIATE_REPLICA_SET = [
  'try { rs.status() } catch (error) {',
  `rs.initiate({ _id: '${REPLICA_SET}', members: [{ _id: 0, host: 'localhost:27017' }] })`,
  '}',
  'quit(db.hello().isWritablePrimary ? 0 : 1)',
].join(' ');

export const mongodbLayer: LayerManifest = {
  id: 'database/mongodb',
  status: 'ready',
  when: (options) => options.database === 'mongodb',
  devDependencies: {
    '@testcontainers/mongodb': TESTCONTAINERS_VERSION,
  },
  env: [
    {
      key: 'MONGODB_URI',
      value: 'mongodb://localhost:27017/app?directConnection=true',
      comment: 'directConnection: the replica set member is only known as localhost inside Docker',
    },
  ],
  compose: {
    services: {
      mongo: {
        image: 'mongo:8',
        command: ['--replSet', REPLICA_SET, '--bind_ip_all'],
        ports: ['27017:27017'],
        volumes: ['mongo-data:/data/db'],
        healthcheck: {
          test: ['CMD', 'mongosh', '--quiet', '--eval', INITIATE_REPLICA_SET],
          interval: '5s',
          timeout: '10s',
          start_period: '10s',
          retries: 20,
        },
      },
    },
    volumes: ['mongo-data'],
  },
};
