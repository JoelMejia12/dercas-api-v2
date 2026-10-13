import 'reflect-metadata';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { IsPositivePostgresBigint } from '../auth/bigint-id.validator';

export const DEFAULT_VEHICLE_LIMIT = 25;
export const MAX_VEHICLE_LIMIT = 100;

export class VehiclePageQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(MAX_VEHICLE_LIMIT)
  limit = DEFAULT_VEHICLE_LIMIT;

  @Type(() => Number) @IsInt() @Min(0) @Max(2_147_483_647)
  offset = 0;

  @IsOptional() @IsPositivePostgresBigint()
  cabinetId?: string;
}

export class VehicleIdParamDto {
  @IsPositivePostgresBigint()
  id!: string;
}
