import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseService } from '../database/database.service';
import { MaintenanceOrderHistoryQueryDto } from './maintenance.dto';
import {
  ActiveBlockingMaintenanceOrderError,
  MaintenanceRepository,
  NoAssignedVehicleForMaintenanceError,
} from './maintenance.repository';

function orderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '71', vehicle_id: '22', state: 'ABIERTA', blocks_vehicle: true,
    entered_at: new Date('2026-08-01T10:00:00Z'), exited_at: null, reason: 'Revisión',
    observations: null, workshop_id: null, movement_id: null, ...overrides,
  };
}

describe('MaintenanceRepository', () => {
  it('lists only the authenticated pilot’s currently assigned vehicle and applies state filter/pagination', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [orderRow()] });
    const repository = new MaintenanceRepository({ query } as unknown as DatabaseService);
    await expect(repository.findOrdersForCurrentVehicle('8', Object.assign(new MaintenanceOrderHistoryQueryDto(), {
      limit: 25, offset: 5, state: 'ABIERTA',
    }))).resolves.toMatchObject({ items: [{ id: '71', vehicleId: '22', state: 'ABIERTA' }], hasMore: false });
    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('a.piloto_id = $1::bigint');
    expect(sql).toContain("a.estado = 'ACTIVA'::gacor.estado_asignacion_enum");
    expect(sql).toContain('ORDER BY om.fecha_hora_ingreso DESC, om.id DESC');
    expect(values).toEqual(['8', 'ABIERTA', 26, 5]);
  });

  it('returns null when the order is not attached to the current assigned vehicle', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await expect(new MaintenanceRepository({ query } as unknown as DatabaseService)
      .findOrderByIdForCurrentVehicle('71', '8')).resolves.toBeNull();
    expect(query.mock.calls[0]?.[0]).toContain('om.id = $1::bigint');
    expect(query.mock.calls[0]?.[0]).toContain('a.piloto_id = $2::bigint');
  });

  it('loads detail lines only after the order passes the current-vehicle ownership filter', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [orderRow()] })
      .mockResolvedValueOnce({ rows: [{
        id: '81', maintenance_type_id: '2', plan_id: '5', odometer_reading_id: '32',
        description: 'Cambio de aceite', quantity: '1.000', parts_cost: '150.00', labor_cost: '50.00',
        other_cost: '0.00', next_interval_kilometers: '5000.0', next_interval_days: null,
        performed_at: new Date('2026-08-02T10:00:00Z'), observations: null,
      }] });
    const repository = new MaintenanceRepository({ query } as unknown as DatabaseService);
    await expect(repository.findOrderByIdForCurrentVehicle('71', '8')).resolves.toMatchObject({
      id: '71', detailLines: [{ id: '81', quantity: '1.000', partsCost: '150.00', nextIntervalKilometers: '5000.0' }],
    });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1]?.[0]).toContain('WHERE orden_mantenimiento_id = $1::bigint');
    expect(query.mock.calls[1]?.[1]).toEqual(['71']);
  });

  it('returns plans calculated by the official maintenance view and current vehicle alerts', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{
        plan_id: '5', vehicle_id: '22', plate: 'ABC-123', maintenance_type_id: '2', maintenance_name: 'Aceite',
        current_kilometers: '12000.0', last_service_kilometers: '8000.0', interval_kilometers: '5000.0',
        next_kilometers: '13000.0', kilometers_remaining: '1000.0', kilometer_status: 'AL_DIA',
      }] })
      .mockResolvedValueOnce({ rows: [{
        id: '99', type: 'MANTENIMIENTO_PROXIMO', priority: 'MEDIA', title: 'Servicio próximo',
        message: 'Aceite', state: 'PENDIENTE', created_at: new Date('2026-08-01T10:00:00Z'), resolved_at: null,
      }] });
    const repository = new MaintenanceRepository({ query } as unknown as DatabaseService);
    await expect(repository.findPlansForCurrentVehicle('8')).resolves.toMatchObject([{ planId: '5', kilometerStatus: 'AL_DIA' }]);
    await expect(repository.findAlertsForCurrentVehicle('8')).resolves.toMatchObject([{
      id: '99', type: 'MANTENIMIENTO_PROXIMO', state: 'PENDIENTE', resolvedAt: null,
    }]);
    expect(query.mock.calls[0]?.[0]).toContain('FROM gacor.vw_estado_mantenimiento');
    expect(query.mock.calls[1]?.[0]).toContain("'MANTENIMIENTO_PROXIMO', 'MANTENIMIENTO_VENCIDO'");
  });

  it('creates a blocking order for the assigned vehicle with audit context in the transaction', async () => {
    const txQuery = vi.fn().mockResolvedValue({ rows: [orderRow()] });
    const auditContexts: unknown[] = [];
    const transaction = vi.fn(async (work: (tx: never) => Promise<unknown>, audit: unknown) => {
      auditContexts.push(audit);
      return work({ query: txQuery } as never);
    });
    const repository = new MaintenanceRepository({ transaction } as unknown as DatabaseService);
    await expect(repository.createOrder({ userId: '8', auditIp: '192.0.2.8', reason: 'Revisión' }))
      .resolves.toMatchObject({ id: '71', vehicleId: '22', state: 'ABIERTA', blocksVehicle: true });
    expect(auditContexts).toEqual([{ userId: '8', ip: '192.0.2.8' }]);
    const [sql, values] = txQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('FOR UPDATE OF a, v');
    expect(sql).toContain('INSERT INTO gacor.ordenes_mantenimiento (vehiculo_id, ingresado_por_id, motivo, observaciones)');
    expect(values).toEqual(['8', 'Revisión', null]);
  });

  it('rejects missing assignment and maps the real active blocking unique index', async () => {
    const txQuery = vi.fn().mockResolvedValue({ rows: [] });
    const noAssignmentDb = { transaction: async (work: (tx: never) => Promise<unknown>) => work({ query: txQuery } as never) };
    await expect(new MaintenanceRepository(noAssignmentDb as unknown as DatabaseService)
      .createOrder({ userId: '8', auditIp: '192.0.2.8' })).rejects.toBeInstanceOf(NoAssignedVehicleForMaintenanceError);

    const duplicateDb = { transaction: async () => { throw { code: '23505', constraint: 'uq_orden_bloqueante_activa_vehiculo' }; } };
    await expect(new MaintenanceRepository(duplicateDb as unknown as DatabaseService)
      .createOrder({ userId: '8', auditIp: '192.0.2.8' })).rejects.toBeInstanceOf(ActiveBlockingMaintenanceOrderError);
  });

  it('uses official tables, constraints, view, and trigger behavior', () => {
    const schema = readFileSync(resolve(process.cwd(), 'docs/GACOR_DERCAS_PostgreSQL_v3_GPS.sql'), 'utf8');
    expect(schema).toContain('CREATE TABLE ordenes_mantenimiento');
    expect(schema).toContain('CREATE TABLE detalle_mantenimiento');
    expect(schema).toContain('CREATE TABLE planes_mantenimiento');
    expect(schema).toContain('CREATE TABLE tipos_mantenimiento');
    expect(schema).toContain('CREATE OR REPLACE VIEW vw_estado_mantenimiento');
    expect(schema).toContain("WHERE bloquea_vehiculo=TRUE AND estado IN ('ABIERTA','EN_MANTENIMIENTO')");
    expect(schema).toContain('CREATE TRIGGER trg_sincronizar_estado_mantenimiento_vehiculo');
    expect(schema).toContain("UPDATE vehiculos SET estado_operativo='MANTENIMIENTO'");
  });
});
