import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IncidentHistoryQueryDto } from './incident-history-query.dto';

describe('IncidentHistoryQueryDto', () => {
  it('transforms and validates bounded pagination', async () => {
    const dto = plainToInstance(IncidentHistoryQueryDto, { limit: '100', offset: '15' });
    expect(dto).toMatchObject({ limit: 100, offset: 15 });
    expect(await validate(dto)).toHaveLength(0);
  });

  it.each([{ limit: '0', offset: '0' }, { limit: '101', offset: '0' }, { limit: '2', offset: '-1' }])(
    'rejects invalid pagination', async (input) => {
      expect(await validate(plainToInstance(IncidentHistoryQueryDto, input))).not.toHaveLength(0);
    },
  );
});
