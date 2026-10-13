import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Observable, finalize } from 'rxjs';
import { SecureLogger } from './secure-logger.service';

interface RequestWithId extends Request {
  requestId?: string;
}

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: SecureLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const requestId = response.locals.requestId as string | undefined ?? randomUUID();
    request.requestId = requestId;
    const startedAt = Date.now();
    return next.handle().pipe(
      finalize(() => this.logger.log('HTTP request completed', {
        requestId,
        method: request.method,
        path: request.path,
        status: response.statusCode,
        durationMs: Date.now() - startedAt,
      })),
    );
  }
}
