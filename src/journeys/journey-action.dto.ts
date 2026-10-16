import 'reflect-metadata';
import { IsDateString, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class JourneyActionDto {
  @IsUUID()
  operationId!: string;

  @IsString()
  @Matches(/^\d{1,11}(?:\.\d)?$/)
  kilometers!: string;

  @IsDateString({ strict: true })
  deviceAt!: string;

  @IsOptional()
  @IsString()
  observations?: string;
}
