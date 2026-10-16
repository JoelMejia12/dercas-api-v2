import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { ApiPageLimit, ApiPageOffset } from '../openapi/query-fields.decorator';

export const DEFAULT_LOAN_HISTORY_LIMIT = 25;
export const MAX_LOAN_HISTORY_LIMIT = 100;

export class LoanHistoryQueryDto {
  @ApiPageLimit(DEFAULT_LOAN_HISTORY_LIMIT, MAX_LOAN_HISTORY_LIMIT)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LOAN_HISTORY_LIMIT)
  limit: number = DEFAULT_LOAN_HISTORY_LIMIT;

  @ApiPageOffset()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  offset: number = 0;
}
