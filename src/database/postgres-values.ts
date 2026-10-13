const POSTGRES_BIGINT_MAX = 9223372036854775807n;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class InvalidPostgresValueError extends TypeError {
  constructor(field: string) {
    super(`Invalid value for ${field}`);
    this.name = 'InvalidPostgresValueError';
  }
}

export function assertPositiveBigintIdentifier(value: string, field: string): void {
  if (typeof value !== 'string' || !/^[1-9]\d{0,18}$/.test(value) || BigInt(value) > POSTGRES_BIGINT_MAX) {
    throw new InvalidPostgresValueError(field);
  }
}

export function assertUuid(value: string, field: string): void {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new InvalidPostgresValueError(field);
}

export function assertRequiredFiniteRange(
  value: number,
  field: string,
  minimum: number,
  maximum: number,
  maximumExclusive = false,
): void {
  if (!Number.isFinite(value) || value < minimum || (maximumExclusive ? value >= maximum : value > maximum)) {
    throw new InvalidPostgresValueError(field);
  }
}

export function assertFiniteRange(
  value: number | undefined,
  field: string,
  minimum: number,
  maximum: number,
  maximumExclusive = false,
): void {
  if (value === undefined) return;
  assertRequiredFiniteRange(value, field, minimum, maximum, maximumExclusive);
}

export function assertNumericPrecision(value: number | undefined, field: string, precision: number, scale: number): void {
  if (value === undefined) return;
  const roundingBoundary = 10 ** (precision - scale) - 0.5 * 10 ** -scale;
  if (!Number.isFinite(value) || Math.abs(value) >= roundingBoundary) {
    throw new InvalidPostgresValueError(field);
  }
}

