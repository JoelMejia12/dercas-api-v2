import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

export function requestIdMiddleware(_request: Request, response: Response, next: NextFunction): void {
  const requestId = randomUUID();
  response.locals.requestId = requestId;
  response.setHeader('x-request-id', requestId);
  next();
}
