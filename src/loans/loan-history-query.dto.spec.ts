import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { DEFAULT_LOAN_HISTORY_LIMIT, LoanHistoryQueryDto, MAX_LOAN_HISTORY_LIMIT } from './loan-history-query.dto';

describe('LoanHistoryQueryDto', () => {
  it('uses bounded defaults and accepts integer query parameters', async () => {
    const defaults = plainToInstance(LoanHistoryQueryDto, {});
    expect(defaults).toMatchObject({ limit: DEFAULT_LOAN_HISTORY_LIMIT, offset: 0 });
    expect(await validate(defaults)).toHaveLength(0);
    const parsed = plainToInstance(LoanHistoryQueryDto, { limit: '100', offset: '25' });
    expect(parsed).toMatchObject({ limit: MAX_LOAN_HISTORY_LIMIT, offset: 25 });
    expect(await validate(parsed)).toHaveLength(0);
  });

  it.each([
    { limit: '0', offset: '0' },
    { limit: '101', offset: '0' },
    { limit: '1.5', offset: '0' },
    { limit: '25', offset: '-1' },
    { limit: '25', offset: '2147483648' },
  ])('rejects invalid pagination %#', async (input) => {
    const dto = plainToInstance(LoanHistoryQueryDto, input);
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
