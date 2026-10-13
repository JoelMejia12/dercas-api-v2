import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateMaintenanceOrderDto, MaintenanceOrderHistoryQueryDto } from './maintenance.dto';

describe('Maintenance DTOs', () => {
  it('validates and transforms order pagination and enum filters', async () => {
    const dto = plainToInstance(MaintenanceOrderHistoryQueryDto, { limit: '50', offset: '10', state: 'ABIERTA' });
    expect(dto).toMatchObject({ limit: 50, offset: 10, state: 'ABIERTA' });
    expect(await validate(dto)).toHaveLength(0);
    expect(await validate(plainToInstance(MaintenanceOrderHistoryQueryDto, { state: 'UNKNOWN' }))).not.toHaveLength(0);
  });

  it('trims optional text and rejects blank values when supplied', async () => {
    const dto = plainToInstance(CreateMaintenanceOrderDto, { reason: '  Servicio  ' });
    expect(dto.reason).toBe('Servicio');
    expect(await validate(dto)).toHaveLength(0);
    expect(await validate(plainToInstance(CreateMaintenanceOrderDto, { observations: '  ' }))).not.toHaveLength(0);
  });
});
