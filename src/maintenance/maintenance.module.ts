import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceRepository } from './maintenance.repository';
import { MaintenanceService } from './maintenance.service';

@Module({
  imports: [AuthModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceRepository, MaintenanceService],
  exports: [MaintenanceRepository, MaintenanceService],
})
export class MaintenanceModule {}
