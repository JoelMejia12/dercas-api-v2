import 'reflect-metadata';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { IsPositivePostgresBigint } from '../auth/bigint-id.validator';

export const DEFAULT_GPS_LIMIT = 100;
export const MAX_GPS_LIMIT = 500;
export const GPS_ARCHIVE_STATES = ['GENERANDO', 'GENERADO', 'VERIFICADO', 'COPIADO_EXTERNO', 'ERROR', 'PURGADO'] as const;

export class GpsPageQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(MAX_GPS_LIMIT) limit = DEFAULT_GPS_LIMIT;
  @Type(() => Number) @IsInt() @Min(0) @Max(2_147_483_647) offset = 0;
}

export class GpsSessionIdParamDto {
  @IsPositivePostgresBigint() id!: string;
}

export class GpsVehicleIdParamDto {
  @IsPositivePostgresBigint() vehicleId!: string;
}

export class GpsDeviceIdParamDto {
  @IsPositivePostgresBigint() id!: string;
}

export class GpsPositionHistoryQueryDto extends GpsPageQueryDto {
  @IsDateString({ strict: true }) from!: string;
  @IsDateString({ strict: true }) to!: string;
}

export class GpsArchiveQueryDto extends GpsPageQueryDto {
  @IsOptional() @IsIn(GPS_ARCHIVE_STATES) state?: typeof GPS_ARCHIVE_STATES[number];
}
