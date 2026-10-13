import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActiveBlockingMaintenanceOrderError,
  CreateMaintenanceOrderInput,
  MaintenanceAlertRecord,
  MaintenanceOrderPageData,
  MaintenanceOrderRecord,
  MaintenancePlanStatus,
  MaintenanceRepository,
  NoAssignedVehicleForMaintenanceError,
} from './maintenance.repository';
import { MaintenanceOrderHistoryQueryDto } from './maintenance.dto';

export interface MaintenanceOrderPage {
  readonly items: MaintenanceOrderPageData['items'];
  readonly pagination: { readonly limit: number; readonly offset: number; readonly hasMore: boolean };
}

@Injectable()
export class MaintenanceService {
  constructor(private readonly maintenance: MaintenanceRepository) {}

  async findOrdersForCurrentVehicle(userId: string, query: MaintenanceOrderHistoryQueryDto): Promise<MaintenanceOrderPage> {
    const result = await this.maintenance.findOrdersForCurrentVehicle(userId, query);
    return { items: result.items, pagination: { limit: query.limit, offset: query.offset, hasMore: result.hasMore } };
  }

  async findOrderByIdForCurrentVehicle(id: string, userId: string): Promise<MaintenanceOrderRecord> {
    const order = await this.maintenance.findOrderByIdForCurrentVehicle(id, userId);
    if (!order) throw new NotFoundException();
    return order;
  }

  findPlansForCurrentVehicle(userId: string): Promise<readonly MaintenancePlanStatus[]> {
    return this.maintenance.findPlansForCurrentVehicle(userId);
  }

  findAlertsForCurrentVehicle(userId: string): Promise<readonly MaintenanceAlertRecord[]> {
    return this.maintenance.findAlertsForCurrentVehicle(userId);
  }

  async createOrder(input: CreateMaintenanceOrderInput): Promise<MaintenanceOrderRecord> {
    try {
      return await this.maintenance.createOrder(input);
    } catch (error) {
      if (error instanceof NoAssignedVehicleForMaintenanceError) throw new NotFoundException();
      if (error instanceof ActiveBlockingMaintenanceOrderError) throw new ConflictException();
      throw error;
    }
  }
}
