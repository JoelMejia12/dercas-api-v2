import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { createOpenApiDocument } from './openapi';

async function verifyOpenApi(): Promise<void> {
  process.env.NODE_ENV = 'test';
  process.env.AUTH_TOKEN_SECRET = randomBytes(48).toString('base64url');
  for (const key of ['DATABASE_URL', 'PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD']) delete process.env[key];
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  try {
    const document = createOpenApiDocument(app);
    const operations = Object.entries(document.paths).flatMap(([path, pathItem]) => Object.entries(pathItem)
      .filter(([method]) => ['get', 'post', 'put', 'patch', 'delete'].includes(method))
      .map(([method, operation]) => ({ path, method, operation })));
    if (operations.length !== 72) throw new Error(`Expected 72 documented controller operations; found ${operations.length}`);

    const officialSql = readFileSync(resolve(process.cwd(), 'docs/GACOR_DERCAS_PostgreSQL_v3_GPS.sql'), 'utf8');
    const permissionSeed = officialSql.match(/INSERT INTO permisos\(codigo,nombre\) VALUES([\s\S]*?);/i)?.[1];
    if (!permissionSeed) throw new Error('Official SQL permission catalog seed was not found');
    const sqlPermissions = new Set(Array.from(permissionSeed.matchAll(/\('([A-Z_]+)'\s*,\s*'[^']*'\)/g), (match) => match[1]));
    if (sqlPermissions.size !== 23) throw new Error(`Expected 23 permissions in official SQL; found ${sqlPermissions.size}`);
    const requiredPermissions = new Set<string>();
    for (const { operation } of operations) {
      const declared = (operation as unknown as Record<string, unknown>)['x-required-permissions'];
      if (Array.isArray(declared)) for (const permission of declared) if (typeof permission === 'string') requiredPermissions.add(permission);
    }
    const undeclaredPermissionCodes = [...requiredPermissions].filter((permission) => !sqlPermissions.has(permission));
    if (undeclaredPermissionCodes.length) throw new Error(`Controller permissions absent from official SQL: ${undeclaredPermissionCodes.join(', ')}`);

    const publicOperations = new Set([
      'GET /api/v1/health/live',
      'GET /api/v1/health/ready',
      'POST /api/v1/auth/sessions',
      'POST /api/v1/auth/sessions/refresh',
    ]);
    const sessionOnlyWrites = new Set([
      'POST /api/v1/auth/sessions/revoke',
      'POST /api/v1/auth/sessions/logout',
    ]);
    for (const { path, method, operation } of operations) {
      const operationId = `${method.toUpperCase()} ${path}`;
      const metadata = operation as unknown as { security?: unknown; 'x-required-permissions'?: unknown };
      const hasBearer = Array.isArray(metadata.security) && metadata.security.some((entry) =>
        typeof entry === 'object' && entry !== null && 'accessToken' in entry,
      );
      const permissions = metadata['x-required-permissions'];
      if (publicOperations.has(operationId)) continue;
      if (!hasBearer) throw new Error(`Operation is missing bearer security: ${operationId}`);
      if (sessionOnlyWrites.has(operationId)) {
        if (Array.isArray(permissions) && permissions.length > 0) {
          throw new Error(`Session-owned operation must not invent an application permission: ${operationId}`);
        }
        continue;
      }
      if (method !== 'get' && (!Array.isArray(permissions) || permissions.length === 0)) {
        throw new Error(`Write operation is missing a required permission: ${operationId}`);
      }
    }

    const login = document.paths['/api/v1/auth/sessions']?.post as unknown as {
      responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
    } | undefined;
    if (login?.responses?.['201']?.content?.['application/json']?.schema?.$ref !== '#/components/schemas/TokenPairDto') {
      throw new Error('Login response schema is missing from OpenAPI');
    }
    const loginSchema = document.components?.schemas?.LoginDto as unknown as {
      properties?: Record<string, { writeOnly?: boolean }>;
    } | undefined;
    if (loginSchema?.properties?.password?.writeOnly !== true || loginSchema.properties.deviceToken?.writeOnly !== true) {
      throw new Error('Sensitive login inputs must be documented as write-only');
    }
    const liveResponses = document.paths['/api/v1/health/live']?.get?.responses as unknown as
      Record<string, { content?: Record<string, { schema?: { properties?: Record<string, { enum?: string[] }> } }> }> | undefined;
    if (liveResponses?.['200']?.content?.['application/json']?.schema?.properties?.status?.enum?.[0] !== 'alive') {
      throw new Error('Health liveness response schema is missing from OpenAPI');
    }
    const readinessResponses = document.paths['/api/v1/health/ready']?.get?.responses ?? {};
    if (!('200' in readinessResponses) || !('503' in readinessResponses)) {
      throw new Error('Health readiness success and unavailable responses are required in OpenAPI');
    }
    const cabinet = document.paths['/api/v1/cabinet']?.get;
    const cabinetPermissions = (cabinet as unknown as Record<string, unknown> | undefined)?.['x-required-permissions'];
    if (!Array.isArray(cabinetPermissions) || cabinetPermissions.join(',') !== 'GABINETE_VER') {
      throw new Error('Cabinet permission metadata is missing from OpenAPI');
    }
    const maintenanceCreatePermissions = (document.paths['/api/v1/maintenance/me/orders']?.post as unknown as Record<string, unknown> | undefined)?.['x-required-permissions'];
    if (!Array.isArray(maintenanceCreatePermissions) || maintenanceCreatePermissions.join(',') !== 'VEHICULO_USAR_ASIGNADO,MANTENIMIENTO_CREAR') {
      throw new Error('Maintenance creation must document assigned-vehicle scope and the creation permission');
    }
    const journeyStartPermissions = (document.paths['/api/v1/journeys/me']?.post as unknown as Record<string, unknown> | undefined)?.['x-required-permissions'];
    if (!Array.isArray(journeyStartPermissions) || journeyStartPermissions.join(',') !== 'VEHICULO_USAR_ASIGNADO,JORNADA_INICIAR') {
      throw new Error('Journey start must document assigned-vehicle scope and the start permission');
    }
    const journeyFinishPermissions = (document.paths['/api/v1/journeys/{id}/finish']?.patch as unknown as Record<string, unknown> | undefined)?.['x-required-permissions'];
    if (!Array.isArray(journeyFinishPermissions) || journeyFinishPermissions.join(',') !== 'VEHICULO_USAR_ASIGNADO,JORNADA_FINALIZAR') {
      throw new Error('Journey finish must document assigned-vehicle scope and the finish permission');
    }
    const vehicleParameters = document.paths['/api/v1/vehicles/administrative/available']?.get?.parameters as unknown as
      Array<{ name: string; required?: boolean; schema?: { type?: string } }> | undefined ?? [];
    for (const name of ['limit', 'offset']) {
      const parameter = vehicleParameters.find((item) => item.name === name);
      if (parameter?.required !== false || parameter.schema?.type !== 'integer') {
        throw new Error(`Query parameter ${name} must be optional integer in OpenAPI`);
      }
    }
    const assertResponseRef = (path: string, method: 'get' | 'post' | 'patch', responseCode: string, schemaPath: string, ref: string) => {
      const operation = document.paths[path]?.[method] as unknown as {
        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string; properties?: Record<string, { items?: { $ref?: string }; properties?: Record<string, unknown> }> } }> }>;
      } | undefined;
      const schema = operation?.responses?.[responseCode]?.content?.['application/json']?.schema;
      const actual = schemaPath.split('.').reduce<unknown>((value, part) => (value as Record<string, unknown> | undefined)?.[part], schema);
      if (actual !== ref) throw new Error(`Expected ${ref} response contract at ${method.toUpperCase()} ${path} (${schemaPath}); found ${JSON.stringify(actual)}`);
    };
    assertResponseRef('/api/v1/users', 'get', '200', 'properties.items.items.$ref', '#/components/schemas/UserProfileResponse');
    assertResponseRef('/api/v1/users', 'get', '200', 'properties.pagination.properties.hasMore.type', 'boolean');
    assertResponseRef('/api/v1/cabinet', 'get', '200', 'properties.items.items.$ref', '#/components/schemas/CabinetResponse');
    assertResponseRef('/api/v1/cabinet', 'get', '200', 'properties.pagination.properties.hasMore.type', 'boolean');
    assertResponseRef('/api/v1/cabinet/events', 'get', '200', 'properties.items.items.$ref', '#/components/schemas/CabinetEventResponse');
    assertResponseRef('/api/v1/cabinet/{id}/positions', 'get', '200', 'items.$ref', '#/components/schemas/CabinetPositionResponse');
    assertResponseRef('/api/v1/vehicles/assigned', 'get', '200', 'allOf.0.$ref', '#/components/schemas/AssignedVehicleResponse');
    assertResponseRef('/api/v1/vehicles/me/assignments', 'get', '200', 'items.$ref', '#/components/schemas/VehicleAssignmentHistoryResponse');
    assertResponseRef('/api/v1/vehicles/administrative/available', 'get', '200', 'properties.items.items.$ref', '#/components/schemas/AdministrativeAvailableVehicleResponse');
    assertResponseRef('/api/v1/loans', 'post', '201', '$ref', '#/components/schemas/LoanRequestResponse');
    assertResponseRef('/api/v1/fuel', 'post', '201', '$ref', '#/components/schemas/FuelChargeResponse');
    assertResponseRef('/api/v1/incidents', 'post', '201', '$ref', '#/components/schemas/IncidentResponse');
    assertResponseRef('/api/v1/incidents/emergencies', 'post', '201', '$ref', '#/components/schemas/IncidentResponse');
    assertResponseRef('/api/v1/maintenance/me/orders', 'post', '201', '$ref', '#/components/schemas/MaintenanceOrderResponse');
    assertResponseRef('/api/v1/journeys/me', 'post', '201', '$ref', '#/components/schemas/JourneyResponse');
    assertResponseRef('/api/v1/journeys/{id}/finish', 'patch', '200', '$ref', '#/components/schemas/JourneyResponse');
    for (const path of ['/api/v1/auth/sessions/revoke', '/api/v1/auth/sessions/logout']) {
      const responses = document.paths[path]?.post?.responses ?? {};
      const noContentResponse = responses['204'];
      if (!noContentResponse || 'content' in noContentResponse) throw new Error(`Expected documented 204 no-content response for ${path}`);
    }
    const withResponseSchema = operations.filter(({ operation }) => {
      const responses = (operation as unknown as { responses?: Record<string, { content?: Record<string, { schema?: unknown }> }> }).responses ?? {};
      return Object.values(responses).some((response) => Object.values(response.content ?? {}).some((content) => content.schema !== undefined));
    }).length;
    const missingResponseSchemas = operations.filter(({ operation }) => {
      const responses = (operation as unknown as { responses?: Record<string, { content?: Record<string, { schema?: unknown }> }> }).responses ?? {};
      return !Object.values(responses).some((response) => Object.values(response.content ?? {}).some((content) => content.schema !== undefined));
    }).map(({ path, method }) => `${method.toUpperCase()} ${path}`);
    const expectedNoContentOperations = ['POST /api/v1/auth/sessions/logout', 'POST /api/v1/auth/sessions/revoke'];
    if (withResponseSchema !== 70 || missingResponseSchemas.length !== expectedNoContentOperations.length ||
      expectedNoContentOperations.some((entry) => !missingResponseSchemas.includes(entry))) {
      throw new Error(`Unexpected response-schema coverage: ${withResponseSchema}/${operations.length}; missing ${missingResponseSchemas.join(', ')}`);
    }
    type SchemaNode = { $ref?: string; type?: string; properties?: Record<string, unknown>; items?: SchemaNode; allOf?: SchemaNode[]; nullable?: boolean };
    const isDescriptiveSchema = (schema: SchemaNode, depth = 0): boolean => {
      if (depth > 8) return false;
      if (schema.$ref) {
        const name = schema.$ref.split('/').at(-1);
        const referenced = name ? document.components?.schemas?.[name] as SchemaNode | undefined : undefined;
        return referenced ? isDescriptiveSchema(referenced, depth + 1) : false;
      }
      if (schema.properties && Object.keys(schema.properties).length) return true;
      if (schema.items) return isDescriptiveSchema(schema.items, depth + 1);
      if (schema.allOf?.length) return schema.allOf.every((part) => isDescriptiveSchema(part, depth + 1));
      return ['string', 'integer', 'number', 'boolean'].includes(schema.type ?? '');
    };
    const opaqueSuccessSchemas: string[] = [];
    for (const { path, method, operation } of operations) {
      const responses = (operation as unknown as { responses?: Record<string, { content?: Record<string, { schema?: SchemaNode }> }> }).responses ?? {};
      const successBodySchema = Object.entries(responses).find(([code, response]) => code.startsWith('2') &&
        Object.values(response.content ?? {}).some((content) => content.schema !== undefined));
      const schema = successBodySchema?.[1].content?.['application/json']?.schema;
      if (schema && !isDescriptiveSchema(schema)) opaqueSuccessSchemas.push(`${method.toUpperCase()} ${path}`);
    }
    if (opaqueSuccessSchemas.length) throw new Error(`Success responses have opaque schemas: ${opaqueSuccessSchemas.join('; ')}`);
    process.stdout.write(`OpenAPI verified: ${operations.length} operations, ${withResponseSchema} descriptive response schemas, ${sqlPermissions.size} SQL permission codes, 2 documented no-content responses, bearer security, and request schemas.\n`);
  } finally {
    await app.close();
  }
}

void verifyOpenApi();
