import 'reflect-metadata';
import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppExceptionFilter } from './common/http/app-exception.filter';
import { RequestLoggingInterceptor } from './common/logging/request-logging.interceptor';
import { SecureLogger } from './common/logging/secure-logger.service';
import { requestIdMiddleware } from './common/http/request-id.middleware';
import { noStoreMiddleware } from './common/http/no-store.middleware';
import { validateEnvironment } from './config/environment';
import { setupOpenApi } from './openapi/openapi';

async function bootstrap(): Promise<void> {
  const environment = validateEnvironment(process.env);
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.getHttpAdapter().getInstance().set('trust proxy', false);
  const logger = app.get(SecureLogger);
  logger.setLevel(environment.logLevel);
  app.useLogger(logger);
  app.use(requestIdMiddleware);
  app.use(noStoreMiddleware);
  app.enableShutdownHooks();
  app.use(helmet());
  app.setGlobalPrefix('api/v1');
  setupOpenApi(app);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
    }),
  );
  app.useGlobalFilters(new AppExceptionFilter(logger));
  app.useGlobalInterceptors(new RequestLoggingInterceptor(logger));
  await app.listen(environment.port, '0.0.0.0');
  logger.log('API listening', { port: environment.port, environment: environment.nodeEnv });
}

void bootstrap();
