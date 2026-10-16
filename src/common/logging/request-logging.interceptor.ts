import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Observable } from 'rxjs';
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
    let logged = false;
    const logCompleted = () => {
      if (logged) return;
      logged = true;
      this.logger.log('HTTP request completed', {
        requestId,
        method: request.method,
        path: request.path,
        status: response.statusCode,
        durationMs: Date.now() - startedAt,
      });
    };
    // Exception filters write the final status after the handler observable fails.
    // Log on the actual HTTP response completion so errors are not reported with
    // the controller's default status (for example, 201 instead of 400).
    response.once('finish', logCompleted);
    response.once('close', () => {
      if (logged) return;
      logged = true;
      this.logger.warn('HTTP connection closed before response completion', {
        requestId,
        method: request.method,
        path: request.path,
        status: response.statusCode,
        durationMs: Date.now() - startedAt,
      });
    });
    return next.handle();
  }
}
