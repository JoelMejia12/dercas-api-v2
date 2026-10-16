import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateJourneyInput,
  FinishJourneyInput,
  JourneyConflictError,
  JourneyHistoryResult,
  JourneyIdempotencyConflictError,
  JourneyNoActiveAssignmentError,
  JourneyRecord,
  JourneysRepository,
} from './journeys.repository';
import { JourneyHistoryQueryDto } from './journey-history-query.dto';

export interface JourneyHistoryPage {
  readonly items: JourneyHistoryResult['items'];
  readonly pagination: { readonly limit: number; readonly offset: number; readonly hasMore: boolean };
}

@Injectable()
export class JourneysService {
  constructor(private readonly journeys: JourneysRepository) {}

  async start(input: CreateJourneyInput): Promise<JourneyRecord> {
    try {
      return await this.journeys.start(input);
    } catch (error) {
      if (error instanceof JourneyNoActiveAssignmentError) throw new NotFoundException();
      if (error instanceof JourneyConflictError || error instanceof JourneyIdempotencyConflictError) throw new ConflictException();
      throw error;
    }
  }

  async finish(input: FinishJourneyInput): Promise<JourneyRecord> {
    try {
      return await this.journeys.finish(input);
    } catch (error) {
      if (error instanceof JourneyNoActiveAssignmentError) throw new NotFoundException();
      if (error instanceof JourneyConflictError || error instanceof JourneyIdempotencyConflictError) throw new ConflictException();
      throw error;
    }
  }

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
