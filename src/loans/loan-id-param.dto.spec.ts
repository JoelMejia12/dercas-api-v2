import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { LoanIdParamDto } from './loan-id-param.dto';

describe('LoanIdParamDto', () => {
  it('accepts positive BIGINT IDs as decimal strings', async () => {
    const params = plainToInstance(LoanIdParamDto, { id: '9223372036854775807' });
    expect(await validate(params)).toHaveLength(0);
  });

  it.each(['0', '-1', '1.5', '9223372036854775808', '1e2'])('rejects invalid ID %s', async (id) => {
    const params = plainToInstance(LoanIdParamDto, { id });
    expect(await validate(params)).not.toHaveLength(0);
  });
});
