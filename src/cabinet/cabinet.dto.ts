import 'reflect-metadata';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { IsPositivePostgresBigint } from '../auth/bigint-id.validator';
import { ApiPageLimit, ApiPageOffset } from '../openapi/query-fields.decorator';

export const CABINET_EVENT_TYPES = ['LECTURA', 'LIBERACION', 'RETIRO', 'RETORNO_SOLICITADO', 'INGRESO_DETECTADO', 'BLOQUEO_CONFIRMADO', 'CAMBIO_POSICION', 'ERROR_CHIP', 'ERROR_INSERCION', 'LLAVE_INCORRECTA', 'TIMEOUT_RETORNO', 'APERTURA_ADMINISTRATIVA'] as const;
export const DEFAULT_CABINET_LIMIT = 25;
export const MAX_CABINET_LIMIT = 100;

export class CabinetIdParamDto { @IsPositivePostgresBigint() id!: string; }

export class CabinetListQueryDto {
  @ApiPageLimit(DEFAULT_CABINET_LIMIT, MAX_CABINET_LIMIT) @Type(() => Number) @IsInt() @Min(1) @Max(MAX_CABINET_LIMIT) limit: number = DEFAULT_CABINET_LIMIT;
  @ApiPageOffset() @Type(() => Number) @IsInt() @Min(0) @Max(2_147_483_647) offset: number = 0;
}

export class CabinetEventQueryDto extends CabinetListQueryDto {
  @IsOptional() @IsPositivePostgresBigint() cabinetId?: string;
  @IsOptional() @IsPositivePostgresBigint() positionId?: string;
  @IsOptional() @IsPositivePostgresBigint() keyringId?: string;
  @IsOptional() @IsPositivePostgresBigint() vehicleId?: string;
  @IsOptional() @IsPositivePostgresBigint() userId?: string;
  @IsOptional() @IsPositivePostgresBigint() loanId?: string;
  @IsOptional() @IsIn(CABINET_EVENT_TYPES) type?: typeof CABINET_EVENT_TYPES[number];
  @IsOptional() @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value) @IsBoolean() result?: boolean;
}
