import 'reflect-metadata';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { IsPositivePostgresBigint } from '../auth/bigint-id.validator';
import { ApiPageLimit, ApiPageOffset } from '../openapi/query-fields.decorator';

export const NOTIFICATION_STATES = ['PENDIENTE', 'ENVIADA', 'ENTREGADA', 'LEIDA', 'ERROR'] as const;
export const NOTIFICATION_CHANNELS = ['APP', 'PUSH', 'EMAIL', 'SMS'] as const;

export class NotificationListQueryDto {
  @ApiPageLimit(25, 100) @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number = 25;
  @ApiPageOffset() @Type(() => Number) @IsInt() @Min(0) @Max(2_147_483_647) offset: number = 0;
  @IsOptional() @IsIn(NOTIFICATION_STATES) state?: typeof NOTIFICATION_STATES[number];
  @IsOptional() @IsIn(NOTIFICATION_CHANNELS) channel?: typeof NOTIFICATION_CHANNELS[number];
}

export class NotificationIdParamDto {
  @IsPositivePostgresBigint() id!: string;
}
