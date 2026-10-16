import { ApiPropertyOptions, ApiPropertyOptional } from '@nestjs/swagger';

export function ApiPageLimit(defaultValue: number, maximum: number): PropertyDecorator {
  return ApiPropertyOptional({ type: 'integer', minimum: 1, maximum, default: defaultValue } satisfies ApiPropertyOptions);
}

export function ApiPageOffset(): PropertyDecorator {
  return ApiPropertyOptional({ type: 'integer', minimum: 0, maximum: 2_147_483_647, default: 0 });
}
