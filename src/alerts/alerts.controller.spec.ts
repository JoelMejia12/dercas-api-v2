import { describe, expect, it, vi } from 'vitest';
import { AuthPrincipal } from '../auth/auth.types';
import { AlertHistoryQueryDto } from './alerts.dto';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

describe('AlertsController', () => {
  it('uses the principal identity and existing permission for assigned vehicle scope', () => {
    const findForUser = vi.fn(); const findByIdForUser = vi.fn();
    const controller = new AlertsController({ findForUser, findByIdForUser } as unknown as AlertsService);
    const principal = { userId: '8', sessionId: '9', deviceId: '10', permissions: ['VEHICULO_USAR_ASIGNADO'] } as AuthPrincipal;
    const query = new AlertHistoryQueryDto();
    controller.findMine(principal, query); controller.findMineById(principal, { id: '41' });
    expect(findForUser).toHaveBeenCalledWith('8', true, query);
    expect(findByIdForUser).toHaveBeenCalledWith('41', '8', true);
  });

  it('does not grant assigned vehicle alert scope without its permission', () => {
    const findForUser = vi.fn();
    const controller = new AlertsController({ findForUser } as unknown as AlertsService);
    const principal = { userId: '8', sessionId: '9', deviceId: '10', permissions: [] } as AuthPrincipal;
    controller.findMine(principal, new AlertHistoryQueryDto());
    expect(findForUser).toHaveBeenCalledWith('8', false, expect.any(AlertHistoryQueryDto));
  });
});
