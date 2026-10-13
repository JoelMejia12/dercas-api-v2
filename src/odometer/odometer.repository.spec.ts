import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseService } from '../database/database.service';
import { OdometerHistoryQueryDto } from './odometer-history-query.dto';
import { OdometerRepository } from './odometer.repository';

describe('OdometerRepository', () => {
  it('reads the authenticated user’s readings without losing NUMERIC or BIGINT precision', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{
      id: '9223372036854775000', vehicle_id: '9223372036854774999', vehicle_plate: 'ABC-123',
      kilometers: '1234567890.1', type: 'JORNADA_INICIO',
      device_at: new Date('2026-06-01T10:00:00Z'), received_at: new Date('2026-06-01T10:01:00Z'),
      photo_url: 'https://files.example/odo.jpg', suggested_value: null, difference_reason: null, is_valid: true,
    }] });
    const repository = new OdometerRepository({ query } as unknown as DatabaseService);
    await expect(repository.findHistoryForUser('8', Object.assign(new OdometerHistoryQueryDto(), { limit: 25, offset: 0 })))
      .resolves.toMatchObject({
        items: [{ id: '9223372036854775000', vehicle: { id: '9223372036854774999' }, kilometers: '1234567890.1', isValid: true }],
        hasMore: false,
      });
    expect(query.mock.calls[0]?.[0]).toContain('WHERE lo.usuario_id = $1::bigint');
    expect(query.mock.calls[0]?.[0]).toContain('ORDER BY lo.fecha_hora_servidor DESC, lo.id DESC');
    expect(query.mock.calls[0]?.[1]).toEqual(['8', 26, 0]);
  });

  it('returns an empty result for a user without readings', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await expect(new OdometerRepository({ query } as unknown as DatabaseService)
      .findHistoryForUser('8', new OdometerHistoryQueryDto())).resolves.toMatchObject({ items: [], hasMore: false });
  });

  it('isolates individual reading lookups to the authenticated user', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{
      id: '12', vehicle_id: '22', vehicle_plate: 'ABC-123', kilometers: '1.5', type: 'COMBUSTIBLE',
      device_at: new Date('2026-06-01T10:00:00Z'), received_at: new Date('2026-06-01T10:01:00Z'),
      photo_url: null, suggested_value: null, difference_reason: null, is_valid: true,
    }] });
    const repository = new OdometerRepository({ query } as unknown as DatabaseService);
    await expect(repository.findByIdForUser('12', '8')).resolves.toMatchObject({ id: '12', kilometers: '1.5' });
    expect(query.mock.calls[0]?.[0]).toContain('WHERE lo.id = $1::bigint AND lo.usuario_id = $2::bigint');
    expect(query.mock.calls[0]?.[1]).toEqual(['12', '8']);
  });

  it('validates BIGINT identity before querying and propagates query errors', async () => {
    const query = vi.fn().mockRejectedValue(new Error('database unavailable'));
    const repository = new OdometerRepository({ query } as unknown as DatabaseService);
    await expect(repository.findHistoryForUser('9223372036854775808', new OdometerHistoryQueryDto()))
      .rejects.toThrow('Invalid value for userId');
    await expect(repository.findHistoryForUser('8', new OdometerHistoryQueryDto())).rejects.toThrow('database unavailable');
    expect(query).toHaveBeenCalledOnce();
  });

  it('uses only official odometer columns and relation', () => {
    const schema = readFileSync(resolve(process.cwd(), 'docs/GACOR_DERCAS_PostgreSQL_v3_GPS.sql'), 'utf8');
    const table = schema.match(/CREATE TABLE lecturas_odometro \(([\s\S]*?)\n\);/)?.[1];
    for (const column of ['vehiculo_id BIGINT', 'usuario_id BIGINT', 'kilometraje NUMERIC(12,1)', 'tipo_lectura tipo_lectura_odometro_enum', 'fecha_hora_dispositivo TIMESTAMPTZ', 'uuid_operacion UUID NOT NULL UNIQUE']) {
      expect(table).toContain(column);
    }
  });
});
