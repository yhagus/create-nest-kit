import type { AppConfig } from '../../../config/app-config.js';

/** A link to a page of the front end (WEB_APP_URL), e.g. `/reset-password?token=…`. */
export function webAppLink(config: AppConfig, path: string, query: Record<string, string>): string {
  const base = config.get('WEB_APP_URL').replace(/\/+$/, '');
  const url = new URL(`${base}${path}`);
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
  return url.toString();
}
