import { ApiProperty } from '@nestjs/swagger';

export class PageResponse<T> {
  @ApiProperty({ type: 'array', items: { type: 'object' } }) items!: readonly T[];
  @ApiProperty() hasMore!: boolean;
}

export class UserProfileResponse {
  @ApiProperty() id!: string;
  @ApiProperty({ nullable: true }) employeeCode!: string | null;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ nullable: true }) title!: string | null;
  @ApiProperty({ nullable: true }) department!: string | null;
  @ApiProperty({ nullable: true }) phone!: string | null;
  @ApiProperty({ nullable: true }) profilePhotoUrl!: string | null;
  @ApiProperty() active!: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class EffectiveRoleResponse {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
}

export class EffectivePermissionResponse {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
}

export class UserAccessResponse {
  @ApiProperty({ type: [EffectiveRoleResponse] }) roles!: EffectiveRoleResponse[];
  @ApiProperty({ type: [EffectivePermissionResponse] }) permissions!: EffectivePermissionResponse[];
}

export class CabinetResponse {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true }) location!: string | null;
  @ApiProperty() state!: string;
  @ApiProperty({ nullable: true, format: 'date-time' }) lastConnectionAt!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class CabinetPositionResponse {
  @ApiProperty() id!: string;
  @ApiProperty() cabinetId!: string;
  @ApiProperty() number!: number;
  @ApiProperty() state!: string;
  @ApiProperty({ nullable: true, format: 'date-time' }) lastReadAt!: string | null;
  @ApiProperty({ nullable: true, type: 'object', properties: {
    id: { type: 'string' }, state: { type: 'string' }, active: { type: 'boolean' },
    vehicle: { type: 'object', properties: { id: { type: 'string' }, plate: { type: 'string' }, make: { type: 'string' }, model: { type: 'string', nullable: true }, operationalState: { type: 'string' } }, required: ['id', 'plate', 'make', 'model', 'operationalState'] },
  } })
  keyring!: { id: string; state: string; active: boolean; vehicle: { id: string; plate: string; make: string; model: string | null; operationalState: string } } | null;
}

export class CabinetKeyringResponse {
  @ApiProperty() id!: string;
  @ApiProperty() vehicleId!: string;
  @ApiProperty() chipUid!: string;
  @ApiProperty() state!: string;
  @ApiProperty() active!: boolean;
  @ApiProperty({ type: 'object', properties: { plate: { type: 'string' }, make: { type: 'string' }, model: { type: 'string', nullable: true }, operationalState: { type: 'string' } } })
  vehicle!: { plate: string; make: string; model: string | null; operationalState: string };
  @ApiProperty({ nullable: true, type: 'object', properties: { id: { type: 'string' }, cabinetId: { type: 'string' }, number: { type: 'integer' }, state: { type: 'string' } } })
  position!: { id: string; cabinetId: string; number: number; state: string } | null;
}

export class CabinetEventResponse {
  @ApiProperty() id!: string;
  @ApiProperty() cabinetId!: string;
  @ApiProperty({ nullable: true }) positionId!: string | null;
  @ApiProperty({ nullable: true }) keyringId!: string | null;
  @ApiProperty({ nullable: true }) vehicleId!: string | null;
  @ApiProperty({ nullable: true }) userId!: string | null;
  @ApiProperty({ nullable: true }) loanId!: string | null;
  @ApiProperty() type!: string;
  @ApiProperty({ format: 'date-time' }) occurredAt!: string;
  @ApiProperty({ nullable: true }) chipRead!: string | null;
  @ApiProperty() result!: boolean;
  @ApiProperty({ nullable: true, type: 'object', additionalProperties: true }) detail!: unknown | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class VehicleSummaryResponse {
  @ApiProperty() id!: string;
  @ApiProperty() plate!: string;
  @ApiProperty() make!: string;
  @ApiProperty({ nullable: true }) model!: string | null;
  @ApiProperty({ enum: ['ADMINISTRATIVO', 'BRIGADA'] }) kind!: string;
  @ApiProperty({ enum: ['DISPONIBLE', 'MANTENIMIENTO', 'FUERA_SERVICIO', 'BLOQUEADO'] }) operationalState!: string;
}

export class AssignedVehicleResponse {
  @ApiProperty() id!: string;
  @ApiProperty() plate!: string;
  @ApiProperty() make!: string;
  @ApiProperty({ nullable: true }) model!: string | null;
  @ApiProperty({ enum: ['ADMINISTRATIVO', 'BRIGADA'] }) kind!: string;
  @ApiProperty({ enum: ['DISPONIBLE', 'MANTENIMIENTO', 'FUERA_SERVICIO', 'BLOQUEADO'] }) operationalState!: string;
  @ApiProperty({ nullable: true, type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } }) brigade!: { id: string; name: string } | null;
  @ApiProperty({ type: 'object', properties: { id: { type: 'string' }, startedAt: { type: 'string', format: 'date-time' } } }) assignment!: { id: string; startedAt: string };
  @ApiProperty({ nullable: true, type: 'object', properties: { value: { type: 'string' }, recordedAt: { type: 'string', format: 'date-time' } } }) odometer!: { value: string; recordedAt: string } | null;
}

export class VehicleAssignmentHistoryResponse {
  @ApiProperty() id!: string;
  @ApiProperty({ type: 'object', required: ['id', 'plate', 'make', 'model', 'kind', 'brigade'], properties: { id: { type: 'string' }, plate: { type: 'string' }, make: { type: 'string' }, model: { type: 'string', nullable: true }, kind: { type: 'string' }, brigade: { type: 'object', nullable: true, required: ['id', 'name'], properties: { id: { type: 'string' }, name: { type: 'string' } } } } }) vehicle!: Record<string, unknown>;
  @ApiProperty() state!: string;
  @ApiProperty({ format: 'date-time' }) startedAt!: string;
  @ApiProperty({ nullable: true, format: 'date-time' }) endedAt!: string | null;
  @ApiProperty({ nullable: true }) observations!: string | null;
}

export class VehicleMaintenanceStatusResponse {
  @ApiProperty() planId!: string;
  @ApiProperty() vehicleId!: string;
  @ApiProperty() plate!: string;
  @ApiProperty() maintenanceTypeId!: string;
  @ApiProperty() maintenance!: string;
  @ApiProperty({ nullable: true }) currentKilometers!: string | null;
  @ApiProperty({ nullable: true }) lastServiceKilometers!: string | null;
  @ApiProperty({ nullable: true }) intervalKilometers!: string | null;
  @ApiProperty({ nullable: true }) nextKilometers!: string | null;
  @ApiProperty({ nullable: true }) kilometersRemaining!: string | null;
  @ApiProperty() kilometerState!: string;
}

export class LoanReadResponse {
  @ApiProperty() id!: string; @ApiProperty() status!: string;
  @ApiProperty({ format: 'date-time' }) requestedAt!: string;
  @ApiProperty({ nullable: true, format: 'date-time' }) keyWithdrawnAt!: string | null;
  @ApiProperty({ nullable: true, format: 'date-time' }) useStartedAt!: string | null;
  @ApiProperty({ nullable: true, format: 'date-time' }) useEndedAt!: string | null;
  @ApiProperty({ nullable: true, format: 'date-time' }) keyReturnedAt!: string | null;
  @ApiProperty({ nullable: true }) destination!: string | null; @ApiProperty({ nullable: true }) reason!: string | null;
  @ApiProperty({ nullable: true }) returnObservations!: string | null;
  @ApiProperty({ type: 'object', required: ['id', 'plate', 'make', 'model', 'kind', 'operationalState'], properties: { id: { type: 'string' }, plate: { type: 'string' }, make: { type: 'string' }, model: { type: 'string', nullable: true }, kind: { type: 'string' }, operationalState: { type: 'string' } } }) vehicle!: Record<string, unknown>;
  @ApiProperty({ nullable: true, type: 'object', required: ['id', 'state', 'startedAt', 'endedAt', 'initialOdometer', 'finalOdometer'], properties: {
    id: { type: 'string' }, state: { type: 'string' }, startedAt: { type: 'string', format: 'date-time' }, endedAt: { type: 'string', format: 'date-time', nullable: true },
    initialOdometer: { type: 'object', nullable: true, required: ['id', 'value', 'type', 'recordedAt'], properties: { id: { type: 'string' }, value: { type: 'string' }, type: { type: 'string' }, recordedAt: { type: 'string', format: 'date-time' } } },
    finalOdometer: { type: 'object', nullable: true, required: ['id', 'value', 'type', 'recordedAt'], properties: { id: { type: 'string' }, value: { type: 'string' }, type: { type: 'string' }, recordedAt: { type: 'string', format: 'date-time' } } },
  } }) movement!: Record<string, unknown> | null;
}

export class MaintenancePlanResponse {
  @ApiProperty() planId!: string; @ApiProperty() vehicleId!: string; @ApiProperty() plate!: string;
  @ApiProperty() maintenanceTypeId!: string; @ApiProperty() maintenanceName!: string;
  @ApiProperty({ nullable: true }) currentKilometers!: string | null;
  @ApiProperty({ nullable: true }) lastServiceKilometers!: string | null;
  @ApiProperty({ nullable: true }) intervalKilometers!: string | null;
  @ApiProperty({ nullable: true }) nextKilometers!: string | null;
  @ApiProperty({ nullable: true }) kilometersRemaining!: string | null; @ApiProperty() kilometerStatus!: string;
}

export class MaintenanceAlertResponse {
  @ApiProperty() id!: string; @ApiProperty() type!: string; @ApiProperty() priority!: string;
  @ApiProperty() title!: string; @ApiProperty() message!: string; @ApiProperty() state!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ nullable: true, format: 'date-time' }) resolvedAt!: string | null;
}

export class AlertResponse {
  @ApiProperty({ nullable: true }) notificationId!: string | null; @ApiProperty() alertId!: string;
  @ApiProperty({ nullable: true }) channel!: string | null; @ApiProperty({ nullable: true }) notificationState!: string | null;
  @ApiProperty({ nullable: true, format: 'date-time' }) sentAt!: string | null;
  @ApiProperty({ nullable: true, format: 'date-time' }) deliveredAt!: string | null;
  @ApiProperty({ nullable: true, format: 'date-time' }) readAt!: string | null;
  @ApiProperty({ nullable: true, format: 'date-time' }) notificationCreatedAt!: string | null;
  @ApiProperty() type!: string; @ApiProperty() priority!: string; @ApiProperty({ nullable: true }) vehicleId!: string | null;
  @ApiProperty() title!: string; @ApiProperty() message!: string; @ApiProperty() alertState!: string;
  @ApiProperty({ format: 'date-time' }) alertCreatedAt!: string;
  @ApiProperty({ nullable: true, format: 'date-time' }) resolvedAt!: string | null;
}

export class NotificationResponse {
  @ApiProperty() id!: string; @ApiProperty() channel!: string; @ApiProperty() state!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ nullable: true, format: 'date-time' }) sentAt!: string | null;
  @ApiProperty({ nullable: true, format: 'date-time' }) deliveredAt!: string | null;
  @ApiProperty({ nullable: true, format: 'date-time' }) readAt!: string | null;
  @ApiProperty({ type: 'object', required: ['id', 'type', 'priority', 'title', 'message', 'state', 'vehicleId', 'createdAt', 'resolvedAt'], properties: {
    id: { type: 'string' }, type: { type: 'string' }, priority: { type: 'string' }, title: { type: 'string' }, message: { type: 'string' }, state: { type: 'string' },
    vehicleId: { type: 'string', nullable: true }, createdAt: { type: 'string', format: 'date-time' }, resolvedAt: { type: 'string', format: 'date-time', nullable: true },
  } }) alert!: Record<string, unknown>;
}

export class GpsPointResponse {
  @ApiProperty() id!: string; @ApiProperty({ nullable: true }) sessionId!: string | null;
  @ApiProperty({ required: false }) restorationId?: string; @ApiProperty() deviceId!: string;
  @ApiProperty({ nullable: true }) vehicleId!: string | null; @ApiProperty({ nullable: true }) movementId!: string | null;
  @ApiProperty() latitude!: number; @ApiProperty() longitude!: number;
  @ApiProperty({ nullable: true }) accuracyMeters!: string | null; @ApiProperty({ nullable: true }) speedKmh!: string | null;
  @ApiProperty({ nullable: true }) headingDegrees!: string | null; @ApiProperty({ nullable: true }) altitudeMeters!: string | null;
  @ApiProperty({ nullable: true }) batteryPercentage!: number | null;
  @ApiProperty({ format: 'date-time' }) capturedAt!: string; @ApiProperty({ format: 'date-time' }) receivedAt!: string;
}

export class GpsSessionResponse {
  @ApiProperty() id!: string; @ApiProperty() deviceId!: string;
  @ApiProperty({ nullable: true }) vehicleId!: string | null; @ApiProperty({ nullable: true }) movementId!: string | null;
  @ApiProperty() state!: string; @ApiProperty({ format: 'date-time' }) startedAt!: string;
  @ApiProperty({ nullable: true, format: 'date-time' }) endedAt!: string | null; @ApiProperty({ nullable: true }) reason!: string | null;
  @ApiProperty({ type: 'object', properties: { id: { type: 'string' }, code: { type: 'string' }, name: { type: 'string' }, mode: { type: 'string' } } }) profile!: Record<string, string>;
}

export class GpsRestorationResponse {
  @ApiProperty() id!: string; @ApiProperty() archiveId!: string;
  @ApiProperty({ nullable: true }) userFilterId!: string | null; @ApiProperty({ nullable: true }) vehicleFilterId!: string | null;
  @ApiProperty({ nullable: true }) deviceFilterId!: string | null;
  @ApiProperty({ format: 'date-time' }) from!: string; @ApiProperty({ format: 'date-time' }) to!: string;
  @ApiProperty() state!: string; @ApiProperty() recordCount!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string; @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ nullable: true, format: 'date-time' }) completedAt!: string | null;
}

export class GpsArchiveResponse {
  @ApiProperty() id!: string; @ApiProperty({ format: 'date-time' }) periodStart!: string;
  @ApiProperty({ format: 'date-time' }) periodEnd!: string; @ApiProperty() format!: string;
  @ApiProperty() recordCount!: string; @ApiProperty({ nullable: true }) deviceCount!: number | null;
  @ApiProperty({ nullable: true }) userCount!: number | null; @ApiProperty({ nullable: true }) vehicleCount!: number | null;
  @ApiProperty({ nullable: true }) sizeBytes!: string | null; @ApiProperty({ nullable: true }) sha256!: string | null;
  @ApiProperty() state!: string; @ApiProperty({ format: 'date-time' }) generatedAt!: string;
  @ApiProperty({ nullable: true, format: 'date-time' }) verifiedAt!: string | null;
  @ApiProperty({ nullable: true, format: 'date-time' }) copiedExternallyAt!: string | null;
  @ApiProperty({ nullable: true, format: 'date-time' }) purgedAt!: string | null;
}

export class GpsProfileResponse {
  @ApiProperty() id!: string; @ApiProperty() code!: string; @ApiProperty() name!: string; @ApiProperty() mode!: string;
  @ApiProperty() movementIntervalSeconds!: number; @ApiProperty() slowIntervalSeconds!: number;
  @ApiProperty() stoppedIntervalSeconds!: number; @ApiProperty() prolongedStopIntervalSeconds!: number;
  @ApiProperty() prolongedStopAfterSeconds!: number; @ApiProperty() heartbeatIntervalSeconds!: number;
  @ApiProperty() minimumDistanceMeters!: string; @ApiProperty() movementSpeedKmh!: string; @ApiProperty() active!: boolean;
}

export class GpsConfigurationResponse {
  @ApiProperty() id!: number; @ApiProperty() onlineRetentionMonths!: number; @ApiProperty() monthsToKeepAfterPurge!: number;
  @ApiProperty() heartbeatRetentionDays!: number; @ApiProperty() temporaryRestorationHours!: number;
  @ApiProperty() externalBackupRequiredBeforePurge!: boolean; @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class GpsRetentionResponse {
  @ApiProperty({ nullable: true }) oldestMonth!: string | null; @ApiProperty({ nullable: true }) newestMonth!: string | null;
  @ApiProperty() onlineRecords!: string; @ApiProperty() onlineMonths!: number; @ApiProperty() retentionMonths!: number;
  @ApiProperty() monthsToKeepAfterPurge!: number; @ApiProperty() archiveRequired!: boolean;
  @ApiProperty({ nullable: true }) keepFromMonth!: string | null;
}

export class GpsRealtimeVehicleResponse {
  @ApiProperty() vehicleId!: string; @ApiProperty() plate!: string; @ApiProperty() make!: string;
  @ApiProperty({ nullable: true }) model!: string | null; @ApiProperty() deviceId!: string;
  @ApiProperty() latitude!: number; @ApiProperty() longitude!: number;
  @ApiProperty({ nullable: true }) accuracyMeters!: string | null; @ApiProperty({ nullable: true }) speedKmh!: string | null;
  @ApiProperty({ nullable: true }) headingDegrees!: string | null; @ApiProperty({ nullable: true }) batteryPercentage!: number | null;
  @ApiProperty({ format: 'date-time' }) capturedAt!: string; @ApiProperty({ format: 'date-time' }) receivedAt!: string;
  @ApiProperty() deviceState!: string; @ApiProperty({ nullable: true, format: 'date-time' }) lastHeartbeatAt!: string | null;
  @ApiProperty() connectivityCalculatedBySchema!: string;
}

export class GpsManagedDeviceResponse {
  @ApiProperty() id!: string; @ApiProperty({ nullable: true }) associatedUserId!: string | null;
  @ApiProperty() active!: boolean; @ApiProperty() state!: string; @ApiProperty() platform!: string;
  @ApiProperty({ nullable: true }) manufacturer!: string | null; @ApiProperty({ nullable: true }) model!: string | null;
  @ApiProperty({ nullable: true }) appVersion!: string | null; @ApiProperty({ nullable: true }) gpsEnabled!: boolean | null;
  @ApiProperty() trackingEnabled!: boolean; @ApiProperty({ nullable: true }) batteryPercentage!: number | null;
  @ApiProperty({ nullable: true, format: 'date-time' }) lastHeartbeatAt!: string | null;
  @ApiProperty({ nullable: true, format: 'date-time' }) latestPositionAt!: string | null;
}

export class ActiveAssignmentResponse {
  @ApiProperty() id!: string; @ApiProperty({ enum: ['ACTIVA'] }) state!: string;
  @ApiProperty({ format: 'date-time' }) startedAt!: string;
  @ApiProperty({ nullable: true, format: 'date-time' }) endsAt!: string | null;
  @ApiProperty({ type: 'object', required: ['id', 'plate', 'make', 'model', 'kind', 'operationalState', 'brigade'], properties: {
    id: { type: 'string' }, plate: { type: 'string' }, make: { type: 'string' }, model: { type: 'string', nullable: true }, kind: { type: 'string', enum: ['ADMINISTRATIVO', 'BRIGADA'] },
    operationalState: { type: 'string', enum: ['DISPONIBLE', 'MANTENIMIENTO', 'FUERA_SERVICIO', 'BLOQUEADO'] }, brigade: { type: 'object', nullable: true, properties: { id: { type: 'string' }, name: { type: 'string' } } },
  } }) vehicle!: Record<string, unknown>;
}

export class AssignmentItemResponse extends ActiveAssignmentResponse {
  @ApiProperty({ type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } }) pilot!: { id: string; name: string };
  @ApiProperty({ type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } }) assignedBy!: { id: string; name: string };
  @ApiProperty({ nullable: true }) observations!: string | null;
}

export class MovementResponse {
  @ApiProperty() id!: string;
  @ApiProperty({ type: 'object', properties: { id: { type: 'string' }, plate: { type: 'string' } } }) vehicle!: { id: string; plate: string };
  @ApiProperty() type!: string; @ApiProperty() state!: string;
  @ApiProperty({ format: 'date-time' }) startedAt!: string; @ApiProperty({ nullable: true, format: 'date-time' }) endedAt!: string | null;
  @ApiProperty({ nullable: true, type: 'object', properties: { id: { type: 'string' }, kilometers: { type: 'string' } } }) startOdometer!: { id: string; kilometers: string } | null;
  @ApiProperty({ nullable: true, type: 'object', properties: { id: { type: 'string' }, kilometers: { type: 'string' } } }) endOdometer!: { id: string; kilometers: string } | null;
  @ApiProperty({ nullable: true }) journeyId!: string | null; @ApiProperty({ nullable: true }) loanId!: string | null;
}

export class LoanRequestResponse {
  @ApiProperty() id!: string; @ApiProperty() vehicleId!: string; @ApiProperty() status!: string;
  @ApiProperty({ format: 'date-time' }) requestedAt!: string;
  @ApiProperty({ nullable: true }) destination!: string | null; @ApiProperty({ nullable: true }) reason!: string | null;
}

export class AvailableLoanVehicleResponse {
  @ApiProperty({ type: 'object', properties: { id: { type: 'string' }, plate: { type: 'string' }, make: { type: 'string' }, model: { type: 'string', nullable: true } } }) vehicle!: Record<string, unknown>;
  @ApiProperty({ nullable: true }) latestKilometers!: string | null;
}

export class JourneyResponse {
  @ApiProperty() id!: string; @ApiProperty() state!: string; @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ nullable: true }) startObservations!: string | null; @ApiProperty({ nullable: true }) endObservations!: string | null;
  @ApiProperty() assignmentId!: string;
  @ApiProperty({ type: 'object', properties: { id: { type: 'string' }, type: { type: 'string' }, state: { type: 'string' }, startedAt: { type: 'string', format: 'date-time' }, endedAt: { type: 'string', nullable: true, format: 'date-time' }, reason: { type: 'string', nullable: true }, observations: { type: 'string', nullable: true } } }) movement!: Record<string, unknown>;
  @ApiProperty({ type: 'object', properties: { id: { type: 'string' }, plate: { type: 'string' }, make: { type: 'string' }, model: { type: 'string', nullable: true } } }) vehicle!: Record<string, unknown>;
  @ApiProperty({ nullable: true, type: 'object', properties: { id: { type: 'string' }, kilometers: { type: 'string' }, type: { type: 'string' }, deviceAt: { type: 'string', format: 'date-time' }, receivedAt: { type: 'string', format: 'date-time' } } }) initialOdometer!: Record<string, unknown> | null;
  @ApiProperty({ nullable: true, type: 'object', properties: { id: { type: 'string' }, kilometers: { type: 'string' }, type: { type: 'string' }, deviceAt: { type: 'string', format: 'date-time' }, receivedAt: { type: 'string', format: 'date-time' } } }) finalOdometer!: Record<string, unknown> | null;
}

export class FuelHistoryResponse {
  @ApiProperty() id!: string; @ApiProperty({ format: 'date-time' }) occurredAt!: string; @ApiProperty() gallons!: string;
  @ApiProperty() pricePerGallon!: string; @ApiProperty() totalPaid!: string; @ApiProperty({ nullable: true }) observations!: string | null;
  @ApiProperty({ type: 'object', properties: { gasStationId: { type: 'string', nullable: true }, gasStationName: { type: 'string', nullable: true }, manualName: { type: 'string', nullable: true }, latitude: { type: 'string', nullable: true }, longitude: { type: 'string', nullable: true } } }) location!: Record<string, unknown>;
  @ApiProperty({ type: 'object', properties: { id: { type: 'string' }, plate: { type: 'string' } } }) vehicle!: Record<string, unknown>;
  @ApiProperty({ type: 'object', properties: { id: { type: 'string' }, type: { type: 'string' }, state: { type: 'string' }, loanId: { type: 'string', nullable: true }, journeyId: { type: 'string', nullable: true } } }) movement!: Record<string, unknown>;
  @ApiProperty({ type: 'object', properties: { id: { type: 'string' }, kilometers: { type: 'string' }, recordedAt: { type: 'string', format: 'date-time' }, photoUrl: { type: 'string', nullable: true } } }) odometer!: Record<string, unknown>;
}

export class FuelChargeResponse {
  @ApiProperty() id!: string; @ApiProperty() movementId!: string; @ApiProperty() odometerId!: string;
  @ApiProperty({ format: 'date-time' }) occurredAt!: string;
}

export class OdometerResponse {
  @ApiProperty() id!: string; @ApiProperty({ type: 'object', properties: { id: { type: 'string' }, plate: { type: 'string' } } }) vehicle!: Record<string, unknown>;
  @ApiProperty() kilometers!: string; @ApiProperty() type!: string;
  @ApiProperty({ format: 'date-time' }) deviceAt!: string; @ApiProperty({ format: 'date-time' }) receivedAt!: string;
  @ApiProperty({ nullable: true }) photoUrl!: string | null; @ApiProperty({ nullable: true }) suggestedValue!: string | null;
  @ApiProperty({ nullable: true }) differenceReason!: string | null; @ApiProperty() isValid!: boolean;
}

export class IncidentResponse {
  @ApiProperty() id!: string; @ApiProperty({ nullable: true }) vehicleId!: string | null;
  @ApiProperty({ nullable: true }) movementId!: string | null; @ApiProperty() type!: string; @ApiProperty() priority!: string;
  @ApiProperty() description!: string; @ApiProperty() status!: string; @ApiProperty({ format: 'date-time' }) reportedAt!: string;
  @ApiProperty({ nullable: true, format: 'date-time' }) closedAt!: string | null;
  @ApiProperty({ nullable: true }) latitude!: string | null; @ApiProperty({ nullable: true }) longitude!: string | null;
}

export class MaintenanceDetailLineResponse {
  @ApiProperty() id!: string; @ApiProperty({ nullable: true }) maintenanceTypeId!: string | null;
  @ApiProperty({ nullable: true }) planId!: string | null; @ApiProperty({ nullable: true }) odometerReadingId!: string | null;
  @ApiProperty() description!: string; @ApiProperty() quantity!: string; @ApiProperty() partsCost!: string;
  @ApiProperty() laborCost!: string; @ApiProperty() otherCost!: string;
  @ApiProperty({ nullable: true }) nextIntervalKilometers!: string | null; @ApiProperty({ nullable: true }) nextIntervalDays!: number | null;
  @ApiProperty({ format: 'date-time' }) performedAt!: string; @ApiProperty({ nullable: true }) observations!: string | null;
}

export class MaintenanceOrderResponse {
  @ApiProperty() id!: string; @ApiProperty() vehicleId!: string; @ApiProperty() state!: string; @ApiProperty() blocksVehicle!: boolean;
  @ApiProperty({ format: 'date-time' }) enteredAt!: string; @ApiProperty({ nullable: true, format: 'date-time' }) exitedAt!: string | null;
  @ApiProperty({ nullable: true }) reason!: string | null; @ApiProperty({ nullable: true }) observations!: string | null;
  @ApiProperty({ nullable: true }) workshopId!: string | null; @ApiProperty({ nullable: true }) movementId!: string | null;
  @ApiProperty({ required: false, type: [MaintenanceDetailLineResponse] }) detailLines?: MaintenanceDetailLineResponse[];
}

export class GpsLatestResponse extends GpsPointResponse {
  @ApiProperty() sessionState!: string; @ApiProperty() deviceState!: string;
  @ApiProperty({ nullable: true, format: 'date-time' }) lastHeartbeatAt!: string | null;
}

export class GpsDeviceStatusResponse {
  @ApiProperty() id!: string; @ApiProperty() state!: string; @ApiProperty() platform!: string;
  @ApiProperty({ nullable: true }) manufacturer!: string | null; @ApiProperty({ nullable: true }) model!: string | null;
  @ApiProperty({ nullable: true }) appVersion!: string | null; @ApiProperty({ nullable: true }) gpsEnabled!: boolean | null;
  @ApiProperty() trackingEnabled!: boolean; @ApiProperty({ nullable: true }) batteryPercentage!: number | null;
  @ApiProperty({ nullable: true, format: 'date-time' }) lastHeartbeatAt!: string | null;
  @ApiProperty({ nullable: true, format: 'date-time' }) latestPositionAt!: string | null;
  @ApiProperty({ nullable: true, type: 'object', required: ['serverAt', 'deviceAt', 'batteryPercentage', 'gpsEnabled', 'trackingEnabled', 'networkType', 'appVersion'], properties: {
    serverAt: { type: 'string', format: 'date-time' }, deviceAt: { type: 'string', format: 'date-time', nullable: true },
    batteryPercentage: { type: 'number', nullable: true }, gpsEnabled: { type: 'boolean', nullable: true }, trackingEnabled: { type: 'boolean', nullable: true },
    networkType: { type: 'string', nullable: true }, appVersion: { type: 'string', nullable: true },
  } }) heartbeat!: Record<string, unknown> | null;
}

export class GpsManagedDeviceDiagnosticResponse extends GpsManagedDeviceResponse {
  @ApiProperty({ nullable: true, type: 'object', properties: {
    serverAt: { type: 'string', format: 'date-time' }, deviceAt: { type: 'string', format: 'date-time', nullable: true }, batteryPercentage: { type: 'number', nullable: true },
    gpsEnabled: { type: 'boolean', nullable: true }, trackingEnabled: { type: 'boolean', nullable: true }, networkType: { type: 'string', nullable: true }, appVersion: { type: 'string', nullable: true },
  } }) heartbeat!: Record<string, unknown> | null;
}

export class AdministrativeAvailableVehicleResponse {
  @ApiProperty() id!: string;
  @ApiProperty() plate!: string;
  @ApiProperty() make!: string;
  @ApiProperty({ nullable: true }) model!: string | null;
  @ApiProperty() cabinetId!: string;
  @ApiProperty() positionId!: string;
  @ApiProperty() positionNumber!: number;
  @ApiProperty({ nullable: true }) latestOdometer!: string | null;
}
