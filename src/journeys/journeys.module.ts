import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JourneysController } from './journeys.controller';
import { JourneysRepository } from './journeys.repository';
import { JourneysService } from './journeys.service';

@Module({
  imports: [AuthModule],
  controllers: [JourneysController],
  providers: [JourneysRepository, JourneysService],
  exports: [JourneysRepository, JourneysService],
})
export class JourneysModule {}
