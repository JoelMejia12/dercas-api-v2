import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { CommonModule } from './common/common.module';
import { DatabaseModule } from './database/database.module';
import { FuelModule } from './fuel/fuel.module';
import { CabinetModule } from './cabinet/cabinet.module';
import { EvidenceModule } from './evidence/evidence.module';
import { GpsModule } from './gps/gps.module';
import { HealthModule } from './health/health.module';
import { IncidentsModule } from './incidents/incidents.module';
import { JourneysModule } from './journeys/journeys.module';
import { LoansModule } from './loans/loans.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { OdometerModule } from './odometer/odometer.module';
import { ReportsModule } from './reports/reports.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { UsersModule } from './users/users.module';
import { AlertsModule } from './alerts/alerts.module';
import { MovementsModule } from './movements/movements.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    CommonModule,
    DatabaseModule,
    HealthModule,
    AuthModule,
    AssignmentsModule,
    VehiclesModule,
    LoansModule,
    CabinetModule,
    JourneysModule,
    FuelModule,
    MaintenanceModule,
    OdometerModule,
    IncidentsModule,
    EvidenceModule,
    ReportsModule,
    GpsModule,
    UsersModule,
    AlertsModule,
    MovementsModule,
    NotificationsModule,
  ],
})
export class AppModule {}
