import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateLoanRequestDto } from './create-loan-request.dto';

describe('CreateLoanRequestDto', () => {
  it('accepts a positive BIGINT string, UUID and optional text fields', async () => {
    const dto = plainToInstance(CreateLoanRequestDto, {
      vehicleId: '9223372036854775807',
      operationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      destination: 'Bodega', reason: 'Traslado',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it.each([
    { vehicleId: '0', operationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    { vehicleId: '9223372036854775808', operationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    { vehicleId: '9', operationId: 'bad-uuid' },
    { vehicleId: '9', operationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', destination: 7 },
  ])('rejects invalid request identifiers and field types %#', async (value) => {
    expect(await validate(plainToInstance(CreateLoanRequestDto, value))).not.toHaveLength(0);
  });
});
