import 'reflect-metadata';
import { IsPositivePostgresBigint } from '../auth/bigint-id.validator';

export class JourneyIdParamDto {
  @IsPositivePostgresBigint()
  id!: string;
}
