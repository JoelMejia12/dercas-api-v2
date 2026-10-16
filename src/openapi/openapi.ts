import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupOpenApi(app: INestApplication): void {
  const document = createOpenApiDocument(app);
  SwaggerModule.setup('docs', app, document, { useGlobalPrefix: true, jsonDocumentUrl: 'docs/openapi.json' });
}

export function createOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('API GACOR/DERCAS')
    .setDescription('API REST para gestión vehicular GACOR/DERCAS. Las operaciones protegidas documentan el permiso requerido mediante `x-required-permissions`.')
    .setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'accessToken')
    .build();
  return SwaggerModule.createDocument(app, config);
}
