import 'reflect-metadata';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { IsPositivePostgresBigint } from '../auth/bigint-id.validator';

export const ALERT_STATES = ['PENDIENTE', 'VISTA', 'EN_ATENCION', 'RESUELTA', 'DESCARTADA'] as const;
export const NOTIFICATION_STATES = ['PENDIENTE', 'ENVIADA', 'ENTREGADA', 'LEIDA', 'ERROR'] as const;
export const NOTIFICATION_CHANNELS = ['APP', 'PUSH', 'EMAIL', 'SMS'] as const;
export const DEFAULT_ALERT_LIMIT = 25;
export const MAX_ALERT_LIMIT = 100;

export class AlertHistoryQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(MAX_ALERT_LIMIT) limit = DEFAULT_ALERT_LIMIT;
  @Type(() => Number) @IsInt() @Min(0) @Max(2_147_483_647) offset = 0;
  @IsOptional() @IsIn(ALERT_STATES) alertState?: typeof ALERT_STATES[number];
  @IsOptional() @IsIn(NOTIFICATION_STATES) notificationState?: typeof NOTIFICATION_STATES[number];
  @IsOptional() @IsIn(NOTIFICATION_CHANNELS) channel?: typeof NOTIFICATION_CHANNELS[number];
}

export class AlertIdParamDto {
  @IsPositivePostgresBigint()
  id!: string;
}
