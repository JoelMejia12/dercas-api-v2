import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export const DEFAULT_FUEL_HISTORY_LIMIT = 25;
export const MAX_FUEL_HISTORY_LIMIT = 100;

export class FuelHistoryQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_FUEL_HISTORY_LIMIT)
  limit = DEFAULT_FUEL_HISTORY_LIMIT;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  offset = 0;
}
