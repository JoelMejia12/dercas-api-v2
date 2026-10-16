import { describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Request, Response } from 'express';
import { RequestLoggingInterceptor } from './request-logging.interceptor';
import { SecureLogger } from './secure-logger.service';

describe('RequestLoggingInterceptor', () => {
  it('logs the final response status once after an exception filter completes the response', () => {
    const listeners = new Map<string, () => void>();
    const request = { method: 'POST', path: '/api/v1/auth/sessions' } as Request;
    const response = {
      locals: { requestId: 'request-test-id' },
      statusCode: 201,
      once: vi.fn((event: string, listener: () => void) => { listeners.set(event, listener); }),
    } as unknown as Response;
    const logger = { log: vi.fn() } as unknown as SecureLogger;
    const context = {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    } as unknown as ExecutionContext;
    const next = { handle: () => of({ accepted: true }) } as CallHandler;
    const interceptor = new RequestLoggingInterceptor(logger);

    interceptor.intercept(context, next).subscribe();
    expect(logger.log).not.toHaveBeenCalled();

    (response as unknown as { statusCode: number }).statusCode = 400;
    listeners.get('finish')?.();
    listeners.get('close')?.();

    expect(logger.log).toHaveBeenCalledOnce();
    expect(logger.log).toHaveBeenCalledWith('HTTP request completed', expect.objectContaining({
      requestId: 'request-test-id', method: 'POST', path: '/api/v1/auth/sessions', status: 400,
    }));
  });

  it('marks a closed response as incomplete instead of reporting completion', () => {
    const listeners = new Map<string, () => void>();
    const request = { method: 'GET', path: '/api/v1/users/me' } as Request;
    const response = {
      locals: { requestId: 'request-closed-id' },
      statusCode: 200,
      once: vi.fn((event: string, listener: () => void) => { listeners.set(event, listener); }),
    } as unknown as Response;
    const logger = { log: vi.fn(), warn: vi.fn() } as unknown as SecureLogger;
    const context = {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    } as unknown as ExecutionContext;
    const next = { handle: () => of({ id: '1' }) } as CallHandler;
    const interceptor = new RequestLoggingInterceptor(logger);

    interceptor.intercept(context, next).subscribe();
    listeners.get('close')?.();
    listeners.get('finish')?.();

    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledWith('HTTP connection closed before response completion', expect.objectContaining({
      requestId: 'request-closed-id', method: 'GET', path: '/api/v1/users/me',
    }));
    expect(logger.log).not.toHaveBeenCalled();
  });
});
