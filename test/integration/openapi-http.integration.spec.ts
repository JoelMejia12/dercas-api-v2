import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module';
import { setupOpenApi } from '../../src/openapi/openapi';
import { noStoreMiddleware } from '../../src/common/http/no-store.middleware';
import { requestIdMiddleware } from '../../src/common/http/request-id.middleware';
import { AppExceptionFilter } from '../../src/common/http/app-exception.filter';
import { RequestLoggingInterceptor } from '../../src/common/logging/request-logging.interceptor';
import { SecureLogger } from '../../src/common/logging/secure-logger.service';
import { DatabaseService } from '../../src/database/database.service';

const explicitlyEnabled = process.env.RUN_PG_INTEGRATION === '1';
const databaseVariables = ['DATABASE_URL', 'PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD', 'PGSSL'] as const;

describe.skipIf(!explicitlyEnabled)('OpenAPI HTTP contract (isolated Nest app)', () => {
  let app: INestApplication | undefined;
  let baseUrl: string;
  let originalEnvironment: NodeJS.ProcessEnv;

  beforeAll(async () => {
    originalEnvironment = { ...process.env };
    process.env.NODE_ENV = 'test';
    process.env.AUTH_TOKEN_SECRET = randomBytes(48).toString('base64url');
    for (const name of databaseVariables) delete process.env[name];

    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api/v1');
    app.use(requestIdMiddleware);
    app.use(noStoreMiddleware);
    setupOpenApi(app);
    app.useGlobalPipes(new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
    }));
    const logger = app.get(SecureLogger);
    app.useGlobalFilters(new AppExceptionFilter(logger));
    app.useGlobalInterceptors(new RequestLoggingInterceptor(logger));
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    if (!address || typeof address === 'string') throw new Error('Unable to start local OpenAPI HTTP test server');
    baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  }, 20_000);

  afterAll(async () => {
    await app?.close();
    if (originalEnvironment) {
      for (const name of [...databaseVariables, 'AUTH_TOKEN_SECRET', 'NODE_ENV'] as const) {
        const original = originalEnvironment[name];
        if (original === undefined) delete process.env[name];
        else process.env[name] = original;
      }
    }
  });

  it('serves the UI and all typed operation responses over HTTP', async () => {
    const ui = await fetch(`${baseUrl}/docs`);
    expect(ui.status).toBe(200);
    expect(ui.headers.get('content-type')).toContain('text/html');
    expect(ui.headers.get('cache-control')).toBe('no-store');

    const response = await fetch(`${baseUrl}/docs/openapi.json`);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const document = await response.json() as OpenApiDocument;
    const operations = Object.entries(document.paths).flatMap(([path, pathItem]) => Object.entries(pathItem)
      .filter(([method]) => ['get', 'post', 'put', 'patch', 'delete'].includes(method))
      .map(([method, operation]) => ({ path, method, operation })));
    expect(operations).toHaveLength(72);

    const withoutResponseBodies: string[] = [];
    let bodyResponses = 0;
    for (const { path, method, operation } of operations) {
      const responses = operation.responses ?? {};
      const successResponses = Object.entries(responses).filter(([status]) => status.startsWith('2'));
      const successfulBody = successResponses.flatMap(([, result]) => Object.values(result.content ?? {}))
        .find((media) => media.schema !== undefined)?.schema;
      if (successfulBody) {
        bodyResponses += 1;
        expect(isDescriptiveSchema(successfulBody, document.components.schemas)).toBe(true);
      } else {
        withoutResponseBodies.push(`${method.toUpperCase()} ${path}`);
      }
    }
    expect(bodyResponses).toBe(70);
    expect(withoutResponseBodies.sort()).toEqual([
      'POST /api/v1/auth/sessions/logout',
      'POST /api/v1/auth/sessions/revoke',
    ]);
    expect(document.paths['/api/v1/auth/sessions/logout']?.post?.responses?.['204']).toBeDefined();
    expect(document.paths['/api/v1/auth/sessions/revoke']?.post?.responses?.['204']).toBeDefined();
    expect(document.paths['/api/v1/maintenance/me/orders']?.post?.['x-required-permissions'])
      .toEqual(['VEHICULO_USAR_ASIGNADO', 'MANTENIMIENTO_CREAR']);
    expect(document.paths['/api/v1/loans']?.post?.responses?.['201']?.content?.['application/json']?.schema?.$ref)
      .toBe('#/components/schemas/LoanRequestResponse');
  });

  it('rejects unexpected login properties without reflecting submitted secrets', async () => {
    expect(app!.get(DatabaseService).isConfigured).toBe(false);
    const sentinel = `test-secret-${randomBytes(24).toString('hex')}`;
    const response = await fetch(`${baseUrl}/auth/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid-email', password: sentinel, deviceId: '0', deviceToken: sentinel, unexpectedField: sentinel,
      }),
    });
    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.text();
    expect(body).toContain('INVALID_REQUEST');
    expect(body).not.toContain(sentinel);
  });

  it('serves liveness while reporting sanitized readiness when no database is configured', async () => {
    expect(app!.get(DatabaseService).isConfigured).toBe(false);
    const liveResponse = await fetch(`${baseUrl}/health/live`);
    expect(liveResponse.status).toBe(200);
    expect(liveResponse.headers.get('cache-control')).toBe('no-store');
    await expect(liveResponse.json()).resolves.toEqual({ status: 'alive' });

    const readyResponse = await fetch(`${baseUrl}/health/ready`);
    expect(readyResponse.status).toBe(503);
    expect(readyResponse.headers.get('cache-control')).toBe('no-store');
    const readyBody = await readyResponse.json() as {
      status: string; checks: { process: string; database: string };
    };
    expect(readyBody).toEqual({ status: 'not_ready', checks: { process: 'up', database: 'not_configured' } });
    expect(JSON.stringify(readyBody)).not.toMatch(/password|token|secret|host|database_url|stack/i);
  });
});

interface OpenApiSchema {
  readonly $ref?: string;
  readonly type?: string;
  readonly properties?: Record<string, unknown>;
  readonly items?: OpenApiSchema;
  readonly allOf?: readonly OpenApiSchema[];
}

interface OpenApiOperation {
  readonly responses?: Record<string, { readonly content?: Record<string, { readonly schema?: OpenApiSchema }> }>;
  readonly 'x-required-permissions'?: readonly string[];
}

interface OpenApiDocument {
  readonly paths: Record<string, Record<string, OpenApiOperation>>;
  readonly components: { readonly schemas: Record<string, OpenApiSchema> };
}

function isDescriptiveSchema(schema: OpenApiSchema, schemas: Record<string, OpenApiSchema>, depth = 0): boolean {
  if (depth > 8) return false;
  if (schema.$ref) {
    const name = schema.$ref.split('/').at(-1);
    const referenced = name ? schemas[name] : undefined;
    return referenced ? isDescriptiveSchema(referenced, schemas, depth + 1) : false;
  }
  if (schema.properties && Object.keys(schema.properties).length > 0) return true;
  if (schema.items) return isDescriptiveSchema(schema.items, schemas, depth + 1);
  if (schema.allOf?.length) return schema.allOf.every((part) => isDescriptiveSchema(part, schemas, depth + 1));
  return ['string', 'integer', 'number', 'boolean'].includes(schema.type ?? '');
}
