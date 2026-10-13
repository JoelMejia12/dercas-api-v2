import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

const MAX_POSTGRES_BIGINT = 9_223_372_036_854_775_807n;
export function IsPositivePostgresBigint(options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => registerDecorator({
    name: 'isPositivePostgresBigint', target: target.constructor, propertyName: String(propertyKey), options,
    validator: {
      validate(value: unknown): boolean {
        if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return false;
        try { const parsed = BigInt(value); return parsed > 0n && parsed <= MAX_POSTGRES_BIGINT; } catch { return false; }
      },
      defaultMessage(args: ValidationArguments): string { return `${args.property} must be a positive PostgreSQL BIGINT`; },
    },
  });
}
