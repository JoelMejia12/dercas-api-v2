import 'reflect-metadata';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { IsPositivePostgresBigint } from '../auth/bigint-id.validator';

export const MAINTENANCE_ORDER_STATES = ['ABIERTA', 'EN_MANTENIMIENTO', 'FINALIZADA', 'CANCELADA'] as const;
export type MaintenanceOrderState = typeof MAINTENANCE_ORDER_STATES[number];

export const DEFAULT_MAINTENANCE_ORDER_LIMIT = 25;
export const MAX_MAINTENANCE_ORDER_LIMIT = 100;

export class MaintenanceOrderHistoryQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_MAINTENANCE_ORDER_LIMIT)
  limit = DEFAULT_MAINTENANCE_ORDER_LIMIT;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  offset = 0;

  @IsOptional()
  @IsIn(MAINTENANCE_ORDER_STATES)
  state?: MaintenanceOrderState;
}

export class MaintenanceOrderIdParamDto {
  @IsPositivePostgresBigint()
  id!: string;
}

export class CreateMaintenanceOrderDto {
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  reason?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  observations?: string;
}
