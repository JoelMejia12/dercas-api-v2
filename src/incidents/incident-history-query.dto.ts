import 'reflect-metadata';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const INCIDENT_TYPES = ['FALLA_VEHICULO', 'OBSERVACION_VEHICULO', 'ACCIDENTE', 'PANICO', 'OTRO'] as const;

export const DEFAULT_INCIDENT_HISTORY_LIMIT = 25;
export const MAX_INCIDENT_HISTORY_LIMIT = 100;

export class IncidentHistoryQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INCIDENT_HISTORY_LIMIT)
  limit = DEFAULT_INCIDENT_HISTORY_LIMIT;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  offset = 0;

  @IsOptional()
  @IsIn(INCIDENT_TYPES)
  type?: typeof INCIDENT_TYPES[number];
}
