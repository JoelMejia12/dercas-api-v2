import 'reflect-metadata';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export const DEFAULT_JOURNEY_HISTORY_LIMIT = 25;
export const MAX_JOURNEY_HISTORY_LIMIT = 100;

export class JourneyHistoryQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_JOURNEY_HISTORY_LIMIT)
  limit = DEFAULT_JOURNEY_HISTORY_LIMIT;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  offset = 0;
}
