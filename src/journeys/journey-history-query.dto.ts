import 'reflect-metadata';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { ApiPageLimit, ApiPageOffset } from '../openapi/query-fields.decorator';

export const DEFAULT_JOURNEY_HISTORY_LIMIT = 25;
export const MAX_JOURNEY_HISTORY_LIMIT = 100;

export class JourneyHistoryQueryDto {
  @ApiPageLimit(DEFAULT_JOURNEY_HISTORY_LIMIT, MAX_JOURNEY_HISTORY_LIMIT)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_JOURNEY_HISTORY_LIMIT)
  limit: number = DEFAULT_JOURNEY_HISTORY_LIMIT;

  @ApiPageOffset()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  offset: number = 0;
}
