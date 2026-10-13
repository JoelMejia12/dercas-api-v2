import { describe, expect, it, vi } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AppExceptionFilter } from './app-exception.filter';

describe('AppExceptionFilter', () => {
  it('returns a stable safe envelope without forwarding internal exception text', () => {
    const logger = { error: vi.fn() };
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const request = { requestId: 'request-id', method: 'GET', path: '/api/v1/private' };
    const host = {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({ status }) }),
    };
    const filter = new AppExceptionFilter(logger as never);

    filter.catch(new HttpException('secret detail', HttpStatus.BAD_REQUEST), host as never);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'INVALID_REQUEST',
      detail: 'The request is invalid',
      requestId: 'request-id',
    }));
    expect(JSON.stringify(json.mock.calls)).not.toContain('secret detail');
  });

  it('does not leak unexpected error messages', () => {
    const logger = { error: vi.fn() };
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({ getRequest: () => ({ method: 'POST', path: '/x' }), getResponse: () => ({ status }) }),
    };
    new AppExceptionFilter(logger as never).catch(new Error('password=sensitive'), host as never);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ status: 500, detail: 'An unexpected error occurred' }));
    expect(JSON.stringify(json.mock.calls)).not.toContain('sensitive');
  });
});
