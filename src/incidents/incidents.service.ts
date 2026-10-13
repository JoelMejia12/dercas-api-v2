import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateIncidentInput,
  IncidentHistoryPageData,
  IncidentIdempotencyConflictError,
  IncidentRecord,
  IncidentsRepository,
  NoActiveAssignedVehicleError,
} from './incidents.repository';
import { IncidentHistoryQueryDto } from './incident-history-query.dto';

export interface IncidentHistoryPage {
  readonly items: IncidentHistoryPageData['rows'];
  readonly pagination: { readonly limit: number; readonly offset: number; readonly hasMore: boolean };
}

@Injectable()
export class IncidentsService {
  constructor(private readonly incidents: IncidentsRepository) {}

  async create(input: CreateIncidentInput): Promise<IncidentRecord> {
    try {
      return await this.incidents.create(input);
    } catch (error) {
      if (error instanceof NoActiveAssignedVehicleError) throw new NotFoundException();
      if (error instanceof IncidentIdempotencyConflictError) throw new ConflictException();
      throw error;
    }
  }

  async findByIdForUser(id: string, userId: string): Promise<IncidentRecord> {
    const incident = await this.incidents.findByIdForUser(id, userId);
    if (!incident) throw new NotFoundException();
    return incident;
  }

  async findHistoryForUser(userId: string, query: IncidentHistoryQueryDto): Promise<IncidentHistoryPage> {
    const result = await this.incidents.findHistoryForUser(userId, query);
    return {
      items: result.rows,
      pagination: { limit: query.limit, offset: query.offset, hasMore: result.hasMore },
    };
  }
}
