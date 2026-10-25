import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../support/app.js';
import { isRecord } from '../support/json.js';
import { loadSwaggerPluginMetadata } from '../support/swagger-plugin-metadata.js';

/** The value at `path` in parsed JSON, or `undefined` when a key on the way is missing. */
function valueAt(json: unknown, path: readonly string[]): unknown {
  return path.reduce<unknown>((value, key) => (isRecord(value) ? value[key] : undefined), json);
}

/** `schema`, or the component it points to with `$ref`. */
function resolveSchema(document: unknown, schema: unknown): unknown {
  const ref = valueAt(schema, ['$ref']);
  if (typeof ref !== 'string') return schema;
  return valueAt(document, ref.replace('#/', '').split('/'));
}

describe('GET /docs with SWAGGER_ENABLED=true', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    await loadSwaggerPluginMetadata();
    testApp = await createTestApp({ SWAGGER_ENABLED: 'true' });
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('serves the API docs at the root, outside /api/v1', async () => {
    const response = await fetch(`${testApp.baseUrl}/docs`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
  });

  it('documents request bodies from the DTOs', async () => {
    const document: unknown = await (await fetch(`${testApp.baseUrl}/docs-json`)).json();

    const bodySchema = valueAt(document, [
      'paths',
      '/api/v1/auth/register',
      'post',
      'requestBody',
      'content',
      'application/json',
      'schema',
    ]);

    expect(valueAt(resolveSchema(document, bodySchema), ['properties'])).toEqual({
      email: expect.any(Object),
      password: expect.any(Object),
      name: expect.any(Object),
    });
  });

  it('documents query parameters from the DTOs', async () => {
    const document: unknown = await (await fetch(`${testApp.baseUrl}/docs-json`)).json();

    const parameters = valueAt(document, ['paths', '/api/v1/users', 'get', 'parameters']);

    expect(parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'page', in: 'query' }),
        expect.objectContaining({ name: 'limit', in: 'query' }),
        expect.objectContaining({ name: 'search', in: 'query' }),
      ]),
    );
  });
});
