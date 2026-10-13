import { IsPositivePostgresBigint } from '../auth/bigint-id.validator';

export class LoanIdParamDto {
  @IsPositivePostgresBigint()
  id!: string;
}
