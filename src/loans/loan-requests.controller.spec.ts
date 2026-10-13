import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { REQUIRED_PERMISSIONS } from '../auth/auth.decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { LoanRequestService } from './loan-request.service';
import { LoanRequestsController } from './loan-requests.controller';

describe('LoanRequestsController', () => {
  it('takes the user identity only from the authenticated principal', async () => {
    const create = vi.fn().mockResolvedValue({ id: '4', status: 'SOLICITADO' });
    const controller = new LoanRequestsController({ create } as unknown as LoanRequestService);
    const principal = { userId: '31', sessionId: '2', deviceId: '8', permissions: ['VEHICULO_USAR_ADMINISTRATIVO'] } as AuthPrincipal;
    await controller.create(principal, {
      vehicleId: '9', operationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', destination: 'Bodega', reason: 'Traslado',
    }, { ip: '198.51.100.24', headers: { 'x-forwarded-for': '203.0.113.99' } } as never);
    expect(create).toHaveBeenCalledWith({
      vehicleId: '9', userId: '31', operationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      destination: 'Bodega', reason: 'Traslado', auditIp: '198.51.100.24',
    });
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, LoanRequestsController)).toEqual(['VEHICULO_USAR_ADMINISTRATIVO']);
  });

  it('passes the path ID and only the authenticated owner to the individual request lookup', async () => {
    const findById = vi.fn().mockResolvedValue({ id: '4', status: 'SOLICITADO' });
    const controller = new LoanRequestsController({ create: vi.fn(), findById } as unknown as LoanRequestService);
    const principal = { userId: '31', sessionId: '2', deviceId: '8', permissions: ['VEHICULO_USAR_ADMINISTRATIVO'] } as AuthPrincipal;
    await controller.getById(principal, { id: '4' });
    expect(findById).toHaveBeenCalledWith('4', '31');
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, LoanRequestsController)).toEqual(['VEHICULO_USAR_ADMINISTRATIVO']);
  });
});
