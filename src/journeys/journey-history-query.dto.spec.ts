import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { JourneyHistoryQueryDto } from './journey-history-query.dto';

describe('JourneyHistoryQueryDto', () => {
  it('transforms bounded integer pagination', async () => {
    const dto = plainToInstance(JourneyHistoryQueryDto, { limit: '80', offset: '5' });
    expect(dto).toMatchObject({ limit: 80, offset: 5 });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects invalid pagination values', async () => {
    expect(await validate(plainToInstance(JourneyHistoryQueryDto, { limit: '0', offset: '-1' }))).not.toHaveLength(0);
  });
});
