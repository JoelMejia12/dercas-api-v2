import { Injectable, NotFoundException } from '@nestjs/common';
import { ActiveAssignment, AssignmentItem, AssignmentRepository } from './assignment.repository';
export interface AssignmentHistoryPage {
  readonly items: readonly AssignmentItem[];
  readonly pagination: { readonly limit: number; readonly offset: number; readonly hasMore: boolean };
}

@Injectable()
export class AssignmentService {
  constructor(private readonly assignments: AssignmentRepository) {}

  findCurrentForAuthenticatedPilot(pilotId: string): Promise<ActiveAssignment | null> {
    return this.assignments.findActiveForPilot(pilotId);
  }

  async findHistoryForAuthenticatedPilot(pilotId: string, limit: number, offset: number): Promise<AssignmentHistoryPage> {
    const result = await this.assignments.findHistoryForPilot(pilotId, limit, offset);
    return { items: result.items, pagination: { limit, offset, hasMore: result.hasMore } };
  }

  async findByIdForAuthenticatedPilot(id: string, pilotId: string): Promise<AssignmentItem> {
    const assignment = await this.assignments.findByIdForPilot(id, pilotId);
    if (!assignment) throw new NotFoundException();
    return assignment;
  }
}
