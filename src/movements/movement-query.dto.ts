import 'reflect-metadata';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { IsPositivePostgresBigint } from '../auth/bigint-id.validator';

export class MovementHistoryQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @Type(() => Number) @IsInt() @Min(0) @Max(2147483647) offset = 0;
}

export class MovementIdParamDto {
  @IsPositivePostgresBigint()
  id!: string;
}
