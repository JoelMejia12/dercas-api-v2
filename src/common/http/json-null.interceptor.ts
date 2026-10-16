import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

/** Keeps nullable OpenAPI responses as an explicit JSON `null` body over HTTP. */
export class JsonNullResponse {
  toJSON(): null {
    return null;
  }
}

@Injectable()
export class JsonNullInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((value: unknown) => value === null ? new JsonNullResponse() : value));
  }
}
