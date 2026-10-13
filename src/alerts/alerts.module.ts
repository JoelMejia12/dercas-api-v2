import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AlertsController } from './alerts.controller';
import { AlertsRepository } from './alerts.repository';
import { AlertsService } from './alerts.service';

@Module({ imports: [AuthModule], controllers: [AlertsController], providers: [AlertsRepository, AlertsService], exports: [AlertsRepository, AlertsService] })
export class AlertsModule {}
