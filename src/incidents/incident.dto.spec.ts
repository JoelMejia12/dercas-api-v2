import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateEmergencyDto, CreateIncidentDto, REPORTABLE_INCIDENT_TYPES } from './incident.dto';

describe('CreateIncidentDto', () => {
  it('accepts reportable incident types, trims description, and requires an operation UUID', async () => {
    const dto = plainToInstance(CreateIncidentDto, {
      type: 'FALLA_VEHICULO', description: '  Falla en frenos  ',
      operationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    expect(dto.description).toBe('Falla en frenos');
    expect(await validate(dto)).toHaveLength(0);
  });

  it('does not accept PANICO through the generic incident endpoint', async () => {
    const dto = plainToInstance(CreateIncidentDto, {
      type: 'PANICO', description: 'Emergencia', operationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    expect(REPORTABLE_INCIDENT_TYPES as readonly string[]).not.toContain('PANICO');
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('rejects blank descriptions and invalid operation identifiers', async () => {
    const dto = plainToInstance(CreateIncidentDto, { type: 'OTRO', description: '  ', operationId: 'bad' });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('validates emergency coordinates within the SQL numeric ranges and allows absent location', async () => {
    const valid = plainToInstance(CreateEmergencyDto, { description: 'Pánico', operationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', latitude: '90', longitude: '-180' });
    expect(await validate(valid)).toHaveLength(0);
    const validNoLocation = plainToInstance(CreateEmergencyDto, { description: 'Pánico', operationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    expect(await validate(validNoLocation)).toHaveLength(0);
    const invalid = plainToInstance(CreateEmergencyDto, { description: 'Pánico', operationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', latitude: '90.000001', longitude: '1.1234567' });
    expect(await validate(invalid)).not.toHaveLength(0);
  });
});
