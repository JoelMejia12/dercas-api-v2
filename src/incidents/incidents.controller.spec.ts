import { describe, expect, it, vi } from 'vitest';
import { REQUIRED_PERMISSIONS } from '../auth/auth.decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { CreateEmergencyDto, CreateIncidentDto } from './incident.dto';
import { IncidentHistoryQueryDto } from './incident-history-query.dto';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';

describe('IncidentsController', () => {
  it('derives the actor from the authenticated principal and audit IP from the request peer', async () => {
    const create = vi.fn().mockResolvedValue({ id: '1' });
    const controller = new IncidentsController({ create } as unknown as IncidentsService);
    const principal = { userId: '8', sessionId: '9', deviceId: '10', permissions: ['INCIDENCIA_REPORTAR'] } as AuthPrincipal;
    const body = Object.assign(new CreateIncidentDto(), {
      type: 'OTRO', description: 'Falla', operationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    await controller.create(principal, { ip: '192.0.2.8' } as never, body);
    expect(create).toHaveBeenCalledWith({
      userId: '8', auditIp: '192.0.2.8', type: 'OTRO', description: 'Falla',
      operationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
  });

  it('passes only the authenticated user ID to history and detail queries', async () => {
    const findHistoryForUser = vi.fn().mockResolvedValue({ items: [] });
    const findByIdForUser = vi.fn().mockResolvedValue({ id: '4' });
    const controller = new IncidentsController({ findHistoryForUser, findByIdForUser } as unknown as IncidentsService);
    const principal = { userId: '8', sessionId: '9', deviceId: '10', permissions: ['INCIDENCIA_REPORTAR'] } as AuthPrincipal;
    await controller.getMyHistory(principal, new IncidentHistoryQueryDto());
    await controller.getById(principal, { id: '4' });
    expect(findHistoryForUser).toHaveBeenCalledWith('8', expect.any(IncidentHistoryQueryDto));
    expect(findByIdForUser).toHaveBeenCalledWith('4', '8');
  });

  it('creates a PANICO record using principal identity and leaves physical/notification confirmation out of the request', async () => {
    const create = vi.fn().mockResolvedValue({ id: '31', type: 'PANICO' });
    const controller = new IncidentsController({ create } as unknown as IncidentsService);
    const principal = { userId: '8', sessionId: '9', deviceId: '10', permissions: ['INCIDENCIA_REPORTAR'] } as AuthPrincipal;
    const body = Object.assign(new CreateEmergencyDto(), { description: 'Necesito asistencia', operationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', latitude: '14.5', longitude: '-90.5' });
    await controller.createEmergency(principal, { ip: '192.0.2.8' } as never, body);
    expect(create).toHaveBeenCalledWith({ userId: '8', auditIp: '192.0.2.8', type: 'PANICO', description: 'Necesito asistencia', operationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', latitude: '14.5', longitude: '-90.5' });
  });

  it('requires the explicit incident reporting permission at controller scope', () => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, IncidentsController)).toEqual(['INCIDENCIA_REPORTAR']);
  });
});
