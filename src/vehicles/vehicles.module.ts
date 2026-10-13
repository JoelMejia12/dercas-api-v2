import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VehicleRepository } from './vehicle.repository';
import { VehicleService } from './vehicle.service';
import { VehiclesController } from './vehicles.controller';

@Module({
  imports: [AuthModule],
  controllers: [VehiclesController],
  providers: [VehicleRepository, VehicleService],
  exports: [VehicleRepository, VehicleService],
})
export class VehiclesModule {}
