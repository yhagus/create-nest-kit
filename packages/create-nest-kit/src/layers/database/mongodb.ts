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

/**
 * MongoDB 8 refuses to start on Linux kernels 6.19 to 7.0.13 (SERVER-121912): its allocator's use
 * of rseq breaks there. Letting glibc keep rseq makes it fall back to per-thread caches and start.
 * The official image sets `glibc.pthread.rseq=0`, so this overrides it. Remove once fixed upstream.
 */
export const MONGODB_KERNEL_WORKAROUND = { GLIBC_TUNABLES: 'glibc.pthread.rseq=1' };

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
        environment: MONGODB_KERNEL_WORKAROUND,
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
  readme: [
    {
      title: 'MongoDB',
      body: `
- The \`mongo\` service runs as a single-node replica set, because MongoDB only runs transactions on a replica set. Connections use \`directConnection=true\`.
- It sets \`GLIBC_TUNABLES=glibc.pthread.rseq=1\`: MongoDB 8 refuses to start on Linux kernels 6.19 to 7.0.13 without it ([SERVER-121912](https://jira.mongodb.org/browse/SERVER-121912)). The test container sets it too. Remove it once MongoDB ships a fix.
`,
    },
  ],
};
