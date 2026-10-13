import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { assertPositiveBigintIdentifier } from '../database/postgres-values';
import { GpsArchiveQueryDto, GpsPageQueryDto, GpsPositionHistoryQueryDto } from './gps-read.dto';

export interface GpsPointRecord {
  readonly id: string;
  readonly sessionId: string | null;
  readonly restorationId?: string;
  readonly deviceId: string;
  readonly vehicleId: string | null;
  readonly movementId: string | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMeters: string | null;
  readonly speedKmh: string | null;
  readonly headingDegrees: string | null;
  readonly altitudeMeters: string | null;
  readonly batteryPercentage: number | null;
  readonly capturedAt: string;
  readonly receivedAt: string;
}
export interface GpsSessionRecord {
  readonly id: string;
  readonly deviceId: string;
  readonly vehicleId: string | null;
  readonly movementId: string | null;
  readonly state: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly reason: string | null;
  readonly profile: { readonly id: string; readonly code: string; readonly name: string; readonly mode: string };
}
export interface GpsDeviceStatusRecord {
  readonly id: string;
  readonly state: string;
  readonly platform: string;
  readonly manufacturer: string | null;
  readonly model: string | null;
  readonly appVersion: string | null;
  readonly gpsEnabled: boolean | null;
  readonly trackingEnabled: boolean;
  readonly batteryPercentage: number | null;
  readonly lastHeartbeatAt: string | null;
  readonly latestPositionAt: string | null;
  readonly heartbeat: null | { readonly serverAt: string; readonly deviceAt: string | null; readonly batteryPercentage: number | null; readonly gpsEnabled: boolean | null; readonly trackingEnabled: boolean | null; readonly networkType: string | null; readonly appVersion: string | null };
}
export interface ManagedDeviceStatusRecord {
  readonly id: string;
  readonly associatedUserId: string | null;
  readonly active: boolean;
  readonly state: string;
  readonly platform: string;
  readonly manufacturer: string | null;
  readonly model: string | null;
  readonly appVersion: string | null;
  readonly gpsEnabled: boolean | null;
  readonly trackingEnabled: boolean;
  readonly batteryPercentage: number | null;
  readonly lastHeartbeatAt: string | null;
  readonly latestPositionAt: string | null;
}
export interface ManagedDeviceDiagnosticRecord extends ManagedDeviceStatusRecord {
  readonly heartbeat: null | {
    readonly serverAt: string; readonly deviceAt: string | null; readonly batteryPercentage: number | null;
    readonly gpsEnabled: boolean | null; readonly trackingEnabled: boolean | null; readonly networkType: string | null;
    readonly appVersion: string | null;
  };
}
export interface GpsArchiveRecord {
  readonly id: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly format: string;
  readonly recordCount: string;
  readonly deviceCount: number | null;
  readonly userCount: number | null;
  readonly vehicleCount: number | null;
  readonly sizeBytes: string | null;
  readonly sha256: string | null;
  readonly state: string;
  readonly generatedAt: string;
  readonly verifiedAt: string | null;
  readonly copiedExternallyAt: string | null;
  readonly purgedAt: string | null;
}
export interface GpsRestorationRecord {
  readonly id: string;
  readonly archiveId: string;
  readonly userFilterId: string | null;
  readonly vehicleFilterId: string | null;
  readonly deviceFilterId: string | null;
  readonly from: string;
  readonly to: string;
  readonly state: string;
  readonly recordCount: string;
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly completedAt: string | null;
}

interface GpsPositionRow { id: string; session_id: string | null; restoration_id?: string; device_id: string; vehicle_id: string | null; movement_id: string | null; latitude: number; longitude: number; accuracy: string | null; speed: string | null; heading: string | null; altitude: string | null; battery: number | null; captured_at: Date | string; received_at: Date | string }
interface GpsSessionRow { id: string; device_id: string; vehicle_id: string | null; movement_id: string | null; state: string; started_at: Date | string; ended_at: Date | string | null; reason: string | null; profile_id: string; profile_code: string; profile_name: string; profile_mode: string }
interface GpsDeviceRow { id: string; state: string; platform: string; manufacturer: string | null; model: string | null; app_version: string | null; gps_enabled: boolean | null; tracking_enabled: boolean; battery: number | null; last_heartbeat_at: Date | string | null; latest_position_at: Date | string | null; heartbeat_server_at: Date | string | null; heartbeat_device_at: Date | string | null; heartbeat_battery: number | null; heartbeat_gps: boolean | null; heartbeat_tracking: boolean | null; heartbeat_network: string | null; heartbeat_app_version: string | null }
interface GpsArchiveRow { id: string; period_start: Date | string; period_end: Date | string; format: string; record_count: string; device_count: number | null; user_count: number | null; vehicle_count: number | null; size_bytes: string | null; sha256: string | null; state: string; generated_at: Date | string; verified_at: Date | string | null; copied_externally_at: Date | string | null; purged_at: Date | string | null }
interface GpsRestorationRow { id: string; archive_id: string; user_filter_id: string | null; vehicle_filter_id: string | null; device_filter_id: string | null; from_at: Date | string; to_at: Date | string; state: string; record_count: string; expires_at: Date | string; created_at: Date | string; completed_at: Date | string | null }

@Injectable()
export class GpsReadRepository {
  constructor(private readonly database: DatabaseService) {}

  async findMyLatest(userId: string): Promise<(GpsPointRecord & { readonly sessionState: string; readonly deviceState: string; readonly lastHeartbeatAt: string | null }) | null> {
    assertPositiveBigintIdentifier(userId, 'userId');
    const result = await this.database.query<GpsPositionRow & { session_state: string; device_state: string; last_heartbeat_at: Date | string | null }>(
      `SELECT up.posicion_gps_id::text AS id, up.sesion_seguimiento_id::text AS session_id,
              up.dispositivo_id::text AS device_id, up.vehiculo_id::text AS vehicle_id, up.movimiento_id::text AS movement_id,
              ST_Y(up.ubicacion::geometry) AS latitude, ST_X(up.ubicacion::geometry) AS longitude,
              up.precision_metros::text AS accuracy, up.velocidad_kmh::text AS speed,
              up.rumbo_grados::text AS heading, up.altitud_metros::text AS altitude, up.bateria_porcentaje AS battery,
              up.fecha_hora_dispositivo AS captured_at, up.fecha_hora_servidor AS received_at,
              s.estado::text AS session_state, d.estado::text AS device_state, d.ultimo_heartbeat_at AS last_heartbeat_at
       FROM gacor.ultima_posicion_gps up
       JOIN gacor.sesiones_seguimiento s ON s.id = up.sesion_seguimiento_id
       JOIN gacor.dispositivos d ON d.id = up.dispositivo_id
       WHERE up.usuario_id = $1::bigint
       ORDER BY up.fecha_hora_servidor DESC, up.dispositivo_id DESC LIMIT 1`, [userId]);
    const row = result.rows[0];
    return row ? { ...mapPosition(row), sessionState: row.session_state, deviceState: row.device_state, lastHeartbeatAt: nullableIso(row.last_heartbeat_at) } : null;
  }

  async findRealtimeMap(query: GpsPageQueryDto) {
    const result = await this.database.query<{ vehicle_id: string; plate: string; make: string; model: string | null; device_id: string; latitude: number; longitude: number; accuracy: string | null; speed: string | null; heading: string | null; battery: number | null; captured_at: Date | string; received_at: Date | string; device_state: string; last_heartbeat_at: Date | string | null; connectivity: string }>(
      `SELECT vehiculo_id::text AS vehicle_id, placa AS plate, marca AS make, modelo AS model,
              dispositivo_id::text AS device_id, latitud AS latitude, longitud AS longitude,
              precision_metros::text AS accuracy, velocidad_kmh::text AS speed,
              rumbo_grados::text AS heading, bateria_porcentaje AS battery,
              fecha_hora_dispositivo AS captured_at, fecha_hora_servidor AS received_at,
              estado_dispositivo::text AS device_state, ultimo_heartbeat_at AS last_heartbeat_at,
              conectividad_calculada AS connectivity
       FROM gacor.vw_mapa_vehiculos_tiempo_real
       ORDER BY vehiculo_id ASC LIMIT $1::integer OFFSET $2::integer`, [query.limit + 1, query.offset]);
    const hasMore = result.rows.length > query.limit;
    return { items: (hasMore ? result.rows.slice(0, query.limit) : result.rows).map((r) => ({ vehicleId: r.vehicle_id, plate: r.plate, make: r.make, model: r.model, deviceId: r.device_id, latitude: r.latitude, longitude: r.longitude, accuracyMeters: r.accuracy, speedKmh: r.speed, headingDegrees: r.heading, batteryPercentage: r.battery, capturedAt: toIso(r.captured_at), receivedAt: toIso(r.received_at), deviceState: r.device_state, lastHeartbeatAt: nullableIso(r.last_heartbeat_at), connectivityCalculatedBySchema: r.connectivity })), hasMore };
  }

  async findVehiclePositions(vehicleId: string, query: GpsPositionHistoryQueryDto): Promise<{ items: readonly GpsPointRecord[]; hasMore: boolean }> {
    assertPositiveBigintIdentifier(vehicleId, 'vehicleId'); assertRange(query.from, query.to);
    const result = await this.database.query<GpsPositionRow>(
      `SELECT p.id::text AS id, p.sesion_seguimiento_id::text AS session_id, p.dispositivo_id::text AS device_id,
              p.vehiculo_id::text AS vehicle_id, p.movimiento_id::text AS movement_id,
              ST_Y(p.ubicacion::geometry) AS latitude, ST_X(p.ubicacion::geometry) AS longitude,
              p.precision_metros::text AS accuracy, p.velocidad_kmh::text AS speed,
              p.rumbo_grados::text AS heading, p.altitud_metros::text AS altitude,
              p.bateria_porcentaje AS battery, p.fecha_hora_dispositivo AS captured_at,
              p.fecha_hora_servidor AS received_at
       FROM gacor.posiciones_gps p WHERE p.vehiculo_id = $1::bigint
         AND p.fecha_hora_servidor >= $2::timestamptz AND p.fecha_hora_servidor < $3::timestamptz
       ORDER BY p.fecha_hora_servidor DESC, p.id DESC LIMIT $4::integer OFFSET $5::integer`,
      [vehicleId, query.from, query.to, query.limit + 1, query.offset]);
    const hasMore = result.rows.length > query.limit;
    return { items: (hasMore ? result.rows.slice(0, query.limit) : result.rows).map(mapPosition), hasMore };
  }

  async findManagedDevices(query: GpsPageQueryDto) {
    const result = await this.database.query<ManagedDeviceStatusRecord & { lastHeartbeatAt: string | null; latestPositionAt: string | null }>(
      `SELECT v.dispositivo_id::text AS id, d.usuario_asociado_id::text AS "associatedUserId",
              d.activo AS active, v.estado_calculado AS state, d.plataforma AS platform,
              v.fabricante AS manufacturer, v.modelo AS model, v.version_app AS "appVersion",
              v.gps_habilitado AS "gpsEnabled", v.tracking_habilitado AS "trackingEnabled",
              v.bateria_porcentaje AS "batteryPercentage", v.ultimo_heartbeat_at AS "lastHeartbeatAt",
              v.ultima_posicion_at AS "latestPositionAt"
       FROM gacor.vw_estado_dispositivos v JOIN gacor.dispositivos d ON d.id = v.dispositivo_id
       ORDER BY v.dispositivo_id ASC LIMIT $1::integer OFFSET $2::integer`, [query.limit + 1, query.offset]);
    const hasMore = result.rows.length > query.limit;
    return { items: (hasMore ? result.rows.slice(0, query.limit) : result.rows).map((r) => ({ ...r,
      lastHeartbeatAt: nullableIso(r.lastHeartbeatAt), latestPositionAt: nullableIso(r.latestPositionAt) })), hasMore };
  }

  async findManagedDevice(id: string): Promise<ManagedDeviceDiagnosticRecord | null> {
    assertPositiveBigintIdentifier(id, 'deviceId');
    const result = await this.database.query<{
      id: string; associated_user_id: string | null; active: boolean; state: string; platform: string;
      manufacturer: string | null; model: string | null; app_version: string | null; gps_enabled: boolean | null;
      tracking_enabled: boolean; battery: number | null; last_heartbeat_at: Date | string | null;
      latest_position_at: Date | string | null; heartbeat_server_at: Date | string | null;
      heartbeat_device_at: Date | string | null; heartbeat_battery: number | null; heartbeat_gps: boolean | null;
      heartbeat_tracking: boolean | null; heartbeat_network: string | null; heartbeat_app_version: string | null;
    }>(
      `SELECT v.dispositivo_id::text AS id, d.usuario_asociado_id::text AS associated_user_id,
              d.activo AS active, v.estado_calculado AS state, d.plataforma AS platform,
              v.fabricante AS manufacturer, v.modelo AS model, v.version_app AS app_version,
              v.gps_habilitado AS gps_enabled, v.tracking_habilitado AS tracking_enabled,
              v.bateria_porcentaje AS battery, v.ultimo_heartbeat_at AS last_heartbeat_at,
              v.ultima_posicion_at AS latest_position_at,
              h.fecha_hora_servidor AS heartbeat_server_at, h.fecha_hora_dispositivo AS heartbeat_device_at,
              h.bateria_porcentaje AS heartbeat_battery, h.gps_habilitado AS heartbeat_gps,
              h.tracking_habilitado AS heartbeat_tracking, h.tipo_red AS heartbeat_network,
              h.version_app AS heartbeat_app_version
       FROM gacor.vw_estado_dispositivos v JOIN gacor.dispositivos d ON d.id=v.dispositivo_id
       LEFT JOIN LATERAL (SELECT hb.* FROM gacor.heartbeats_dispositivo hb WHERE hb.dispositivo_id=d.id
         ORDER BY hb.fecha_hora_servidor DESC, hb.id DESC LIMIT 1) h ON TRUE
       WHERE v.dispositivo_id=$1::bigint`, [id],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id, associatedUserId: row.associated_user_id, active: row.active, state: row.state,
      platform: row.platform, manufacturer: row.manufacturer, model: row.model, appVersion: row.app_version,
      gpsEnabled: row.gps_enabled, trackingEnabled: row.tracking_enabled, batteryPercentage: row.battery,
      lastHeartbeatAt: nullableIso(row.last_heartbeat_at), latestPositionAt: nullableIso(row.latest_position_at),
      heartbeat: row.heartbeat_server_at === null ? null : {
        serverAt: toIso(row.heartbeat_server_at), deviceAt: nullableIso(row.heartbeat_device_at),
        batteryPercentage: row.heartbeat_battery, gpsEnabled: row.heartbeat_gps,
        trackingEnabled: row.heartbeat_tracking, networkType: row.heartbeat_network, appVersion: row.heartbeat_app_version,
      },
    };
  }

  async findMySessions(userId: string, query: GpsPageQueryDto): Promise<{ items: readonly GpsSessionRecord[]; hasMore: boolean }> {
    assertPositiveBigintIdentifier(userId, 'userId');
    const result = await this.database.query<GpsSessionRow>(
      `${SESSION_FIELDS} WHERE s.usuario_id = $1::bigint
       ORDER BY s.fecha_hora_inicio DESC, s.id DESC LIMIT $2::integer OFFSET $3::integer`,
      [userId, query.limit + 1, query.offset]);
    const hasMore = result.rows.length > query.limit;
    return { items: (hasMore ? result.rows.slice(0, query.limit) : result.rows).map(mapSession), hasMore };
  }

  async findMySession(id: string, userId: string): Promise<GpsSessionRecord | null> {
    assertPositiveBigintIdentifier(id, 'sessionId'); assertPositiveBigintIdentifier(userId, 'userId');
    const result = await this.database.query<GpsSessionRow>(`${SESSION_FIELDS} WHERE s.id = $1::bigint AND s.usuario_id = $2::bigint`, [id, userId]);
    return result.rows[0] ? mapSession(result.rows[0]) : null;
  }

  async findSessionPositions(sessionId: string, userId: string, query: GpsPositionHistoryQueryDto): Promise<{ items: readonly GpsPointRecord[]; hasMore: boolean } | null> {
    assertPositiveBigintIdentifier(sessionId, 'sessionId'); assertPositiveBigintIdentifier(userId, 'userId'); assertRange(query.from, query.to);
    const owned = await this.database.query('SELECT 1 FROM gacor.sesiones_seguimiento WHERE id = $1::bigint AND usuario_id = $2::bigint', [sessionId, userId]);
    if (!owned.rowCount) return null;
    const result = await this.database.query<GpsPositionRow>(
      `SELECT p.id::text AS id, p.sesion_seguimiento_id::text AS session_id, p.dispositivo_id::text AS device_id,
              p.vehiculo_id::text AS vehicle_id, p.movimiento_id::text AS movement_id,
              ST_Y(p.ubicacion::geometry) AS latitude, ST_X(p.ubicacion::geometry) AS longitude,
              p.precision_metros::text AS accuracy, p.velocidad_kmh::text AS speed,
              p.rumbo_grados::text AS heading, p.altitud_metros::text AS altitude,
              p.bateria_porcentaje AS battery, p.fecha_hora_dispositivo AS captured_at,
              p.fecha_hora_servidor AS received_at
       FROM gacor.posiciones_gps p JOIN gacor.sesiones_seguimiento s ON s.id = p.sesion_seguimiento_id
       WHERE p.sesion_seguimiento_id = $1::bigint AND s.usuario_id = $2::bigint
         AND p.fecha_hora_servidor >= $3::timestamptz AND p.fecha_hora_servidor < $4::timestamptz
       ORDER BY p.fecha_hora_servidor DESC, p.id DESC LIMIT $5::integer OFFSET $6::integer`,
      [sessionId, userId, query.from, query.to, query.limit + 1, query.offset]);
    const hasMore = result.rows.length > query.limit;
    return { items: (hasMore ? result.rows.slice(0, query.limit) : result.rows).map(mapPosition), hasMore };
  }

  async findOwnDeviceStatus(deviceId: string): Promise<GpsDeviceStatusRecord | null> {
    assertPositiveBigintIdentifier(deviceId, 'deviceId');
    const result = await this.database.query<GpsDeviceRow>(
      `SELECT v.dispositivo_id::text AS id, v.estado_calculado AS state, d.plataforma AS platform,
              v.fabricante AS manufacturer, v.modelo AS model, v.version_app AS app_version,
              v.gps_habilitado AS gps_enabled, v.tracking_habilitado AS tracking_enabled,
              v.bateria_porcentaje AS battery, v.ultimo_heartbeat_at AS last_heartbeat_at,
              v.ultima_posicion_at AS latest_position_at,
              h.fecha_hora_servidor AS heartbeat_server_at, h.fecha_hora_dispositivo AS heartbeat_device_at,
              h.bateria_porcentaje AS heartbeat_battery, h.gps_habilitado AS heartbeat_gps,
              h.tracking_habilitado AS heartbeat_tracking, h.tipo_red AS heartbeat_network, h.version_app AS heartbeat_app_version
       FROM gacor.vw_estado_dispositivos v JOIN gacor.dispositivos d ON d.id = v.dispositivo_id
       LEFT JOIN LATERAL (SELECT hb.* FROM gacor.heartbeats_dispositivo hb WHERE hb.dispositivo_id = d.id
         ORDER BY hb.fecha_hora_servidor DESC, hb.id DESC LIMIT 1) h ON TRUE
       WHERE v.dispositivo_id = $1::bigint`, [deviceId]);
    const r = result.rows[0];
    return r ? { id: r.id, state: r.state, platform: r.platform, manufacturer: r.manufacturer, model: r.model,
      appVersion: r.app_version, gpsEnabled: r.gps_enabled, trackingEnabled: r.tracking_enabled,
      batteryPercentage: r.battery, lastHeartbeatAt: nullableIso(r.last_heartbeat_at), latestPositionAt: nullableIso(r.latest_position_at),
      heartbeat: r.heartbeat_server_at === null ? null : { serverAt: toIso(r.heartbeat_server_at), deviceAt: nullableIso(r.heartbeat_device_at), batteryPercentage: r.heartbeat_battery, gpsEnabled: r.heartbeat_gps, trackingEnabled: r.heartbeat_tracking, networkType: r.heartbeat_network, appVersion: r.heartbeat_app_version } } : null;
  }

  async findGpsConfiguration() {
    const result = await this.database.query<{ id: number; online_months: number; keep_months: number; heartbeat_days: number; restoration_hours: number; external_backup_required: boolean; updated_at: Date | string }>(
      `SELECT id, meses_retencion_online AS online_months, meses_conservar_post_purga AS keep_months,
              dias_retencion_heartbeat AS heartbeat_days, horas_restauracion_temporal AS restoration_hours,
              requiere_backup_externo_antes_purga AS external_backup_required, updated_at
       FROM gacor.configuracion_gps WHERE id = 1`);
    const r = result.rows[0];
    return r ? { id: r.id, onlineRetentionMonths: r.online_months, monthsToKeepAfterPurge: r.keep_months,
      heartbeatRetentionDays: r.heartbeat_days, temporaryRestorationHours: r.restoration_hours,
      externalBackupRequiredBeforePurge: r.external_backup_required, updatedAt: toIso(r.updated_at) } : null;
  }

  async findProfiles(query: GpsPageQueryDto) {
    const result = await this.database.query<{ id: string; code: string; name: string; mode: string; movement_interval: number; slow_interval: number; stopped_interval: number; prolonged_interval: number; prolonged_after: number; heartbeat_interval: number; minimum_distance: string; movement_speed: string; active: boolean }>(
      `SELECT id::text AS id, codigo AS code, nombre AS name, modo::text AS mode,
              intervalo_movimiento_seg AS movement_interval, intervalo_lento_seg AS slow_interval,
              intervalo_detenido_seg AS stopped_interval, intervalo_detenido_prolongado_seg AS prolonged_interval,
              segundos_para_detenido_prolongado AS prolonged_after, intervalo_heartbeat_seg AS heartbeat_interval,
              distancia_minima_m::text AS minimum_distance, velocidad_movimiento_kmh::text AS movement_speed, activo AS active
       FROM gacor.perfiles_seguimiento ORDER BY id ASC LIMIT $1::integer OFFSET $2::integer`, [query.limit + 1, query.offset]);
    const hasMore = result.rows.length > query.limit;
    return { items: (hasMore ? result.rows.slice(0, query.limit) : result.rows).map((r) => ({ id: r.id, code: r.code, name: r.name, mode: r.mode, movementIntervalSeconds: r.movement_interval, slowIntervalSeconds: r.slow_interval, stoppedIntervalSeconds: r.stopped_interval, prolongedStopIntervalSeconds: r.prolonged_interval, prolongedStopAfterSeconds: r.prolonged_after, heartbeatIntervalSeconds: r.heartbeat_interval, minimumDistanceMeters: r.minimum_distance, movementSpeedKmh: r.movement_speed, active: r.active })), hasMore };
  }

  async findArchives(query: GpsArchiveQueryDto) {
    const result = await this.database.query<GpsArchiveRow>(
      `SELECT id::text, periodo_inicio AS period_start, periodo_fin AS period_end, formato AS format,
              cantidad_registros::text AS record_count, cantidad_dispositivos AS device_count,
              cantidad_usuarios AS user_count, cantidad_vehiculos AS vehicle_count, tamano_bytes::text AS size_bytes,
              sha256, estado::text AS state, generado_at AS generated_at, verificado_at AS verified_at,
              copiado_externo_at AS copied_externally_at, purgado_at AS purged_at
       FROM gacor.archivos_gps WHERE ($1::text IS NULL OR estado::text = $1::text)
       ORDER BY periodo_inicio DESC, id DESC LIMIT $2::integer OFFSET $3::integer`, [query.state ?? null, query.limit + 1, query.offset]);
    const hasMore = result.rows.length > query.limit;
    return { items: (hasMore ? result.rows.slice(0, query.limit) : result.rows).map(mapArchive), hasMore };
  }

  async findRetentionSummary() {
    const result = await this.database.query<{ oldest_month: Date | string | null; newest_month: Date | string | null; online_records: string; online_months: number; retention_months: number; keep_months: number; archive_required: boolean; keep_from: Date | string | null }>(
      `SELECT mes_mas_antiguo AS oldest_month, mes_mas_reciente AS newest_month,
              registros_online::text AS online_records, meses_online AS online_months,
              meses_retencion_online AS retention_months, meses_conservar_post_purga AS keep_months,
              requiere_archivado AS archive_required, conservar_desde_mes AS keep_from
       FROM gacor.vw_retencion_gps`);
    const r = result.rows[0];
    return r ? { oldestMonth: nullableDate(r.oldest_month), newestMonth: nullableDate(r.newest_month), onlineRecords: r.online_records,
      onlineMonths: r.online_months, retentionMonths: r.retention_months, monthsToKeepAfterPurge: r.keep_months,
      archiveRequired: r.archive_required, keepFromMonth: nullableDate(r.keep_from) } : null;
  }

  async findMyRestorations(userId: string, query: GpsPageQueryDto): Promise<{ items: readonly GpsRestorationRecord[]; hasMore: boolean }> {
    assertPositiveBigintIdentifier(userId, 'userId');
    const result = await this.database.query<GpsRestorationRow>(`${RESTORATION_FIELDS}
      WHERE solicitado_por_id = $1::bigint ORDER BY created_at DESC, id DESC LIMIT $2::integer OFFSET $3::integer`,
      [userId, query.limit + 1, query.offset]);
    const hasMore = result.rows.length > query.limit;
    return { items: (hasMore ? result.rows.slice(0, query.limit) : result.rows).map(mapRestoration), hasMore };
  }

  async findRestorationPositions(restorationId: string, userId: string, query: GpsPositionHistoryQueryDto): Promise<{ items: readonly GpsPointRecord[]; hasMore: boolean } | null> {
    assertPositiveBigintIdentifier(restorationId, 'restorationId'); assertPositiveBigintIdentifier(userId, 'userId'); assertRange(query.from, query.to);
    const owned = await this.database.query(`SELECT 1 FROM gacor.restauraciones_gps WHERE id = $1::bigint AND solicitado_por_id = $2::bigint AND estado = 'LISTA'::gacor.estado_restauracion_gps_enum AND expires_at > NOW()`, [restorationId, userId]);
    if (!owned.rowCount) return null;
    const result = await this.database.query<GpsPositionRow>(
      `SELECT p.id::text AS id, NULL::text AS session_id, p.restauracion_id::text AS restoration_id, p.dispositivo_id::text AS device_id,
              p.vehiculo_id::text AS vehicle_id, NULL::text AS movement_id,
              ST_Y(p.ubicacion::geometry) AS latitude, ST_X(p.ubicacion::geometry) AS longitude,
              p.precision_metros::text AS accuracy, p.velocidad_kmh::text AS speed,
              p.rumbo_grados::text AS heading, p.altitud_metros::text AS altitude, NULL::smallint AS battery,
              p.fecha_hora_dispositivo AS captured_at, p.fecha_hora_servidor AS received_at
       FROM gacor.posiciones_gps_temporales p JOIN gacor.restauraciones_gps r ON r.id = p.restauracion_id
       WHERE p.restauracion_id = $1::bigint AND r.solicitado_por_id = $6::bigint
         AND r.estado = 'LISTA'::gacor.estado_restauracion_gps_enum AND r.expires_at > NOW()
         AND p.fecha_hora_servidor >= $2::timestamptz AND p.fecha_hora_servidor < $3::timestamptz
       ORDER BY p.fecha_hora_servidor DESC, p.id DESC LIMIT $4::integer OFFSET $5::integer`, [restorationId, query.from, query.to, query.limit + 1, query.offset, userId]);
    const hasMore = result.rows.length > query.limit;
    return { items: (hasMore ? result.rows.slice(0, query.limit) : result.rows).map(mapPosition), hasMore };
  }
}

const SESSION_FIELDS = `SELECT s.id::text AS id, s.dispositivo_id::text AS device_id, s.vehiculo_id::text AS vehicle_id,
  s.movimiento_id::text AS movement_id, s.estado::text AS state, s.fecha_hora_inicio AS started_at,
  s.fecha_hora_fin AS ended_at, s.motivo AS reason, p.id::text AS profile_id, p.codigo AS profile_code,
  p.nombre AS profile_name, p.modo::text AS profile_mode FROM gacor.sesiones_seguimiento s
  JOIN gacor.perfiles_seguimiento p ON p.id = s.perfil_id`;
const RESTORATION_FIELDS = `SELECT id::text, archivo_gps_id::text AS archive_id, usuario_filtro_id::text AS user_filter_id,
  vehiculo_filtro_id::text AS vehicle_filter_id, dispositivo_filtro_id::text AS device_filter_id,
  desde AS from_at, hasta AS to_at, estado::text AS state, cantidad_registros::text AS record_count,
  expires_at, created_at, completed_at FROM gacor.restauraciones_gps`;

function mapPosition(r: GpsPositionRow): GpsPointRecord { return { id: r.id, sessionId: r.session_id, ...(r.restoration_id === undefined ? {} : { restorationId: r.restoration_id }), deviceId: r.device_id, vehicleId: r.vehicle_id, movementId: r.movement_id, latitude: r.latitude, longitude: r.longitude, accuracyMeters: r.accuracy, speedKmh: r.speed, headingDegrees: r.heading, altitudeMeters: r.altitude, batteryPercentage: r.battery, capturedAt: toIso(r.captured_at), receivedAt: toIso(r.received_at) }; }
function mapSession(r: GpsSessionRow): GpsSessionRecord { return { id: r.id, deviceId: r.device_id, vehicleId: r.vehicle_id, movementId: r.movement_id, state: r.state, startedAt: toIso(r.started_at), endedAt: nullableIso(r.ended_at), reason: r.reason, profile: { id: r.profile_id, code: r.profile_code, name: r.profile_name, mode: r.profile_mode } }; }
function mapArchive(r: GpsArchiveRow): GpsArchiveRecord { return { id: r.id, periodStart: dateOnly(r.period_start), periodEnd: dateOnly(r.period_end), format: r.format, recordCount: r.record_count, deviceCount: r.device_count, userCount: r.user_count, vehicleCount: r.vehicle_count, sizeBytes: r.size_bytes, sha256: r.sha256, state: r.state, generatedAt: toIso(r.generated_at), verifiedAt: nullableIso(r.verified_at), copiedExternallyAt: nullableIso(r.copied_externally_at), purgedAt: nullableIso(r.purged_at) }; }
function mapRestoration(r: GpsRestorationRow): GpsRestorationRecord { return { id: r.id, archiveId: r.archive_id, userFilterId: r.user_filter_id, vehicleFilterId: r.vehicle_filter_id, deviceFilterId: r.device_filter_id, from: toIso(r.from_at), to: toIso(r.to_at), state: r.state, recordCount: r.record_count, expiresAt: toIso(r.expires_at), createdAt: toIso(r.created_at), completedAt: nullableIso(r.completed_at) }; }
function toIso(value: Date | string): string { return new Date(value).toISOString(); }
function nullableIso(value: Date | string | null): string | null { return value === null ? null : toIso(value); }
function nullableDate(value: Date | string | null): string | null { return value === null ? null : dateOnly(value); }
function dateOnly(value: Date | string): string { return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10); }
function assertRange(from: string, to: string): void { const start = Date.parse(from); const end = Date.parse(to); if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new TypeError('Invalid GPS time range'); }
