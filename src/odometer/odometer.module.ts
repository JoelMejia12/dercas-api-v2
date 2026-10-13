import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OdometerController } from './odometer.controller';
import { OdometerRepository } from './odometer.repository';
import { OdometerService } from './odometer.service';

@Module({
  imports: [AuthModule],
  controllers: [OdometerController],
  providers: [OdometerRepository, OdometerService],
  exports: [OdometerRepository, OdometerService],
})
export class OdometerModule {}
