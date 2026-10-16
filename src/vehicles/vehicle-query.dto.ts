import 'reflect-metadata';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { IsPositivePostgresBigint } from '../auth/bigint-id.validator';
import { ApiPageLimit, ApiPageOffset } from '../openapi/query-fields.decorator';

export const DEFAULT_VEHICLE_LIMIT = 25;
export const MAX_VEHICLE_LIMIT = 100;

export class VehiclePageQueryDto {
  @ApiPageLimit(DEFAULT_VEHICLE_LIMIT, MAX_VEHICLE_LIMIT)
  @Type(() => Number) @IsInt() @Min(1) @Max(MAX_VEHICLE_LIMIT)
  limit: number = DEFAULT_VEHICLE_LIMIT;

  @ApiPageOffset()
  @Type(() => Number) @IsInt() @Min(0) @Max(2_147_483_647)
  offset: number = 0;

  @IsOptional() @IsPositivePostgresBigint()
  cabinetId?: string;
}

export class VehicleIdParamDto {
  @IsPositivePostgresBigint()
  id!: string;
}
