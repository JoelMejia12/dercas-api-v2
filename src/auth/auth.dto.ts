import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { IsPositivePostgresBigint } from './bigint-id.validator';

export class LoginDto {
  @IsEmail() @MaxLength(180) email!: string;
  @IsString() @MinLength(1) @MaxLength(1024) password!: string;
  @IsString() @IsPositivePostgresBigint() deviceId!: string;
  @IsString() @MaxLength(512) deviceToken!: string;
}

export class RefreshDto {
  @IsString() @IsPositivePostgresBigint() sessionId!: string;
  @IsString() @MinLength(1) @MaxLength(512) refreshToken!: string;
}
