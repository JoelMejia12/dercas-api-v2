import 'reflect-metadata';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { IsPositivePostgresBigint } from '../auth/bigint-id.validator';

export const DEFAULT_USERS_LIMIT = 25;
export const MAX_USERS_LIMIT = 100;

export class UsersListQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(MAX_USERS_LIMIT)
  limit = DEFAULT_USERS_LIMIT;

  @Type(() => Number) @IsInt() @Min(0) @Max(2_147_483_647)
  offset = 0;

  @IsOptional() @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value) @IsBoolean()
  active?: boolean;

  @IsOptional() @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MaxLength(120)
  q?: string;
}

export class UserIdParamDto {
  @IsPositivePostgresBigint()
  id!: string;
}
