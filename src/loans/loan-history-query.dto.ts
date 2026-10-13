import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export const DEFAULT_LOAN_HISTORY_LIMIT = 25;
export const MAX_LOAN_HISTORY_LIMIT = 100;

export class LoanHistoryQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LOAN_HISTORY_LIMIT)
  limit = DEFAULT_LOAN_HISTORY_LIMIT;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  offset = 0;
}
