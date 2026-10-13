import { IsOptional, IsString, IsUUID } from 'class-validator';
import { IsPositivePostgresBigint } from '../auth/bigint-id.validator';

export class CreateLoanRequestDto {
  @IsPositivePostgresBigint()
  vehicleId!: string;

  @IsUUID()
  operationId!: string;

  @IsOptional()
  @IsString()
  destination?: string | null;

  @IsOptional()
  @IsString()
  reason?: string | null;
}
