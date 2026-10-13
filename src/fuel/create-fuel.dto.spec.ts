import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { CreateFuelDto } from './create-fuel.dto';

describe('CreateFuelDto', () => {
  it('accepts schema-precision decimals and a zoned device timestamp', async () => {
    const dto = Object.assign(new CreateFuelDto(), {
      movementId: '9', operationId: '11111111-1111-4111-8111-111111111111', kilometers: '12345.6',
      deviceAt: '2026-05-01T11:59:00-06:00', gallons: '8.250', pricePerGallon: '31.75', totalPaid: '261.94',
      latitude: '14.6349', longitude: '-90.5069',
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects values outside SQL precision, nonpositive gallons, invalid coordinates, and local timestamps', async () => {
    const dto = Object.assign(new CreateFuelDto(), {
      movementId: '9', operationId: '11111111-1111-4111-8111-111111111111', kilometers: '12345.67',
      deviceAt: '2026-05-01T11:59:00', gallons: '0.000', pricePerGallon: '12345678901.00', totalPaid: '1.00',
      latitude: '91', longitude: '-90.5069',
    });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
});
