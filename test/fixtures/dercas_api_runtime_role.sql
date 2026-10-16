-- Apply only to the disposable localhost dercas_journey_test database.
-- This is an API runtime ACL fixture, not a schema migration.
DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dercas_api_runtime') THEN
    CREATE ROLE dercas_api_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  ELSE
    ALTER ROLE dercas_api_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$role$;

GRANT CONNECT ON DATABASE dercas_journey_test TO dercas_api_runtime;
GRANT USAGE ON SCHEMA gacor TO dercas_api_runtime;

GRANT SELECT ON TABLE
  gacor.usuarios,
  gacor.dispositivos,
  gacor.roles,
  gacor.permisos,
  gacor.usuario_rol,
  gacor.rol_permiso,
  gacor.sesiones_dispositivo,
  gacor.brigadas,
  gacor.asignaciones_vehiculo,
  gacor.vehiculos,
  gacor.lecturas_odometro,
  gacor.movimientos_vehiculo,
  gacor.jornadas,
  gacor.cargas_combustible,
  gacor.gasolineras,
  gacor.prestamos_administrativos,
  gacor.incidencias,
  gacor.heartbeats_dispositivo,
  gacor.sesiones_seguimiento,
  gacor.ultima_posicion_gps,
  gacor.vw_estado_dispositivos,
  gacor.vw_ultimo_kilometraje_vehiculo
TO dercas_api_runtime;

GRANT INSERT ON TABLE
  gacor.sesiones_dispositivo,
  gacor.lecturas_odometro,
  gacor.movimientos_vehiculo,
  gacor.jornadas,
  gacor.cargas_combustible,
  gacor.incidencias,
  gacor.bitacora
TO dercas_api_runtime;

REVOKE UPDATE ON TABLE
  gacor.usuarios,
  gacor.dispositivos,
  gacor.sesiones_dispositivo,
  gacor.movimientos_vehiculo,
  gacor.jornadas
FROM dercas_api_runtime;

-- Column-scoped UPDATE grants follow the SQL written by AuthRepository/JourneysRepository.
GRANT UPDATE (ultimo_acceso_at) ON TABLE gacor.usuarios TO dercas_api_runtime;
GRANT UPDATE (usuario_asociado_id, autenticado, updated_at) ON TABLE gacor.dispositivos TO dercas_api_runtime;
GRANT UPDATE (estado, logout_at, refresh_token_hash, ip_logout) ON TABLE gacor.sesiones_dispositivo TO dercas_api_runtime;
GRANT UPDATE (estado, lectura_fin_id) ON TABLE gacor.movimientos_vehiculo TO dercas_api_runtime;
GRANT UPDATE (estado, observaciones_fin) ON TABLE gacor.jornadas TO dercas_api_runtime;

-- The journey-start repository uses SELECT ... FOR UPDATE OF assignment, vehicle.
GRANT UPDATE (id) ON TABLE gacor.asignaciones_vehiculo, gacor.vehiculos TO dercas_api_runtime;

DO $sequences$
DECLARE
  table_name TEXT;
  sequence_name REGCLASS;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'sesiones_dispositivo', 'lecturas_odometro', 'movimientos_vehiculo',
    'jornadas', 'cargas_combustible', 'incidencias', 'bitacora'
  ] LOOP
    sequence_name := pg_get_serial_sequence(format('gacor.%I', table_name), 'id')::regclass;
    IF sequence_name IS NOT NULL THEN
      EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO dercas_api_runtime', sequence_name);
    END IF;
  END LOOP;
END
$sequences$;
