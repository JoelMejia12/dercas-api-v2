import { describe, expect, it, vi } from 'vitest';
import { UsersListQueryDto } from './users.dto';
import { UsersRepository } from './users.repository';

function repositoryWith(rows: unknown[]) {
  const query = vi.fn().mockResolvedValue({ rows });
  return { repository: new UsersRepository({ query } as never), query };
}

describe('UsersRepository', () => {
  it('loads a profile without selecting credential or token fields', async () => {
    const { repository, query } = repositoryWith([{ id: '9007199254740993', employee_code: 'E1', first_name: 'A', last_name: 'B', email: 'a@example.test', title: null, department: null, phone: null, photo_url: null, active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z' }]);
    const profile = await repository.findProfile('9007199254740993');
    expect(profile?.id).toBe('9007199254740993');
    expect(query.mock.calls[0]![0]).not.toContain('password_hash');
    expect(query.mock.calls[0]![0]).not.toContain('refresh_token_hash');
    expect(query.mock.calls[0]![1]).toEqual(['9007199254740993']);
  });

  it('returns empty effective access when no active roles or permissions exist', async () => {
    const { repository, query } = repositoryWith([{ roles: [], permissions: [] }]);
    expect(await repository.findAccess('5')).toEqual({ roles: [], permissions: [] });
    const sql = query.mock.calls[0]![0] as string;
    expect(sql).toContain('gacor.usuario_rol');
    expect(sql).toContain('r.activo = TRUE');
    expect(sql).toContain('p.activo = TRUE');
  });

  it('derives effective access from active roles and permissions only', async () => {
    const { repository, query } = repositoryWith([{ roles: [{ id: '3', code: 'PILOTO', name: 'Piloto' }], permissions: [{ id: '5', code: 'VEHICULO_USAR_ASIGNADO', name: 'Usar vehículo asignado' }] }]);
    await expect(repository.findAccess('8')).resolves.toEqual({
      roles: [{ id: '3', code: 'PILOTO', name: 'Piloto' }],
      permissions: [{ id: '5', code: 'VEHICULO_USAR_ASIGNADO', name: 'Usar vehículo asignado' }],
    });
    expect(query.mock.calls[0]![0]).toContain('gacor.rol_permiso');
    expect(query.mock.calls[0]![0]).toContain('p.activo = TRUE');
  });

  it('filters, paginates and orders user listing deterministically', async () => {
    const { repository, query } = repositoryWith([]);
    const dto = Object.assign(new UsersListQueryDto(), { active: false, q: 'Lopez', limit: 10, offset: 20 });
    expect(await repository.findUsers(dto)).toEqual({ items: [], hasMore: false });
    const [sql, params] = query.mock.calls[0]!;
    expect(sql).toContain('ORDER BY apellidos ASC, nombres ASC, id ASC');
    expect(sql).toContain('activo = $1::boolean');
    expect(params).toEqual([false, 'Lopez', 11, 20]);
  });

  it('does not execute a detail query for an invalid bigint ID', async () => {
    const { repository, query } = repositoryWith([]);
    await expect(repository.findUserById('1.0')).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
});
