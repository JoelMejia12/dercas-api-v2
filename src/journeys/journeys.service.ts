import { Injectable, NotFoundException } from '@nestjs/common';
import { JourneyHistoryResult, JourneyRecord, JourneysRepository } from './journeys.repository';
import { JourneyHistoryQueryDto } from './journey-history-query.dto';

export interface JourneyHistoryPage {
  readonly items: JourneyHistoryResult['items'];
  readonly pagination: { readonly limit: number; readonly offset: number; readonly hasMore: boolean };
}

@Injectable()
export class JourneysService {
  constructor(private readonly journeys: JourneysRepository) {}

  async findHistoryForUser(userId: string, query: JourneyHistoryQueryDto): Promise<JourneyHistoryPage> {
    const result = await this.journeys.findHistoryForUser(userId, query);
    return { items: result.items, pagination: { limit: query.limit, offset: query.offset, hasMore: result.hasMore } };
  }

  async findByIdForUser(id: string, userId: string): Promise<JourneyRecord> {
    const journey = await this.journeys.findByIdForUser(id, userId);
    if (!journey) throw new NotFoundException();
    return journey;
  }

  findCurrentForUser(userId: string): Promise<JourneyRecord | null> {
    return this.journeys.findCurrentForUser(userId);
  }
}
