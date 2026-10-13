import { Injectable } from '@nestjs/common';
import { AvailableAdministrativeVehicle, LoanReadItem, LoanReadRepository } from './loan-read.repository';

export interface LoanHistoryPage {
  readonly items: readonly LoanReadItem[];
  readonly pagination: { readonly limit: number; readonly offset: number; readonly hasMore: boolean };
}
export interface AvailableAdministrativeVehiclePage {
  readonly items: readonly AvailableAdministrativeVehicle[];
  readonly pagination: { readonly limit: number; readonly offset: number; readonly hasMore: boolean };
}

@Injectable()
export class LoanReadService {
  constructor(private readonly loans: LoanReadRepository) {}

  findActiveForUser(userId: string): Promise<readonly LoanReadItem[]> {
    return this.loans.findActiveForUser(userId);
  }

  async findHistoryForUser(userId: string, limit: number, offset: number): Promise<LoanHistoryPage> {
    const rows = await this.loans.findHistoryForUser(userId, { limit, offset });
    const hasMore = rows.length > limit;
    return { items: hasMore ? rows.slice(0, limit) : rows, pagination: { limit, offset, hasMore } };
  }

  async findAvailableAdministrativeVehicles(limit: number, offset: number): Promise<AvailableAdministrativeVehiclePage> {
    const result = await this.loans.findAvailableAdministrativeVehicles({ limit, offset });
    return { items: result.items, pagination: { limit, offset, hasMore: result.hasMore } };
  }
}
