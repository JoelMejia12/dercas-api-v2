import { describe, expect, it, vi } from 'vitest';
import { CabinetEventQueryDto, CabinetListQueryDto } from './cabinet.dto';
import { CabinetRepository } from './cabinet.repository';

function repoWith(rows: unknown[]) {
  const query = vi.fn().mockResolvedValue({ rows });
  return { repo: new CabinetRepository({ query } as never), query };
}

describe('CabinetRepository', () => {
  it('lists cabinets with stable ordering and bounded page parameters', async () => {
    const { repo, query } = repoWith([]);
    const page = await repo.findCabinets(Object.assign(new CabinetListQueryDto(), { limit: 10, offset: 20 }));
    expect(page).toEqual({ items: [], hasMore: false });
    expect(query.mock.calls[0]![0]).toContain('ORDER BY id ASC');
    expect(query.mock.calls[0]![1]).toEqual([11, 20]);
  });

  it('returns ordered positions and leaves an empty position unoccupied', async () => {
    const { repo, query } = repoWith([{ id: '3', cabinet_id: '2', number: 1, state: 'VACIA', last_read_at: null, keyring_id: null }]);
    const positions = await repo.findPositions('2');
    expect(positions?.[0]).toMatchObject({ id: '3', cabinetId: '2', keyring: null });
    expect(query.mock.calls[0]![0]).toContain('LEFT JOIN gacor.llaveros');
    expect(query.mock.calls[0]![1]).toEqual(['2']);
  });

  it('does not find a nonexistent cabinet and rejects invalid bigint identifiers', async () => {
    const { repo, query } = repoWith([]);
    await expect(repo.findPositions('01')).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
    expect(await repo.findPositions('2')).toBeNull();
  });

  it('uses parameterized event filters and deterministic time/id ordering', async () => {
    const { repo, query } = repoWith([]);
    const filters = Object.assign(new CabinetEventQueryDto(), { cabinetId: '12', type: 'RETIRO', result: false, limit: 5, offset: 10 });
    await repo.findEvents(filters);
    const [sql, params] = query.mock.calls[0]!;
    expect(sql).toContain('eg.gabinete_id = $1::bigint');
    expect(sql).toContain('eg.tipo_evento::text = $2::text');
    expect(sql).toContain('eg.resultado = $3::boolean');
    expect(sql).toContain('ORDER BY eg.fecha_hora DESC, eg.id DESC');
    expect(params).toEqual(['12', 'RETIRO', false, 6, 10]);
  });

  it('returns keyrings without assuming every key is currently in a cabinet', async () => {
    const { repo } = repoWith([{ id: '9', vehicle_id: '8', chip_uid: 'uid', state: 'RETIRADO', active: true, plate: 'P', make: 'M', model: null, operational_state: 'DISPONIBLE', position_id: null }]);
    const page = await repo.findKeyrings(new CabinetListQueryDto());
    expect(page.items[0]!.position).toBeNull();
  });
});
