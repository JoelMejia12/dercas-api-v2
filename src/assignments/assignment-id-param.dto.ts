import { IsPositivePostgresBigint } from '../auth/bigint-id.validator';

export class AssignmentIdParamDto {
  @IsPositivePostgresBigint()
  id!: string;
}
