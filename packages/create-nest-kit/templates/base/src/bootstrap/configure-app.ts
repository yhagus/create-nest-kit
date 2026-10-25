import { type INestApplication, VersioningType } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from '../common/http-exception.filter.js';
import { createValidationPipe } from '../common/validation.js';
import { AppConfig } from '../config/app-config.js';

export const GLOBAL_PREFIX = 'api';
export const DEFAULT_API_VERSION = '1';
const DOCS_PATH = 'docs';
const CORS_METHODS = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'];

/**
 * The HTTP pipeline, shared by both platforms and by the e2e harness.
 * The order matters where noted.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(AppConfig);
  const corsOrigins = config.get('CORS_ORIGINS');

  // 1. CORS before the security hook: on Express, middleware registered earlier runs first,
  //    so a CSRF rejection still carries CORS headers. (On Fastify the hook always runs first.)
  app.enableCors({ origin: corsOrigins, credentials: true, methods: CORS_METHODS });

  // 2. Security headers, then the CSRF check. Both run before routing, so they cover 404s too.
  app.useSecurityHeaders();
  if (config.get('CSRF_ENABLED')) {
    app.enableCsrfProtection({ trustedOrigins: corsOrigins });
  }

  // 3. Routes: /api/v1/... ; /health stays at the root for load balancers. /docs is not
  //    a controller route, so neither the prefix nor versioning applies to it.
  app.setGlobalPrefix(GLOBAL_PREFIX, { exclude: ['health'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: DEFAULT_API_VERSION });

  // 4. Input validation and the error body shape.
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter(app.get(HttpAdapterHost)));

  if (config.get('SWAGGER_ENABLED')) {
    setUpSwagger(app, config.get('APP_NAME'));
  }

  app.enableShutdownHooks();
}

function setUpSwagger(app: INestApplication, title: string): void {
  const document = new DocumentBuilder().setTitle(title).addBearerAuth().build();
  SwaggerModule.setup(DOCS_PATH, app, () => SwaggerModule.createDocument(app, document));
}
