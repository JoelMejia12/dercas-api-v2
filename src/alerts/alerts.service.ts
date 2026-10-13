import { Injectable, NotFoundException } from '@nestjs/common';
import { AlertHistoryQueryDto } from './alerts.dto';
import { AlertNotificationRecord, AlertsRepository } from './alerts.repository';

@Injectable()
export class AlertsService {
  constructor(private readonly alerts: AlertsRepository) {}
  async findForUser(userId: string, includeAssignedVehicleAlerts: boolean, query: AlertHistoryQueryDto) {
    const page = await this.alerts.findForUser(userId, includeAssignedVehicleAlerts, query);
    return { items: page.items, pagination: { limit: query.limit, offset: query.offset, hasMore: page.hasMore } };
  }
  async findByIdForUser(id: string, userId: string, includeAssignedVehicleAlerts: boolean): Promise<AlertNotificationRecord> {
    const alert = await this.alerts.findByIdForUser(id, userId, includeAssignedVehicleAlerts);
    if (!alert) throw new NotFoundException();
    return alert;
  }
}
