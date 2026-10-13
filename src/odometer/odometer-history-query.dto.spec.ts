import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OdometerHistoryQueryDto } from './odometer-history-query.dto';

describe('OdometerHistoryQueryDto', () => {
  it('accepts bounded integer pagination', async () => {
    const dto = plainToInstance(OdometerHistoryQueryDto, { limit: '50', offset: '10' });
    expect(dto).toMatchObject({ limit: 50, offset: 10 });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects invalid pagination bounds', async () => {
    const dto = plainToInstance(OdometerHistoryQueryDto, { limit: '101', offset: '-1' });
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
