import { Injectable, NotFoundException } from '@nestjs/common';
import { OdometerHistoryQueryDto } from './odometer-history-query.dto';
import { OdometerHistoryItem, OdometerRepository } from './odometer.repository';

export interface OdometerHistoryPage {
  readonly items: readonly OdometerHistoryItem[];
  readonly pagination: { readonly limit: number; readonly offset: number; readonly hasMore: boolean };
}

@Injectable()
export class OdometerService {
  constructor(private readonly readings: OdometerRepository) {}

  async findHistoryForUser(userId: string, query: OdometerHistoryQueryDto): Promise<OdometerHistoryPage> {
    const result = await this.readings.findHistoryForUser(userId, query);
    return {
      items: result.items,
      pagination: { limit: query.limit, offset: query.offset, hasMore: result.hasMore },
    };
  }

  async findByIdForUser(id: string, userId: string): Promise<OdometerHistoryItem> {
    const item = await this.readings.findByIdForUser(id, userId);
    if (!item) throw new NotFoundException();
    return item;
  }
}
