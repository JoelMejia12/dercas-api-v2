import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface ReadinessStatus {
  readonly status: 'ready' | 'not_ready';
  readonly checks: {
    readonly process: 'up';
    readonly database: 'up' | 'not_configured' | 'unavailable';
  };
}

@Injectable()
export class HealthService {
  constructor(private readonly database: DatabaseService) {}

  live(): { readonly status: 'alive' } {
    return { status: 'alive' };
  }

  async readiness(): Promise<ReadinessStatus> {
    if (!this.database.isConfigured) {
      return { status: 'not_ready', checks: { process: 'up', database: 'not_configured' } };
    }
    const available = await this.database.checkAvailability();
    return {
      status: available ? 'ready' : 'not_ready',
      checks: { process: 'up', database: available ? 'up' : 'unavailable' },
    };
  }
}
