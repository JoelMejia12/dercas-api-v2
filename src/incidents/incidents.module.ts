import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IncidentsController } from './incidents.controller';
import { IncidentsRepository } from './incidents.repository';
import { IncidentsService } from './incidents.service';

@Module({
  imports: [AuthModule],
  controllers: [IncidentsController],
  providers: [IncidentsRepository, IncidentsService],
  exports: [IncidentsRepository, IncidentsService],
})
export class IncidentsModule {}
