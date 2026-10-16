
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { SecureLogger } from '../logging/secure-logger.service';

interface SafeRequest extends Request {
  requestId?: string;
}

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: SecureLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<SafeRequest>();
    const response = context.getResponse<Response>();
    const requestId = request.requestId ?? randomUUID();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Diagnóstico temporal: registrar código y tipo sin incluir mensajes,
    // parámetros SQL, contraseñas ni tokens.
    const diagnostic: Record<string, string | number | boolean> = {
      requestId,
      method: request.method,
      path: request.path,
      status,
      errorType: exception instanceof Error ? exception.name : 'UnknownError',
    };

    if (typeof exception === 'object' && exception !== null && 'code' in exception) {
      const code = (exception as { code?: unknown }).code;
      if (typeof code === 'string' && /^[A-Z0-9_]+$/.test(code)) {
        diagnostic['errorCode'] = code;
      }
    }

    this.logger.error('HTTP request failed', diagnostic);

    response.status(status).json({
      type: 'about:blank',
      title: this.titleFor(status),
      status,
      code: this.codeFor(status),
      detail: this.safeDetail(exception),
      requestId,
    });
  }

  private safeDetail(exception: unknown): string {
    if (!(exception instanceof HttpException)) return 'An unexpected error occurred';
    const status = exception.getStatus();
    if (status === HttpStatus.BAD_REQUEST) return 'The request is invalid';
    if (status === HttpStatus.UNAUTHORIZED) return 'Authentication is required';
    if (status === HttpStatus.FORBIDDEN) return 'The operation is not permitted';
    if (status === HttpStatus.NOT_FOUND) return 'The requested resource was not found';
    if (status === HttpStatus.CONFLICT) return 'The operation conflicts with the current resource state';
    return 'The request could not be completed';
  }

  private titleFor(status: number): string {
    if (status === HttpStatus.BAD_REQUEST) return 'Bad Request';
    if (status === HttpStatus.UNAUTHORIZED) return 'Unauthorized';
    if (status === HttpStatus.FORBIDDEN) return 'Forbidden';
    if (status === HttpStatus.NOT_FOUND) return 'Not Found';
    if (status === HttpStatus.CONFLICT) return 'Conflict';
    return status >= 500 ? 'Internal Server Error' : 'Request Failed';
  }

  private codeFor(status: number): string {
    if (status === HttpStatus.BAD_REQUEST) return 'INVALID_REQUEST';
    if (status === HttpStatus.UNAUTHORIZED) return 'UNAUTHENTICATED';
    if (status === HttpStatus.FORBIDDEN) return 'FORBIDDEN';
    if (status === HttpStatus.NOT_FOUND) return 'NOT_FOUND';
    if (status === HttpStatus.CONFLICT) return 'CONFLICT';
    return status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED';
  }
}
