import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DEFAULT_FUEL_HISTORY_LIMIT, FuelHistoryQueryDto, MAX_FUEL_HISTORY_LIMIT } from './fuel-history-query.dto';

describe('FuelHistoryQueryDto', () => {
  it('defaults and transforms bounded pagination values', () => {
    expect(new FuelHistoryQueryDto()).toMatchObject({ limit: DEFAULT_FUEL_HISTORY_LIMIT, offset: 0 });
    expect(plainToInstance(FuelHistoryQueryDto, { limit: '100', offset: '20' }))
      .toMatchObject({ limit: MAX_FUEL_HISTORY_LIMIT, offset: 20 });
  });

  it.each([
    { limit: '0', offset: '0' },
    { limit: '101', offset: '0' },
    { limit: '1.5', offset: '0' },
    { limit: '25', offset: '-1' },
    { limit: '25', offset: '2147483648' },
  ])('rejects invalid pagination $limit/$offset', async (input) => {
    const errors = await validate(plainToInstance(FuelHistoryQueryDto, input));
    expect(errors.length).toBeGreaterThan(0);
  });
});
