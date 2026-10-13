import { describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../database/database.service';
import { GpsArchiveQueryDto, GpsPageQueryDto, GpsPositionHistoryQueryDto } from './gps-read.dto';
import { GpsReadRepository } from './gps-read.repository';

describe('GpsReadRepository', () => {
  it('reads latest own persisted location with session and device state, retaining absence as null', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: '9007199254740993', session_id: '12', device_id: '15', vehicle_id: null, movement_id: null, latitude: 14.5, longitude: -90.5, accuracy: '3.20', speed: null, heading: null, altitude: null, battery: null, captured_at: new Date('2026-01-01T00:00:00Z'), received_at: new Date('2026-01-01T00:00:03Z'), session_state: 'FINALIZADO', device_state: 'OFFLINE', last_heartbeat_at: null }] });
    const repository = new GpsReadRepository({ query } as unknown as DatabaseService);
    const result = await repository.findMyLatest('8');
    expect(result).toMatchObject({ id: '9007199254740993', latitude: 14.5, longitude: -90.5, accuracyMeters: '3.20', sessionState: 'FINALIZADO', deviceState: 'OFFLINE', lastHeartbeatAt: null });
    expect(query.mock.calls[0]![0]).toContain('WHERE up.usuario_id = $1::bigint');
    expect(query.mock.calls[0]![1]).toEqual(['8']);
  });

  it('queries authorized vehicle latest positions through official view and stable pagination', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new GpsReadRepository({ query } as unknown as DatabaseService);
    await expect(repository.findRealtimeMap(Object.assign(new GpsPageQueryDto(), { limit: 20, offset: 40 }))).resolves.toEqual({ items: [], hasMore: false });
    expect(query.mock.calls[0]![0]).toContain('gacor.vw_mapa_vehiculos_tiempo_real');
    expect(query.mock.calls[0]![0]).toContain('ORDER BY vehiculo_id ASC');
    expect(query.mock.calls[0]![1]).toEqual([21, 40]);
  });

  it('queries vehicle history through the partition timestamp and vehicle index keys', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new GpsReadRepository({ query } as unknown as DatabaseService);
    const range = Object.assign(new GpsPositionHistoryQueryDto(), { from: '2026-01-01T00:00:00Z', to: '2026-01-02T00:00:00Z', limit: 10, offset: 0 });
    await repository.findVehiclePositions('55', range);
    expect(query.mock.calls[0]![0]).toContain('p.vehiculo_id = $1::bigint');
    expect(query.mock.calls[0]![0]).toContain('p.fecha_hora_servidor >= $2::timestamptz AND p.fecha_hora_servidor < $3::timestamptz');
    expect(query.mock.calls[0]![0]).toContain('ORDER BY p.fecha_hora_servidor DESC, p.id DESC');
    expect(query.mock.calls[0]![1]).toEqual(['55', range.from, range.to, 11, 0]);
  });

  it('lists device status only through the official calculated status view and omits credentials', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new GpsReadRepository({ query } as unknown as DatabaseService);
    await repository.findManagedDevices(new GpsPageQueryDto());
    expect(query.mock.calls[0]![0]).toContain('gacor.vw_estado_dispositivos');
    expect(query.mock.calls[0]![0]).toContain('ORDER BY v.dispositivo_id ASC');
    expect(query.mock.calls[0]![0]).not.toContain('device_token_hash');
    expect(query.mock.calls[0]![0]).not.toContain('push_token');
  });

  it('returns one device diagnostic with latest heartbeat and no device secrets', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{
      id: '15', associated_user_id: '8', active: true, state: 'ONLINE', platform: 'ANDROID', manufacturer: 'Maker', model: 'Phone',
      app_version: '1.0', gps_enabled: true, tracking_enabled: true, battery: 82,
      last_heartbeat_at: new Date('2026-10-13T10:00:00Z'), latest_position_at: null,
      heartbeat_server_at: new Date('2026-10-13T10:00:00Z'), heartbeat_device_at: null,
      heartbeat_battery: 82, heartbeat_gps: true, heartbeat_tracking: true, heartbeat_network: 'WIFI', heartbeat_app_version: '1.0',
    }] });
    const repository = new GpsReadRepository({ query } as unknown as DatabaseService);
    await expect(repository.findManagedDevice('15')).resolves.toMatchObject({
      id: '15', associatedUserId: '8', state: 'ONLINE', heartbeat: { batteryPercentage: 82, networkType: 'WIFI' },
    });
    const [sql, values] = query.mock.calls[0]!;
    expect(sql).toContain('gacor.vw_estado_dispositivos');
    expect(sql).toContain('gacor.heartbeats_dispositivo');
    expect(sql).toContain('WHERE v.dispositivo_id=$1::bigint');
    expect(sql).not.toContain('device_token_hash');
    expect(sql).not.toContain('push_token');
    expect(sql).not.toContain('installation_uuid');
    expect(values).toEqual(['15']);
  });

  it('scopes sessions to the principal and orders them deterministically', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new GpsReadRepository({ query } as unknown as DatabaseService);
    await expect(repository.findMySessions('8', new GpsPageQueryDto())).resolves.toMatchObject({ items: [], hasMore: false });
    expect(query.mock.calls[0]![0]).toContain('s.usuario_id = $1::bigint');
    expect(query.mock.calls[0]![0]).toContain('ORDER BY s.fecha_hora_inicio DESC, s.id DESC');
  });

  it('requires owner session and timestamp range for partition-prunable GPS history', async () => {
    const query = vi.fn().mockResolvedValueOnce({ rowCount: 1 }).mockResolvedValueOnce({ rows: [] });
    const repository = new GpsReadRepository({ query } as unknown as DatabaseService);
    const range = Object.assign(new GpsPositionHistoryQueryDto(), { from: '2026-01-01T00:00:00Z', to: '2026-01-02T00:00:00Z', limit: 10, offset: 0 });
    await expect(repository.findSessionPositions('12', '8', range)).resolves.toEqual({ items: [], hasMore: false });
    expect(query.mock.calls[0]![0]).toContain('id = $1::bigint AND usuario_id = $2::bigint');
    expect(query.mock.calls[1]![0]).toContain('p.fecha_hora_servidor >= $3::timestamptz AND p.fecha_hora_servidor < $4::timestamptz');
    expect(query.mock.calls[1]![0]).toContain('ORDER BY p.fecha_hora_servidor DESC, p.id DESC');
  });

  it('hides another user session and rejects invalid ranges without reading points', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    const repository = new GpsReadRepository({ query } as unknown as DatabaseService);
    const invalid = Object.assign(new GpsPositionHistoryQueryDto(), { from: '2026-01-02T00:00:00Z', to: '2026-01-01T00:00:00Z' });
    await expect(repository.findSessionPositions('12', '8', invalid)).rejects.toThrow('Invalid GPS time range');
    expect(query).not.toHaveBeenCalled();
    const valid = Object.assign(new GpsPositionHistoryQueryDto(), { from: '2026-01-01T00:00:00Z', to: '2026-01-02T00:00:00Z' });
    await expect(repository.findSessionPositions('12', '8', valid)).resolves.toBeNull();
    expect(query).toHaveBeenCalledOnce();
  });

  it('reads own device status by authenticated device id and never selects device secrets', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new GpsReadRepository({ query } as unknown as DatabaseService);
    await repository.findOwnDeviceStatus('15');
    expect(query.mock.calls[0]![0]).toContain('gacor.vw_estado_dispositivos');
    expect(query.mock.calls[0]![0]).toContain('gacor.heartbeats_dispositivo');
    expect(query.mock.calls[0]![0]).toContain('WHERE v.dispositivo_id = $1::bigint');
    expect(query.mock.calls[0]![0]).not.toContain('device_token_hash');
    expect(query.mock.calls[0]![0]).not.toContain('push_token');
    expect(query.mock.calls[0]![1]).toEqual(['15']);
  });

  it('excludes storage paths from archive queries and supports actual enum status filter', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new GpsReadRepository({ query } as unknown as DatabaseService);
    await repository.findArchives(Object.assign(new GpsArchiveQueryDto(), { state: 'VERIFICADO' }));
    expect(query.mock.calls[0]![0]).toContain('gacor.archivos_gps');
    expect(query.mock.calls[0]![0]).toContain('estado::text = $1::text');
    expect(query.mock.calls[0]![0]).not.toContain('storage_path');
    expect(query.mock.calls[0]![1]).toEqual(['VERIFICADO', 101, 0]);
  });

  it('queries configuration without exposing the server storage root', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new GpsReadRepository({ query } as unknown as DatabaseService);
    await repository.findGpsConfiguration();
    expect(query.mock.calls[0]![0]).toContain('gacor.configuracion_gps');
    expect(query.mock.calls[0]![0]).not.toContain('storage_root');
  });
});
