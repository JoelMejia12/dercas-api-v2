import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { REQUIRED_PERMISSIONS } from '../auth/auth.decorators';
import { MovementsController } from './movements.controller';
import { MovementsRepository } from './movements.repository';
import { MovementsService } from './movements.service';

describe('MovementsService and controller authorization', () => {
  it('returns not found for missing or out-of-scope movements', async () => {
    const repository = { findById: vi.fn().mockResolvedValue(null) } as unknown as MovementsRepository;
    await expect(new MovementsService(repository).findById('8', '12', 'assigned')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('uses distinct existing permissions for assigned and administrative records', () => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, MovementsController.prototype.assignedHistory)).toEqual(['VEHICULO_USAR_ASIGNADO']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, MovementsController.prototype.administrativeHistory)).toEqual(['VEHICULO_USAR_ADMINISTRATIVO']);
  });
});
