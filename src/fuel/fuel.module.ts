import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FuelController } from './fuel.controller';
import { FuelRepository } from './fuel.repository';
import { FuelService } from './fuel.service';

@Module({
  imports: [AuthModule],
  controllers: [FuelController],
  providers: [FuelRepository, FuelService],
  exports: [FuelRepository, FuelService],
})
export class FuelModule {}
