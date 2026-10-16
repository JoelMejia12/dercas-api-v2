import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsPositivePostgresBigint } from './bigint-id.validator';

export class LoginDto {
  @ApiProperty({ format: 'email', example: 'piloto@example.invalid' })
  @IsEmail() @MaxLength(180) email!: string;
  @ApiProperty({ format: 'password', minLength: 1, maxLength: 1024, writeOnly: true })
  @IsString() @MinLength(1) @MaxLength(1024) password!: string;
  @ApiProperty({ type: String, example: '1', description: 'Identificador BIGINT como cadena decimal.' })
  @IsString() @IsPositivePostgresBigint() deviceId!: string;
  @ApiProperty({ maxLength: 512, writeOnly: true })
  @IsString() @MaxLength(512) deviceToken!: string;
}

export class RefreshDto {
  @ApiProperty({ type: String, example: '1', description: 'Identificador BIGINT como cadena decimal.' })
  @IsString() @IsPositivePostgresBigint() sessionId!: string;
  @ApiProperty({ maxLength: 512, writeOnly: true })
  @IsString() @MinLength(1) @MaxLength(512) refreshToken!: string;
}

export class TokenPairDto {
  @ApiProperty({ description: 'Bearer access token.' }) accessToken!: string;
  @ApiProperty({ description: 'Opaque refresh token. Store securely.' }) refreshToken!: string;
  @ApiProperty({ enum: ['Bearer'] }) tokenType!: 'Bearer';
  @ApiProperty({ type: Number, example: 900 }) expiresIn!: number;
  @ApiProperty({ type: String, description: 'Identificador BIGINT como cadena decimal.' }) sessionId!: string;
}
