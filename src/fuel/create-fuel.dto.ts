import 'reflect-metadata';
import { IsDateString, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { IsPositivePostgresBigint } from '../auth/bigint-id.validator';

const NUMERIC_12_2 = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;
const POSITIVE_NUMERIC_10_3 = /^(?=.*[1-9])(?:0|[1-9]\d{0,6})(?:\.\d{1,3})?$/;
const NUMERIC_12_1 = /^(?:0|[1-9]\d{0,10})(?:\.\d)?$/;
const LATITUDE = /^-?(?:0?\d|[1-8]\d)(?:\.\d{1,6})?$|^-?90(?:\.0{1,6})?$/;
const LONGITUDE = /^-?(?:(?:0?\d|[1-9]\d|1[0-7]\d)(?:\.\d{1,6})?|180(?:\.0{1,6})?)$/;
const ZONED_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export class CreateFuelDto {
  @IsPositivePostgresBigint()
  movementId!: string;

  @IsUUID()
  operationId!: string;

  @Matches(NUMERIC_12_1)
  kilometers!: string;

  @IsDateString({ strict: true })
  @Matches(ZONED_TIMESTAMP)
  deviceAt!: string;

  @Matches(POSITIVE_NUMERIC_10_3)
  gallons!: string;

  @Matches(NUMERIC_12_2)
  pricePerGallon!: string;

  @Matches(NUMERIC_12_2)
  totalPaid!: string;

  @IsOptional()
  @IsPositivePostgresBigint()
  gasStationId?: string;

  @IsOptional()
  @Matches(LATITUDE)
  latitude?: string;

  @IsOptional()
  @Matches(LONGITUDE)
  longitude?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  manualPlaceName?: string;

  @IsOptional()
  @IsString()
  observations?: string;
}
