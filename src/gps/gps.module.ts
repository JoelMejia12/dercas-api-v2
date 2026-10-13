import { Module } from '@nestjs/common';
import { GpsPositionRepository } from './gps-position.repository';
import { AuthModule } from '../auth/auth.module';
import { GpsController } from './gps.controller';
import { GpsReadRepository } from './gps-read.repository';
import { GpsReadService } from './gps-read.service';

// No public ingestion or location query route is enabled until identity,
// device authorization, scopes, retention, and rate limits are approved.
@Module({ imports: [AuthModule], controllers: [GpsController], providers: [GpsPositionRepository, GpsReadRepository, GpsReadService], exports: [GpsPositionRepository, GpsReadRepository, GpsReadService] })
export class GpsModule {}
