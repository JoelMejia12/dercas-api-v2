import { Injectable, NotFoundException } from '@nestjs/common';
import { MovementHistoryQueryDto } from './movement-query.dto';
import { MovementItem, MovementPageData, MovementScope, MovementsRepository } from './movements.repository';

@Injectable()
export class MovementsService {
  constructor(private readonly movements: MovementsRepository) {}
  async findHistory(userId: string, scope: MovementScope, query: MovementHistoryQueryDto): Promise<MovementPageData & { readonly pagination: { readonly limit: number; readonly offset: number; readonly hasMore: boolean } }> {
    const result = await this.movements.findHistory(userId, scope, query);
    return { ...result, pagination: { limit: query.limit, offset: query.offset, hasMore: result.hasMore } };
  }
  async findOpen(userId: string, scope: MovementScope): Promise<MovementItem> {
    const movement = await this.movements.findOpen(userId, scope);
    if (!movement) throw new NotFoundException();
    return movement;
  }
  async findById(userId: string, id: string, scope: MovementScope): Promise<MovementItem> {
    const movement = await this.movements.findById(userId, id, scope);
    if (!movement) throw new NotFoundException();
    return movement;
  }
}
