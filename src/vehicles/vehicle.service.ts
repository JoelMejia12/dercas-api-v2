import { Injectable, NotFoundException } from '@nestjs/common';
import { AdministrativeAvailableVehicle, AssignedVehicle, VehicleAssignmentHistoryItem, VehicleMaintenanceStatus, VehicleRepository } from './vehicle.repository';
import { VehiclePageQueryDto } from './vehicle-query.dto';

@Injectable()
export class VehicleService {
  constructor(private readonly vehicles: VehicleRepository) {}

  findCurrentUserVehicle(userId: string): Promise<AssignedVehicle | null> {
    return this.vehicles.findActiveAssignedToUser(userId);
  }

  async findAdministrativeAvailable(query: VehiclePageQueryDto) {
    const page = await this.vehicles.findAdministrativeAvailable(query);
    return { items: page.items, pagination: { limit: query.limit, offset: query.offset, hasMore: page.hasMore } };
  }

  async findAvailableAdministrativeVehicle(id: string): Promise<AdministrativeAvailableVehicle> {
    const vehicle = await this.vehicles.findAdministrativeAvailableById(id);
    if (!vehicle) throw new NotFoundException();
    return vehicle;
  }

  findMyAssignmentHistory(userId: string): Promise<readonly VehicleAssignmentHistoryItem[]> {
    return this.vehicles.findAssignmentHistoryForUser(userId);
  }

  findAssignedVehicleMaintenanceStatus(userId: string): Promise<readonly VehicleMaintenanceStatus[]> {
    return this.vehicles.findMaintenanceStatusForUser(userId);
  }
}
