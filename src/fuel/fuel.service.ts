import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateFuelInput, FuelChargeRecord, FuelHistoryItem, FuelIdempotencyConflictError, FuelMovementNotFoundError, FuelRepository } from './fuel.repository';

export interface FuelHistoryPage {
  readonly items: readonly FuelHistoryItem[];
  readonly pagination: { readonly limit: number; readonly offset: number; readonly hasMore: boolean };
}

@Injectable()
export class FuelService {
  constructor(private readonly fuel: FuelRepository) {}

  async findHistoryForUser(userId: string, limit: number, offset: number): Promise<FuelHistoryPage> {
    const rows = await this.fuel.findHistoryForUser(userId, { limit, offset });
    const hasMore = rows.length > limit;
    return {
      items: hasMore ? rows.slice(0, limit) : rows,
      pagination: { limit, offset, hasMore },
    };
  }

  async findByIdForUser(id: string, userId: string): Promise<FuelHistoryItem> {
    const item = await this.fuel.findByIdForUser(id, userId);
    if (!item) throw new NotFoundException();
    return item;
  }

  async create(input: CreateFuelInput): Promise<FuelChargeRecord> {
    try {
      return await this.fuel.create(input);
    } catch (error) {
      if (error instanceof FuelMovementNotFoundError) throw new NotFoundException();
      if (error instanceof FuelIdempotencyConflictError) throw new ConflictException();
      throw error;
    }
  }
}
