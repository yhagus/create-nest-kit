import { existsSync } from 'node:fs';
import { createApp } from './bootstrap/create-app.js';
import { AppConfig } from './config/app-config.js';

const ENV_FILE = '.env';

// Local development reads .env; deployments set real environment variables, which win.
if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

const app = await createApp();
// All interfaces (Fastify defaults to localhost only), so the API is reachable from a container.
await app.listen(app.get(AppConfig).get('PORT'), '0.0.0.0');
