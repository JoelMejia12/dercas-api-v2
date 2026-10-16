import 'reflect-metadata';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { IsPositivePostgresBigint } from '../auth/bigint-id.validator';
import { ApiPageLimit, ApiPageOffset } from '../openapi/query-fields.decorator';

export class MovementHistoryQueryDto {
  @ApiPageLimit(25, 100) @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number = 25;
  @ApiPageOffset() @Type(() => Number) @IsInt() @Min(0) @Max(2147483647) offset: number = 0;
}

export class MovementIdParamDto {
  @IsPositivePostgresBigint()
  id!: string;
}
