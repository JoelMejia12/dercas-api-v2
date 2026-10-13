import { describe, expect, it, vi } from 'vitest';
import { REQUIRED_PERMISSIONS } from '../auth/auth.decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { AssignmentService } from './assignment.service';
import { AssignmentsController } from './assignments.controller';

describe('AssignmentsController', () => {
  it('uses only the authenticated principal user ID', async () => {
    const findCurrentForAuthenticatedPilot = vi.fn().mockResolvedValue(null);
    const controller = new AssignmentsController({ findCurrentForAuthenticatedPilot } as unknown as AssignmentService);
    const principal = { userId: '55', sessionId: '12', deviceId: '4', permissions: ['VEHICULO_USAR_ASIGNADO'] } as AuthPrincipal;
    await expect(controller.getMyActiveAssignment(principal)).resolves.toBeNull();
    expect(findCurrentForAuthenticatedPilot).toHaveBeenCalledExactlyOnceWith('55');
  });

  it('requires the existing assigned vehicle permission without an implicit role bypass', () => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, AssignmentsController.prototype.getMyActiveAssignment))
      .toEqual(['VEHICULO_USAR_ASIGNADO']);
  });

  it('uses the authenticated principal for history and prevents foreign assignment lookup', async () => {
    const findHistoryForAuthenticatedPilot = vi.fn().mockResolvedValue({ items: [], pagination: { limit: 5, offset: 10, hasMore: false } });
    const findByIdForAuthenticatedPilot = vi.fn().mockResolvedValue({ id: '12' });
    const controller = new AssignmentsController({ findHistoryForAuthenticatedPilot, findByIdForAuthenticatedPilot } as never);
    const principal = { userId: '55', sessionId: '12', deviceId: '4', permissions: ['VEHICULO_USAR_ASIGNADO'] } as AuthPrincipal;
    await controller.getMyHistory(principal, { limit: 5, offset: 10 });
    await controller.getMyById(principal, { id: '12' });
    expect(findHistoryForAuthenticatedPilot).toHaveBeenCalledWith('55', 5, 10);
    expect(findByIdForAuthenticatedPilot).toHaveBeenCalledWith('12', '55');
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, AssignmentsController.prototype.getMyById)).toEqual(['VEHICULO_USAR_ASIGNADO']);
  });
});
