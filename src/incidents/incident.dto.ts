import 'reflect-metadata';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsString, IsUUID, registerDecorator } from 'class-validator';
import { IsPositivePostgresBigint } from '../auth/bigint-id.validator';

export const REPORTABLE_INCIDENT_TYPES = [
  'FALLA_VEHICULO',
  'OBSERVACION_VEHICULO',
  'ACCIDENTE',
  'OTRO',
] as const;

export type ReportableIncidentType = typeof REPORTABLE_INCIDENT_TYPES[number];
export type IncidentType = ReportableIncidentType | 'PANICO';

export class CreateIncidentDto {
  @IsIn(REPORTABLE_INCIDENT_TYPES)
  type!: ReportableIncidentType;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsUUID()
  operationId!: string;
}

export class CreateEmergencyDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsUUID()
  operationId!: string;

  @Transform(({ value }) => typeof value === 'number' && Number.isFinite(value) ? String(value) : value)
  @IsOptionalCoordinate(-90, 90)
  latitude?: string;

  @Transform(({ value }) => typeof value === 'number' && Number.isFinite(value) ? String(value) : value)
  @IsOptionalCoordinate(-180, 180)
  longitude?: string;
}

function IsOptionalCoordinate(minimum: number, maximum: number): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isOptionalCoordinate', target: target.constructor, propertyName: propertyKey.toString(),
      options: { message: `must be a decimal coordinate between ${minimum} and ${maximum}` },
      validator: { validate: (value: unknown) => value === undefined || value === null ||
        (typeof value === 'string' && /^-?\d{1,3}(?:\.\d{1,6})?$/.test(value) && Number(value) >= minimum && Number(value) <= maximum) },
    });
  };
}

export class IncidentIdParamDto {
  @IsPositivePostgresBigint()
  id!: string;
}

