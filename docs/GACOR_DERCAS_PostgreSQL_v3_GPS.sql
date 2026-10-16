-- GACOR S.A. - Sistema Integral de Gestion Vehicular
-- PostgreSQL 16+
-- Diseño basado en DERCAS v2.0 y flujos operativos definidos.

BEGIN;

-- Requerido para almacenar y consultar coordenadas GPS como datos geoespaciales.
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS gacor;
SET search_path TO gacor, public;

CREATE TYPE tipo_vehiculo_enum AS ENUM ('ADMINISTRATIVO','BRIGADA');
CREATE TYPE estado_operativo_vehiculo_enum AS ENUM ('DISPONIBLE','MANTENIMIENTO','FUERA_SERVICIO','BLOQUEADO');
CREATE TYPE estado_asignacion_enum AS ENUM ('ACTIVA','FINALIZADA','CANCELADA');
CREATE TYPE tipo_lectura_odometro_enum AS ENUM ('JORNADA_INICIO','JORNADA_FIN','PRESTAMO_INICIO','PRESTAMO_FIN','COMBUSTIBLE','MANTENIMIENTO_INICIO','MANTENIMIENTO_FIN','ASIGNACION_ENTREGA','ASIGNACION_DEVOLUCION','USO_ESPECIAL_INICIO','USO_ESPECIAL_FIN','CORRECCION');
CREATE TYPE tipo_movimiento_enum AS ENUM ('JORNADA_BRIGADA','PRESTAMO_ADMINISTRATIVO','MANTENIMIENTO','USO_ESPECIAL');
CREATE TYPE estado_movimiento_enum AS ENUM ('ABIERTO','FINALIZADO','CANCELADO');
CREATE TYPE estado_jornada_enum AS ENUM ('ABIERTA','FINALIZADA','ANULADA');
CREATE TYPE estado_prestamo_enum AS ENUM ('SOLICITADO','LLAVE_LIBERADA','LLAVE_RETIRADA','PENDIENTE_ODOMETRO','ACTIVO','PENDIENTE_RETORNO_LLAVE','FINALIZADO','CANCELADO');
CREATE TYPE estado_gabinete_enum AS ENUM ('ONLINE','OFFLINE','MANTENIMIENTO','ERROR');
CREATE TYPE estado_posicion_enum AS ENUM ('VACIA','OCUPADA','HABILITADA_RETORNO','HABILITADA_RETIRO','ERROR','FUERA_SERVICIO');
CREATE TYPE estado_llavero_enum AS ENUM ('EN_GABINETE','RETIRADO','BLOQUEADO','PERDIDO','INACTIVO');
CREATE TYPE tipo_evento_gabinete_enum AS ENUM ('LECTURA','LIBERACION','RETIRO','RETORNO_SOLICITADO','INGRESO_DETECTADO','BLOQUEO_CONFIRMADO','CAMBIO_POSICION','ERROR_CHIP','ERROR_INSERCION','LLAVE_INCORRECTA','TIMEOUT_RETORNO','APERTURA_ADMINISTRATIVA');
CREATE TYPE estado_orden_mantenimiento_enum AS ENUM ('ABIERTA','EN_MANTENIMIENTO','FINALIZADA','CANCELADA');
CREATE TYPE categoria_mantenimiento_enum AS ENUM ('PREVENTIVO','CORRECTIVO','REPARACION','OTRO');
CREATE TYPE tipo_incidencia_enum AS ENUM ('FALLA_VEHICULO','OBSERVACION_VEHICULO','ACCIDENTE','PANICO','OTRO');
CREATE TYPE prioridad_enum AS ENUM ('BAJA','MEDIA','ALTA','CRITICA');
CREATE TYPE estado_incidencia_enum AS ENUM ('ABIERTA','RECIBIDA','EN_ATENCION','CERRADA','CANCELADA');
CREATE TYPE estado_alerta_enum AS ENUM ('PENDIENTE','VISTA','EN_ATENCION','RESUELTA','DESCARTADA');
CREATE TYPE canal_notificacion_enum AS ENUM ('APP','PUSH','EMAIL','SMS');
CREATE TYPE estado_notificacion_enum AS ENUM ('PENDIENTE','ENVIADA','ENTREGADA','LEIDA','ERROR');
CREATE TYPE estado_sesion_dispositivo_enum AS ENUM ('ABIERTA','CERRADA','REVOCADA');
CREATE TYPE estado_dispositivo_enum AS ENUM ('ONLINE','RETRASADO','OFFLINE','INACTIVO');
CREATE TYPE estado_seguimiento_enum AS ENUM ('ACTIVO','PAUSADO','FINALIZADO','CANCELADO');
CREATE TYPE modo_seguimiento_enum AS ENUM ('ADAPTATIVO','FIJO');
CREATE TYPE estado_archivo_gps_enum AS ENUM ('GENERANDO','GENERADO','VERIFICADO','COPIADO_EXTERNO','ERROR','PURGADO');
CREATE TYPE estado_restauracion_gps_enum AS ENUM ('PENDIENTE','CARGANDO','LISTA','EXPIRADA','ELIMINADA','ERROR');

CREATE TABLE roles (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo VARCHAR(60) NOT NULL UNIQUE,
  nombre VARCHAR(120) NOT NULL,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE permisos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo VARCHAR(100) NOT NULL UNIQUE,
  nombre VARCHAR(150) NOT NULL,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE rol_permiso (
  rol_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permiso_id BIGINT NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
  PRIMARY KEY (rol_id, permiso_id)
);

CREATE TABLE usuarios (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo_empleado VARCHAR(50) UNIQUE,
  nombres VARCHAR(120) NOT NULL,
  apellidos VARCHAR(120) NOT NULL,
  correo VARCHAR(180) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  puesto VARCHAR(120),
  departamento VARCHAR(120),
  telefono VARCHAR(40),
  foto_perfil_url TEXT,
  foto_perfil_actualizada_at TIMESTAMPTZ,
  numero_licencia VARCHAR(80),
  tipo_licencia VARCHAR(40),
  vencimiento_licencia DATE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_acceso_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE usuario_rol (
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rol_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  asignado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario_id, rol_id)
);

-- El dispositivo conserva una identidad tecnica propia aunque el usuario cierre sesion.
-- usuario_asociado_id conserva el ultimo usuario asociado hasta que otro usuario inicie sesion.
CREATE TABLE dispositivos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  installation_uuid UUID NOT NULL UNIQUE,
  usuario_asociado_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  autenticado BOOLEAN NOT NULL DEFAULT FALSE,
  plataforma VARCHAR(30) NOT NULL DEFAULT 'ANDROID',
  fabricante VARCHAR(120),
  modelo VARCHAR(120),
  nombre_dispositivo VARCHAR(160),
  version_so VARCHAR(60),
  version_app VARCHAR(60),
  push_token TEXT,
  device_token_hash TEXT NOT NULL,
  estado estado_dispositivo_enum NOT NULL DEFAULT 'OFFLINE',
  gps_habilitado BOOLEAN,
  tracking_habilitado BOOLEAN NOT NULL DEFAULT FALSE,
  bateria_porcentaje SMALLINT CHECK (bateria_porcentaje IS NULL OR bateria_porcentaje BETWEEN 0 AND 100),
  tipo_red VARCHAR(40),
  ultima_ip INET,
  ultimo_heartbeat_at TIMESTAMPTZ,
  ultima_posicion_at TIMESTAMPTZ,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_dispositivos_usuario_asociado ON dispositivos(usuario_asociado_id) WHERE activo=TRUE;
CREATE INDEX idx_dispositivos_heartbeat ON dispositivos(ultimo_heartbeat_at DESC) WHERE activo=TRUE;

CREATE TABLE sesiones_dispositivo (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dispositivo_id BIGINT NOT NULL REFERENCES dispositivos(id) ON DELETE CASCADE,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  estado estado_sesion_dispositivo_enum NOT NULL DEFAULT 'ABIERTA',
  login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  logout_at TIMESTAMPTZ,
  refresh_token_hash TEXT,
  ip_login INET,
  ip_logout INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (logout_at IS NULL OR logout_at >= login_at)
);
CREATE UNIQUE INDEX uq_sesion_dispositivo_abierta ON sesiones_dispositivo(dispositivo_id) WHERE estado='ABIERTA';
CREATE INDEX idx_sesiones_dispositivo_usuario ON sesiones_dispositivo(usuario_id, login_at DESC);

-- Historico corto para diagnostico. El estado actual siempre esta tambien en dispositivos.
CREATE TABLE heartbeats_dispositivo (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dispositivo_id BIGINT NOT NULL REFERENCES dispositivos(id) ON DELETE CASCADE,
  usuario_asociado_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_hora_dispositivo TIMESTAMPTZ,
  fecha_hora_servidor TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bateria_porcentaje SMALLINT CHECK (bateria_porcentaje IS NULL OR bateria_porcentaje BETWEEN 0 AND 100),
  gps_habilitado BOOLEAN,
  tracking_habilitado BOOLEAN,
  tipo_red VARCHAR(40),
  version_app VARCHAR(60),
  metadata JSONB
);
CREATE INDEX idx_heartbeat_dispositivo_fecha ON heartbeats_dispositivo(dispositivo_id, fecha_hora_servidor DESC);

CREATE TABLE brigadas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nombre VARCHAR(120) NOT NULL,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE vehiculos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  brigada_id BIGINT REFERENCES brigadas(id) ON DELETE SET NULL,
  placa VARCHAR(30) NOT NULL UNIQUE,
  vin VARCHAR(80) UNIQUE,
  marca VARCHAR(80) NOT NULL,
  modelo VARCHAR(80),
  anio SMALLINT CHECK (anio IS NULL OR anio >= 1950),
  color VARCHAR(60),
  tipo tipo_vehiculo_enum NOT NULL,
  estado_operativo estado_operativo_vehiculo_enum NOT NULL DEFAULT 'DISPONIBLE',
  imagen_miniatura_url TEXT,
  observaciones TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_brigada_segun_tipo CHECK ((tipo='BRIGADA' AND brigada_id IS NOT NULL) OR tipo='ADMINISTRATIVO')
);

CREATE TABLE asignaciones_vehiculo (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehiculo_id BIGINT NOT NULL REFERENCES vehiculos(id) ON DELETE RESTRICT,
  piloto_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  asignado_por_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  fecha_hora_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_hora_fin TIMESTAMPTZ,
  estado estado_asignacion_enum NOT NULL DEFAULT 'ACTIVA',
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (fecha_hora_fin IS NULL OR fecha_hora_fin >= fecha_hora_inicio)
);
CREATE UNIQUE INDEX uq_asignacion_activa_vehiculo ON asignaciones_vehiculo(vehiculo_id) WHERE estado='ACTIVA';
CREATE UNIQUE INDEX uq_asignacion_activa_piloto ON asignaciones_vehiculo(piloto_id) WHERE estado='ACTIVA';

CREATE TABLE lecturas_odometro (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehiculo_id BIGINT NOT NULL REFERENCES vehiculos(id) ON DELETE RESTRICT,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  kilometraje NUMERIC(12,1) NOT NULL CHECK (kilometraje >= 0),
  tipo_lectura tipo_lectura_odometro_enum NOT NULL,
  fecha_hora_dispositivo TIMESTAMPTZ NOT NULL,
  fecha_hora_servidor TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  foto_url TEXT,
  valor_sugerido NUMERIC(12,1),
  motivo_diferencia TEXT,
  es_valida BOOLEAN NOT NULL DEFAULT TRUE,
  lectura_corregida_id BIGINT REFERENCES lecturas_odometro(id) ON DELETE RESTRICT,
  uuid_operacion UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_motivo_si_difiere CHECK (valor_sugerido IS NULL OR kilometraje=valor_sugerido OR NULLIF(BTRIM(motivo_diferencia),'') IS NOT NULL)
);
CREATE INDEX idx_lecturas_vehiculo_fecha ON lecturas_odometro(vehiculo_id, fecha_hora_servidor DESC) WHERE es_valida=TRUE;

CREATE TABLE movimientos_vehiculo (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehiculo_id BIGINT NOT NULL REFERENCES vehiculos(id) ON DELETE RESTRICT,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  autorizado_por_id BIGINT REFERENCES usuarios(id) ON DELETE RESTRICT,
  tipo tipo_movimiento_enum NOT NULL,
  estado estado_movimiento_enum NOT NULL DEFAULT 'ABIERTO',
  fecha_hora_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_hora_fin TIMESTAMPTZ,
  lectura_inicio_id BIGINT REFERENCES lecturas_odometro(id) ON DELETE RESTRICT,
  lectura_fin_id BIGINT REFERENCES lecturas_odometro(id) ON DELETE RESTRICT,
  motivo TEXT,
  observaciones TEXT,
  uuid_operacion UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (fecha_hora_fin IS NULL OR fecha_hora_fin >= fecha_hora_inicio),
  CHECK ((estado='ABIERTO' AND fecha_hora_fin IS NULL) OR estado IN ('FINALIZADO','CANCELADO'))
);
CREATE UNIQUE INDEX uq_movimiento_abierto_vehiculo ON movimientos_vehiculo(vehiculo_id) WHERE estado='ABIERTO';
CREATE UNIQUE INDEX uq_movimiento_abierto_usuario ON movimientos_vehiculo(usuario_id) WHERE estado='ABIERTO';
CREATE INDEX idx_movimientos_vehiculo_fecha ON movimientos_vehiculo(vehiculo_id, fecha_hora_inicio DESC);

-- ======================== SEGUIMIENTO GPS ===================================
-- El administrador elige un perfil o modo. En ADAPTATIVO la app decide el intervalo
-- segun movimiento/detencion respetando los valores configurados en el perfil.
CREATE TABLE perfiles_seguimiento (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo VARCHAR(60) NOT NULL UNIQUE,
  nombre VARCHAR(120) NOT NULL,
  modo modo_seguimiento_enum NOT NULL DEFAULT 'ADAPTATIVO',
  intervalo_movimiento_seg INTEGER NOT NULL CHECK (intervalo_movimiento_seg BETWEEN 5 AND 3600),
  intervalo_lento_seg INTEGER NOT NULL CHECK (intervalo_lento_seg BETWEEN 5 AND 3600),
  intervalo_detenido_seg INTEGER NOT NULL CHECK (intervalo_detenido_seg BETWEEN 5 AND 3600),
  intervalo_detenido_prolongado_seg INTEGER NOT NULL CHECK (intervalo_detenido_prolongado_seg BETWEEN 5 AND 3600),
  segundos_para_detenido_prolongado INTEGER NOT NULL DEFAULT 120 CHECK (segundos_para_detenido_prolongado >= 30),
  intervalo_heartbeat_seg INTEGER NOT NULL DEFAULT 60 CHECK (intervalo_heartbeat_seg BETWEEN 30 AND 3600),
  distancia_minima_m NUMERIC(8,2) NOT NULL DEFAULT 10 CHECK (distancia_minima_m >= 0),
  velocidad_movimiento_kmh NUMERIC(6,2) NOT NULL DEFAULT 5 CHECK (velocidad_movimiento_kmh >= 0),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sesiones_seguimiento (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dispositivo_id BIGINT NOT NULL REFERENCES dispositivos(id) ON DELETE RESTRICT,
  usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  vehiculo_id BIGINT REFERENCES vehiculos(id) ON DELETE SET NULL,
  movimiento_id BIGINT REFERENCES movimientos_vehiculo(id) ON DELETE SET NULL,
  perfil_id BIGINT NOT NULL REFERENCES perfiles_seguimiento(id) ON DELETE RESTRICT,
  habilitado_por_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  estado estado_seguimiento_enum NOT NULL DEFAULT 'ACTIVO',
  fecha_hora_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_hora_fin TIMESTAMPTZ,
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (fecha_hora_fin IS NULL OR fecha_hora_fin >= fecha_hora_inicio)
);
CREATE UNIQUE INDEX uq_seguimiento_activo_dispositivo ON sesiones_seguimiento(dispositivo_id) WHERE estado='ACTIVO';
CREATE INDEX idx_seguimiento_vehiculo_fecha ON sesiones_seguimiento(vehiculo_id, fecha_hora_inicio DESC);
CREATE INDEX idx_seguimiento_usuario_fecha ON sesiones_seguimiento(usuario_id, fecha_hora_inicio DESC);

-- Tabla particionada mensualmente. La PK incluye la fecha por requisito de PostgreSQL
-- para claves unicas sobre tablas particionadas.
CREATE TABLE posiciones_gps (
  id BIGINT GENERATED ALWAYS AS IDENTITY,
  fecha_hora_servidor TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sesion_seguimiento_id BIGINT NOT NULL REFERENCES sesiones_seguimiento(id) ON DELETE RESTRICT,
  dispositivo_id BIGINT NOT NULL REFERENCES dispositivos(id) ON DELETE RESTRICT,
  usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  vehiculo_id BIGINT REFERENCES vehiculos(id) ON DELETE SET NULL,
  movimiento_id BIGINT REFERENCES movimientos_vehiculo(id) ON DELETE SET NULL,
  ubicacion GEOGRAPHY(POINT,4326) NOT NULL,
  precision_metros NUMERIC(8,2) CHECK (precision_metros IS NULL OR precision_metros >= 0),
  velocidad_kmh NUMERIC(8,2) CHECK (velocidad_kmh IS NULL OR velocidad_kmh >= 0),
  rumbo_grados NUMERIC(6,2) CHECK (rumbo_grados IS NULL OR (rumbo_grados >= 0 AND rumbo_grados < 360)),
  altitud_metros NUMERIC(9,2),
  bateria_porcentaje SMALLINT CHECK (bateria_porcentaje IS NULL OR bateria_porcentaje BETWEEN 0 AND 100),
  fuente VARCHAR(30) NOT NULL DEFAULT 'GPS',
  fecha_hora_dispositivo TIMESTAMPTZ NOT NULL,
  uuid_operacion UUID NOT NULL,
  metadata JSONB,
  PRIMARY KEY (id, fecha_hora_servidor),
  UNIQUE (uuid_operacion, fecha_hora_servidor)
) PARTITION BY RANGE (fecha_hora_servidor);

-- Particion de seguridad para evitar perdida de puntos si no se creo aun el mes.
CREATE TABLE posiciones_gps_default PARTITION OF posiciones_gps DEFAULT;

CREATE INDEX idx_gps_dispositivo_fecha ON posiciones_gps(dispositivo_id, fecha_hora_servidor DESC);
CREATE INDEX idx_gps_vehiculo_fecha ON posiciones_gps(vehiculo_id, fecha_hora_servidor DESC) WHERE vehiculo_id IS NOT NULL;
CREATE INDEX idx_gps_usuario_fecha ON posiciones_gps(usuario_id, fecha_hora_servidor DESC) WHERE usuario_id IS NOT NULL;
CREATE INDEX idx_gps_ubicacion ON posiciones_gps USING GIST (ubicacion);
CREATE INDEX idx_gps_fecha_brin ON posiciones_gps USING BRIN (fecha_hora_servidor);

-- Una fila por dispositivo. Esta tabla hace que el mapa en tiempo real nunca tenga que
-- recorrer millones de puntos historicos.
CREATE TABLE ultima_posicion_gps (
  dispositivo_id BIGINT PRIMARY KEY REFERENCES dispositivos(id) ON DELETE CASCADE,
  posicion_gps_id BIGINT NOT NULL,
  posicion_fecha_hora_servidor TIMESTAMPTZ NOT NULL,
  sesion_seguimiento_id BIGINT NOT NULL REFERENCES sesiones_seguimiento(id) ON DELETE RESTRICT,
  usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  vehiculo_id BIGINT REFERENCES vehiculos(id) ON DELETE SET NULL,
  movimiento_id BIGINT REFERENCES movimientos_vehiculo(id) ON DELETE SET NULL,
  ubicacion GEOGRAPHY(POINT,4326) NOT NULL,
  precision_metros NUMERIC(8,2),
  velocidad_kmh NUMERIC(8,2),
  rumbo_grados NUMERIC(6,2),
  altitud_metros NUMERIC(9,2),
  bateria_porcentaje SMALLINT,
  fecha_hora_dispositivo TIMESTAMPTZ NOT NULL,
  fecha_hora_servidor TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ultima_gps_vehiculo ON ultima_posicion_gps(vehiculo_id) WHERE vehiculo_id IS NOT NULL;
CREATE INDEX idx_ultima_gps_fecha ON ultima_posicion_gps(fecha_hora_servidor DESC);
CREATE INDEX idx_ultima_gps_ubicacion ON ultima_posicion_gps USING GIST (ubicacion);

-- Politica de retencion GPS. Una sola fila activa controla el comportamiento general.
CREATE TABLE configuracion_gps (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id=1),
  meses_retencion_online SMALLINT NOT NULL DEFAULT 5 CHECK (meses_retencion_online BETWEEN 1 AND 24),
  meses_conservar_post_purga SMALLINT NOT NULL DEFAULT 1 CHECK (meses_conservar_post_purga BETWEEN 1 AND 12),
  dias_retencion_heartbeat SMALLINT NOT NULL DEFAULT 30 CHECK (dias_retencion_heartbeat BETWEEN 1 AND 365),
  horas_restauracion_temporal SMALLINT NOT NULL DEFAULT 2 CHECK (horas_restauracion_temporal BETWEEN 1 AND 24),
  storage_root VARCHAR(500) NOT NULL DEFAULT '/storage/gps-archive',
  requiere_backup_externo_antes_purga BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO configuracion_gps(id) VALUES (1);

-- Catalogo de archivos historicos. PostgreSQL solo guarda metadatos/rutas;
-- los archivos reales viven en /storage/gps-archive/ y opcionalmente en un respaldo externo.
CREATE TABLE archivos_gps (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  periodo_inicio DATE NOT NULL,
  periodo_fin DATE NOT NULL,
  storage_path TEXT NOT NULL,
  backup_path TEXT,
  formato VARCHAR(20) NOT NULL DEFAULT 'PARQUET',
  cantidad_registros BIGINT NOT NULL DEFAULT 0 CHECK (cantidad_registros >= 0),
  cantidad_dispositivos INTEGER,
  cantidad_usuarios INTEGER,
  cantidad_vehiculos INTEGER,
  tamano_bytes BIGINT CHECK (tamano_bytes IS NULL OR tamano_bytes >= 0),
  sha256 CHAR(64),
  estado estado_archivo_gps_enum NOT NULL DEFAULT 'GENERANDO',
  generado_por_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  generado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verificado_at TIMESTAMPTZ,
  copiado_externo_at TIMESTAMPTZ,
  purgado_at TIMESTAMPTZ,
  metadata JSONB,
  CHECK (periodo_inicio = date_trunc('month',periodo_inicio)::date),
  CHECK (periodo_fin = (date_trunc('month',periodo_inicio) + INTERVAL '1 month - 1 day')::date),
  UNIQUE (periodo_inicio, periodo_fin)
);

-- Cada restauracion representa una consulta historica temporal. El backend lee Parquet,
-- filtra solo usuario/vehiculo/rango solicitado e inserta exclusivamente esos puntos aqui.
CREATE TABLE restauraciones_gps (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  archivo_gps_id BIGINT NOT NULL REFERENCES archivos_gps(id) ON DELETE RESTRICT,
  solicitado_por_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  usuario_filtro_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  vehiculo_filtro_id BIGINT REFERENCES vehiculos(id) ON DELETE SET NULL,
  dispositivo_filtro_id BIGINT REFERENCES dispositivos(id) ON DELETE SET NULL,
  desde TIMESTAMPTZ NOT NULL,
  hasta TIMESTAMPTZ NOT NULL,
  estado estado_restauracion_gps_enum NOT NULL DEFAULT 'PENDIENTE',
  cantidad_registros BIGINT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_detalle TEXT,
  CHECK (hasta >= desde)
);

CREATE TABLE posiciones_gps_temporales (
  restauracion_id BIGINT NOT NULL REFERENCES restauraciones_gps(id) ON DELETE CASCADE,
  id BIGINT GENERATED ALWAYS AS IDENTITY,
  dispositivo_id BIGINT REFERENCES dispositivos(id) ON DELETE SET NULL,
  usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  vehiculo_id BIGINT REFERENCES vehiculos(id) ON DELETE SET NULL,
  ubicacion GEOGRAPHY(POINT,4326) NOT NULL,
  precision_metros NUMERIC(8,2),
  velocidad_kmh NUMERIC(8,2),
  rumbo_grados NUMERIC(6,2),
  altitud_metros NUMERIC(9,2),
  fecha_hora_dispositivo TIMESTAMPTZ NOT NULL,
  fecha_hora_servidor TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (restauracion_id, id)
);
CREATE INDEX idx_gps_temp_fecha ON posiciones_gps_temporales(restauracion_id, fecha_hora_servidor);
CREATE INDEX idx_gps_temp_ubicacion ON posiciones_gps_temporales USING GIST (ubicacion);

CREATE TABLE jornadas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  asignacion_id BIGINT NOT NULL REFERENCES asignaciones_vehiculo(id) ON DELETE RESTRICT,
  movimiento_id BIGINT NOT NULL UNIQUE REFERENCES movimientos_vehiculo(id) ON DELETE RESTRICT,
  estado estado_jornada_enum NOT NULL DEFAULT 'ABIERTA',
  observaciones_inicio TEXT,
  observaciones_fin TEXT,
  uuid_operacion UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE prestamos_administrativos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehiculo_id BIGINT NOT NULL REFERENCES vehiculos(id) ON DELETE RESTRICT,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  movimiento_id BIGINT UNIQUE REFERENCES movimientos_vehiculo(id) ON DELETE RESTRICT,
  fecha_hora_solicitud TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_hora_retiro_llave TIMESTAMPTZ,
  fecha_hora_inicio_uso TIMESTAMPTZ,
  fecha_hora_fin_uso TIMESTAMPTZ,
  fecha_hora_retorno_llave TIMESTAMPTZ,
  destino TEXT,
  motivo TEXT,
  observaciones_fin TEXT,
  estado estado_prestamo_enum NOT NULL DEFAULT 'SOLICITADO',
  uuid_operacion UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_prestamo_activo_vehiculo ON prestamos_administrativos(vehiculo_id) WHERE estado NOT IN ('FINALIZADO','CANCELADO');

CREATE TABLE gasolineras (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre VARCHAR(180) NOT NULL,
  direccion TEXT,
  latitud NUMERIC(9,6),
  longitud NUMERIC(9,6),
  autorizada BOOLEAN NOT NULL DEFAULT FALSE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (latitud IS NULL OR latitud BETWEEN -90 AND 90),
  CHECK (longitud IS NULL OR longitud BETWEEN -180 AND 180)
);

CREATE TABLE cargas_combustible (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  movimiento_id BIGINT NOT NULL REFERENCES movimientos_vehiculo(id) ON DELETE RESTRICT,
  lectura_odometro_id BIGINT NOT NULL REFERENCES lecturas_odometro(id) ON DELETE RESTRICT,
  gasolinera_id BIGINT REFERENCES gasolineras(id) ON DELETE SET NULL,
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  galones NUMERIC(10,3) NOT NULL CHECK (galones > 0),
  precio_galon NUMERIC(12,2) NOT NULL CHECK (precio_galon >= 0),
  total_pagado NUMERIC(12,2) NOT NULL CHECK (total_pagado >= 0),
  latitud NUMERIC(9,6),
  longitud NUMERIC(9,6),
  nombre_lugar_manual VARCHAR(180),
  observaciones TEXT,
  uuid_operacion UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (latitud IS NULL OR latitud BETWEEN -90 AND 90),
  CHECK (longitud IS NULL OR longitud BETWEEN -180 AND 180)
);
CREATE INDEX idx_combustible_movimiento_fecha ON cargas_combustible(movimiento_id, fecha_hora DESC);

CREATE TABLE gabinetes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  ubicacion TEXT,
  identificador_esp32 VARCHAR(120) NOT NULL UNIQUE,
  estado estado_gabinete_enum NOT NULL DEFAULT 'OFFLINE',
  ultima_conexion_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE llaveros (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehiculo_id BIGINT NOT NULL UNIQUE REFERENCES vehiculos(id) ON DELETE RESTRICT,
  chip_uid VARCHAR(160) NOT NULL UNIQUE,
  estado estado_llavero_enum NOT NULL DEFAULT 'EN_GABINETE',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE posiciones_gabinete (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  gabinete_id BIGINT NOT NULL REFERENCES gabinetes(id) ON DELETE CASCADE,
  numero_posicion SMALLINT NOT NULL CHECK (numero_posicion > 0),
  llavero_actual_id BIGINT UNIQUE REFERENCES llaveros(id) ON DELETE SET NULL,
  estado estado_posicion_enum NOT NULL DEFAULT 'VACIA',
  ultima_lectura_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (gabinete_id, numero_posicion)
);

CREATE TABLE eventos_gabinete (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  gabinete_id BIGINT NOT NULL REFERENCES gabinetes(id) ON DELETE RESTRICT,
  posicion_id BIGINT REFERENCES posiciones_gabinete(id) ON DELETE SET NULL,
  llavero_id BIGINT REFERENCES llaveros(id) ON DELETE SET NULL,
  vehiculo_id BIGINT REFERENCES vehiculos(id) ON DELETE SET NULL,
  usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  prestamo_id BIGINT REFERENCES prestamos_administrativos(id) ON DELETE SET NULL,
  tipo_evento tipo_evento_gabinete_enum NOT NULL,
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  chip_leido VARCHAR(160),
  resultado BOOLEAN NOT NULL DEFAULT TRUE,
  detalle JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_eventos_gabinete_fecha ON eventos_gabinete(gabinete_id, fecha_hora DESC);

CREATE TABLE talleres (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre VARCHAR(180) NOT NULL,
  nit VARCHAR(40),
  direccion TEXT,
  telefono VARCHAR(50),
  contacto VARCHAR(150),
  latitud NUMERIC(9,6),
  longitud NUMERIC(9,6),
  autorizado BOOLEAN NOT NULL DEFAULT TRUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tipos_mantenimiento (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre VARCHAR(160) NOT NULL UNIQUE,
  categoria categoria_mantenimiento_enum NOT NULL,
  descripcion TEXT,
  control_por_km BOOLEAN NOT NULL DEFAULT FALSE,
  control_por_tiempo BOOLEAN NOT NULL DEFAULT FALSE,
  intervalo_km_default NUMERIC(12,1),
  intervalo_dias_default INTEGER,
  requiere_modo_mantenimiento BOOLEAN NOT NULL DEFAULT FALSE,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE planes_mantenimiento (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehiculo_id BIGINT NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  tipo_mantenimiento_id BIGINT NOT NULL REFERENCES tipos_mantenimiento(id) ON DELETE RESTRICT,
  intervalo_km NUMERIC(12,1),
  intervalo_dias INTEGER,
  alertar_antes_km NUMERIC(12,1),
  alertar_antes_dias INTEGER,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vehiculo_id, tipo_mantenimiento_id)
);

CREATE TABLE ordenes_mantenimiento (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehiculo_id BIGINT NOT NULL REFERENCES vehiculos(id) ON DELETE RESTRICT,
  taller_id BIGINT REFERENCES talleres(id) ON DELETE SET NULL,
  movimiento_id BIGINT UNIQUE REFERENCES movimientos_vehiculo(id) ON DELETE RESTRICT,
  ingresado_por_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  fecha_hora_ingreso TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_hora_salida TIMESTAMPTZ,
  estado estado_orden_mantenimiento_enum NOT NULL DEFAULT 'ABIERTA',
  bloquea_vehiculo BOOLEAN NOT NULL DEFAULT TRUE,
  motivo TEXT,
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (fecha_hora_salida IS NULL OR fecha_hora_salida >= fecha_hora_ingreso)
);
CREATE UNIQUE INDEX uq_orden_bloqueante_activa_vehiculo ON ordenes_mantenimiento(vehiculo_id) WHERE bloquea_vehiculo=TRUE AND estado IN ('ABIERTA','EN_MANTENIMIENTO');

CREATE TABLE detalle_mantenimiento (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  orden_mantenimiento_id BIGINT NOT NULL REFERENCES ordenes_mantenimiento(id) ON DELETE CASCADE,
  tipo_mantenimiento_id BIGINT REFERENCES tipos_mantenimiento(id) ON DELETE SET NULL,
  plan_mantenimiento_id BIGINT REFERENCES planes_mantenimiento(id) ON DELETE SET NULL,
  lectura_odometro_id BIGINT REFERENCES lecturas_odometro(id) ON DELETE RESTRICT,
  descripcion TEXT NOT NULL,
  cantidad NUMERIC(12,3) NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  costo_repuestos NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (costo_repuestos >= 0),
  costo_mano_obra NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (costo_mano_obra >= 0),
  costo_otros NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (costo_otros >= 0),
  intervalo_proximo_km NUMERIC(12,1),
  intervalo_proximo_dias INTEGER,
  realizado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE incidencias (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehiculo_id BIGINT REFERENCES vehiculos(id) ON DELETE SET NULL,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  responsable_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  movimiento_id BIGINT REFERENCES movimientos_vehiculo(id) ON DELETE SET NULL,
  tipo tipo_incidencia_enum NOT NULL,
  prioridad prioridad_enum NOT NULL DEFAULT 'MEDIA',
  descripcion TEXT NOT NULL,
  latitud NUMERIC(9,6),
  longitud NUMERIC(9,6),
  estado estado_incidencia_enum NOT NULL DEFAULT 'ABIERTA',
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_cierre TIMESTAMPTZ,
  uuid_operacion UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE seguimiento_incidencia (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  incidencia_id BIGINT NOT NULL REFERENCES incidencias(id) ON DELETE CASCADE,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  estado_anterior estado_incidencia_enum,
  estado_nuevo estado_incidencia_enum NOT NULL,
  comentario TEXT,
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE evidencias (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  tipo_entidad VARCHAR(60) NOT NULL,
  entidad_id BIGINT NOT NULL,
  tipo_evidencia VARCHAR(80) NOT NULL,
  archivo_url TEXT NOT NULL,
  nombre_archivo VARCHAR(255),
  mime_type VARCHAR(120),
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);
CREATE INDEX idx_evidencias_entidad ON evidencias(tipo_entidad, entidad_id);

CREATE TABLE alertas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo VARCHAR(100) NOT NULL,
  prioridad prioridad_enum NOT NULL DEFAULT 'MEDIA',
  vehiculo_id BIGINT REFERENCES vehiculos(id) ON DELETE SET NULL,
  usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo_entidad VARCHAR(60),
  entidad_id BIGINT,
  titulo VARCHAR(200) NOT NULL,
  mensaje TEXT NOT NULL,
  estado estado_alerta_enum NOT NULL DEFAULT 'PENDIENTE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX idx_alertas_estado_prioridad ON alertas(estado, prioridad, created_at DESC);

CREATE TABLE notificaciones (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alerta_id BIGINT NOT NULL REFERENCES alertas(id) ON DELETE CASCADE,
  destinatario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  canal canal_notificacion_enum NOT NULL DEFAULT 'APP',
  estado estado_notificacion_enum NOT NULL DEFAULT 'PENDIENTE',
  fecha_envio TIMESTAMPTZ,
  fecha_entrega TIMESTAMPTZ,
  fecha_lectura TIMESTAMPTZ,
  error_detalle TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notificaciones_destinatario ON notificaciones(destinatario_id, estado, created_at DESC);

CREATE TABLE bitacora (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  entidad VARCHAR(80) NOT NULL,
  entidad_id BIGINT,
  accion VARCHAR(80) NOT NULL,
  valor_anterior JSONB,
  valor_nuevo JSONB,
  motivo TEXT,
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dispositivo TEXT,
  ip INET,
  resultado VARCHAR(60)
);
CREATE INDEX idx_bitacora_entidad ON bitacora(entidad, entidad_id, fecha_hora DESC);

-- ======================== VISTAS ============================================
CREATE OR REPLACE VIEW vw_ultimo_kilometraje_vehiculo AS
SELECT DISTINCT ON (lo.vehiculo_id)
  lo.vehiculo_id, lo.id AS lectura_odometro_id, lo.kilometraje, lo.tipo_lectura, lo.fecha_hora_servidor
FROM lecturas_odometro lo
WHERE lo.es_valida=TRUE
ORDER BY lo.vehiculo_id, lo.fecha_hora_servidor DESC, lo.id DESC;

CREATE OR REPLACE VIEW vw_movimientos_detalle AS
SELECT mv.id, mv.vehiculo_id, mv.usuario_id, mv.tipo, mv.estado,
       mv.fecha_hora_inicio, mv.fecha_hora_fin,
       li.kilometraje AS kilometraje_inicio,
       lf.kilometraje AS kilometraje_fin,
       CASE WHEN li.kilometraje IS NOT NULL AND lf.kilometraje IS NOT NULL
            THEN lf.kilometraje-li.kilometraje END AS kilometros_recorridos,
       mv.motivo, mv.observaciones
FROM movimientos_vehiculo mv
LEFT JOIN lecturas_odometro li ON li.id=mv.lectura_inicio_id
LEFT JOIN lecturas_odometro lf ON lf.id=mv.lectura_fin_id;

CREATE OR REPLACE VIEW vw_estado_gabinete AS
SELECT g.id AS gabinete_id, g.nombre AS gabinete,
       p.id AS posicion_id, p.numero_posicion, p.estado AS estado_posicion,
       l.id AS llavero_id, l.chip_uid,
       v.id AS vehiculo_id, v.placa, v.marca, v.modelo, v.estado_operativo
FROM gabinetes g
JOIN posiciones_gabinete p ON p.gabinete_id=g.id
LEFT JOIN llaveros l ON l.id=p.llavero_actual_id
LEFT JOIN vehiculos v ON v.id=l.vehiculo_id;

CREATE OR REPLACE VIEW vw_vehiculos_administrativos_disponibles AS
SELECT v.id AS vehiculo_id, v.placa, v.marca, v.modelo,
       p.gabinete_id, p.id AS posicion_id, p.numero_posicion,
       uk.kilometraje AS ultimo_kilometraje
FROM vehiculos v
JOIN llaveros l ON l.vehiculo_id=v.id
JOIN posiciones_gabinete p ON p.llavero_actual_id=l.id
LEFT JOIN vw_ultimo_kilometraje_vehiculo uk ON uk.vehiculo_id=v.id
WHERE v.tipo='ADMINISTRATIVO'
  AND v.activo=TRUE
  AND v.estado_operativo='DISPONIBLE'
  AND l.estado='EN_GABINETE'
  AND p.estado='OCUPADA'
  AND NOT EXISTS (
    SELECT 1 FROM prestamos_administrativos pa
    WHERE pa.vehiculo_id=v.id AND pa.estado NOT IN ('FINALIZADO','CANCELADO')
  );

CREATE OR REPLACE VIEW vw_ultimo_mantenimiento_realizado AS
SELECT DISTINCT ON (om.vehiculo_id, dm.tipo_mantenimiento_id)
       om.vehiculo_id, dm.tipo_mantenimiento_id,
       dm.id AS detalle_mantenimiento_id, dm.realizado_at,
       lo.kilometraje AS kilometraje_realizacion,
       dm.intervalo_proximo_km, dm.intervalo_proximo_dias
FROM detalle_mantenimiento dm
JOIN ordenes_mantenimiento om ON om.id=dm.orden_mantenimiento_id
LEFT JOIN lecturas_odometro lo ON lo.id=dm.lectura_odometro_id
WHERE om.estado='FINALIZADA'
ORDER BY om.vehiculo_id, dm.tipo_mantenimiento_id, dm.realizado_at DESC, dm.id DESC;

CREATE OR REPLACE VIEW vw_estado_mantenimiento AS
SELECT pm.id AS plan_id, pm.vehiculo_id, v.placa,
       pm.tipo_mantenimiento_id, tm.nombre AS mantenimiento,
       uk.kilometraje AS kilometraje_actual,
       umr.kilometraje_realizacion AS kilometraje_ultimo_servicio,
       COALESCE(umr.intervalo_proximo_km, pm.intervalo_km) AS intervalo_km,
       CASE WHEN umr.kilometraje_realizacion IS NOT NULL AND COALESCE(umr.intervalo_proximo_km, pm.intervalo_km) IS NOT NULL
            THEN umr.kilometraje_realizacion + COALESCE(umr.intervalo_proximo_km, pm.intervalo_km) END AS proximo_kilometraje,
       CASE WHEN umr.kilometraje_realizacion IS NOT NULL AND COALESCE(umr.intervalo_proximo_km, pm.intervalo_km) IS NOT NULL AND uk.kilometraje IS NOT NULL
            THEN umr.kilometraje_realizacion + COALESCE(umr.intervalo_proximo_km, pm.intervalo_km) - uk.kilometraje END AS kilometros_restantes,
       CASE
         WHEN umr.kilometraje_realizacion IS NULL OR COALESCE(umr.intervalo_proximo_km, pm.intervalo_km) IS NULL OR uk.kilometraje IS NULL THEN 'SIN_DATOS'
         WHEN uk.kilometraje >= umr.kilometraje_realizacion + COALESCE(umr.intervalo_proximo_km, pm.intervalo_km) THEN 'VENCIDO'
         WHEN pm.alertar_antes_km IS NOT NULL AND uk.kilometraje >= umr.kilometraje_realizacion + COALESCE(umr.intervalo_proximo_km, pm.intervalo_km) - pm.alertar_antes_km THEN 'PROXIMO'
         ELSE 'AL_DIA'
       END AS estado_km
FROM planes_mantenimiento pm
JOIN vehiculos v ON v.id=pm.vehiculo_id
JOIN tipos_mantenimiento tm ON tm.id=pm.tipo_mantenimiento_id
LEFT JOIN vw_ultimo_kilometraje_vehiculo uk ON uk.vehiculo_id=pm.vehiculo_id
LEFT JOIN vw_ultimo_mantenimiento_realizado umr ON umr.vehiculo_id=pm.vehiculo_id AND umr.tipo_mantenimiento_id=pm.tipo_mantenimiento_id
WHERE pm.activo=TRUE;

CREATE OR REPLACE VIEW vw_costos_combustible_movimiento AS
SELECT mv.id AS movimiento_id, mv.vehiculo_id, mv.tipo,
       COUNT(cc.id) AS cargas,
       COALESCE(SUM(cc.galones),0) AS galones,
       COALESCE(SUM(cc.total_pagado),0) AS gasto_combustible
FROM movimientos_vehiculo mv
LEFT JOIN cargas_combustible cc ON cc.movimiento_id=mv.id
GROUP BY mv.id, mv.vehiculo_id, mv.tipo;

CREATE OR REPLACE VIEW vw_costos_mantenimiento AS
SELECT om.id AS orden_mantenimiento_id, om.vehiculo_id,
       COUNT(dm.id) AS trabajos,
       COALESCE(SUM(dm.costo_repuestos),0) AS costo_repuestos,
       COALESCE(SUM(dm.costo_mano_obra),0) AS costo_mano_obra,
       COALESCE(SUM(dm.costo_otros),0) AS costo_otros,
       COALESCE(SUM(dm.costo_repuestos+dm.costo_mano_obra+dm.costo_otros),0) AS costo_total
FROM ordenes_mantenimiento om
LEFT JOIN detalle_mantenimiento dm ON dm.orden_mantenimiento_id=om.id
GROUP BY om.id, om.vehiculo_id;

-- Estado actual para el mapa en tiempo real. ST_X = longitud, ST_Y = latitud.
CREATE OR REPLACE VIEW vw_mapa_vehiculos_tiempo_real AS
SELECT DISTINCT ON (up.vehiculo_id)
       up.vehiculo_id,
       v.placa, v.marca, v.modelo, v.imagen_miniatura_url,
       up.usuario_id,
       u.nombres, u.apellidos, u.foto_perfil_url,
       up.dispositivo_id,
       ST_Y(up.ubicacion::geometry) AS latitud,
       ST_X(up.ubicacion::geometry) AS longitud,
       up.precision_metros, up.velocidad_kmh, up.rumbo_grados,
       up.bateria_porcentaje,
       up.fecha_hora_dispositivo, up.fecha_hora_servidor,
       d.estado AS estado_dispositivo,
       d.ultimo_heartbeat_at,
       CASE
         WHEN d.ultimo_heartbeat_at IS NULL THEN 'OFFLINE'
         WHEN NOW()-d.ultimo_heartbeat_at <= INTERVAL '90 seconds' THEN 'ONLINE'
         WHEN NOW()-d.ultimo_heartbeat_at <= INTERVAL '3 minutes' THEN 'RETRASADO'
         ELSE 'OFFLINE'
       END AS conectividad_calculada
FROM ultima_posicion_gps up
JOIN vehiculos v ON v.id=up.vehiculo_id
JOIN dispositivos d ON d.id=up.dispositivo_id
LEFT JOIN usuarios u ON u.id=up.usuario_id
WHERE up.vehiculo_id IS NOT NULL
ORDER BY up.vehiculo_id, up.fecha_hora_servidor DESC;

CREATE OR REPLACE VIEW vw_estado_dispositivos AS
SELECT d.id AS dispositivo_id, d.installation_uuid, d.usuario_asociado_id,
       u.nombres, u.apellidos, u.foto_perfil_url,
       d.autenticado, d.fabricante, d.modelo, d.nombre_dispositivo,
       d.version_app, d.bateria_porcentaje, d.gps_habilitado, d.tracking_habilitado,
       d.tipo_red, d.ultimo_heartbeat_at, d.ultima_posicion_at,
       CASE
         WHEN d.activo=FALSE THEN 'INACTIVO'
         WHEN d.ultimo_heartbeat_at IS NULL THEN 'OFFLINE'
         WHEN NOW()-d.ultimo_heartbeat_at <= INTERVAL '90 seconds' THEN 'ONLINE'
         WHEN NOW()-d.ultimo_heartbeat_at <= INTERVAL '3 minutes' THEN 'RETRASADO'
         ELSE 'OFFLINE'
       END AS estado_calculado
FROM dispositivos d
LEFT JOIN usuarios u ON u.id=d.usuario_asociado_id;

-- Resumen de meses GPS presentes para que la API determine cuando se alcanzo la retencion.
CREATE OR REPLACE VIEW vw_retencion_gps AS
WITH r AS (
  SELECT date_trunc('month', MIN(fecha_hora_servidor))::date AS mes_mas_antiguo,
         date_trunc('month', MAX(fecha_hora_servidor))::date AS mes_mas_reciente,
         COUNT(*) AS registros_online,
         CASE WHEN MIN(fecha_hora_servidor) IS NULL THEN 0
              ELSE ((EXTRACT(YEAR FROM age(date_trunc('month',MAX(fecha_hora_servidor)),date_trunc('month',MIN(fecha_hora_servidor))))*12)
                   + EXTRACT(MONTH FROM age(date_trunc('month',MAX(fecha_hora_servidor)),date_trunc('month',MIN(fecha_hora_servidor)))) + 1)::INT END AS meses_online
  FROM posiciones_gps
)
SELECT r.*,
       c.meses_retencion_online,
       c.meses_conservar_post_purga,
       (r.meses_online >= c.meses_retencion_online) AS requiere_archivado,
       CASE WHEN r.mes_mas_reciente IS NULL THEN NULL
            ELSE (r.mes_mas_reciente - ((c.meses_conservar_post_purga-1)||' months')::INTERVAL)::date END AS conservar_desde_mes
FROM r CROSS JOIN configuracion_gps c
WHERE c.id=1;

CREATE OR REPLACE VIEW vw_meses_gps_archivables AS
SELECT date_trunc('month',p.fecha_hora_servidor)::date AS mes,
       COUNT(*) AS registros,
       COUNT(DISTINCT p.dispositivo_id) AS dispositivos,
       COUNT(DISTINCT p.usuario_id) FILTER (WHERE p.usuario_id IS NOT NULL) AS usuarios,
       COUNT(DISTINCT p.vehiculo_id) FILTER (WHERE p.vehiculo_id IS NOT NULL) AS vehiculos,
       MIN(p.fecha_hora_servidor) AS primera_posicion,
       MAX(p.fecha_hora_servidor) AS ultima_posicion,
       a.id AS archivo_gps_id,
       a.estado AS estado_archivo
FROM posiciones_gps p
CROSS JOIN configuracion_gps c
LEFT JOIN archivos_gps a
  ON a.periodo_inicio=date_trunc('month',p.fecha_hora_servidor)::date
 AND a.periodo_fin=(date_trunc('month',p.fecha_hora_servidor)+INTERVAL '1 month - 1 day')::date
WHERE date_trunc('month',p.fecha_hora_servidor)::date <
      (date_trunc('month',CURRENT_DATE) - ((c.meses_conservar_post_purga-1)||' months')::INTERVAL)::date
GROUP BY date_trunc('month',p.fecha_hora_servidor)::date,a.id,a.estado
ORDER BY mes;

-- ======================== TRIGGERS ==========================================
CREATE OR REPLACE FUNCTION fn_set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at=NOW(); RETURN NEW; END; $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['roles','usuarios','dispositivos','configuracion_gps','brigadas','vehiculos','asignaciones_vehiculo','movimientos_vehiculo','perfiles_seguimiento','sesiones_seguimiento','jornadas','prestamos_administrativos','gasolineras','gabinetes','llaveros','posiciones_gabinete','talleres','planes_mantenimiento','ordenes_mantenimiento','incidencias']
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()', t, t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION fn_validar_movimiento_odometro() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_ini BIGINT; v_fin BIGINT; km_ini NUMERIC(12,1); km_fin NUMERIC(12,1);
BEGIN
  IF NEW.lectura_inicio_id IS NOT NULL THEN
    SELECT vehiculo_id,kilometraje INTO v_ini,km_ini FROM lecturas_odometro WHERE id=NEW.lectura_inicio_id;
    IF v_ini<>NEW.vehiculo_id THEN RAISE EXCEPTION 'Lectura inicial no pertenece al vehiculo'; END IF;
  END IF;
  IF NEW.lectura_fin_id IS NOT NULL THEN
    SELECT vehiculo_id,kilometraje INTO v_fin,km_fin FROM lecturas_odometro WHERE id=NEW.lectura_fin_id;
    IF v_fin<>NEW.vehiculo_id THEN RAISE EXCEPTION 'Lectura final no pertenece al vehiculo'; END IF;
  END IF;
  IF km_ini IS NOT NULL AND km_fin IS NOT NULL AND km_fin<km_ini THEN RAISE EXCEPTION 'Kilometraje final menor al inicial'; END IF;
  IF NEW.estado='FINALIZADO' THEN
    IF NEW.lectura_inicio_id IS NULL OR NEW.lectura_fin_id IS NULL THEN RAISE EXCEPTION 'Movimiento finalizado requiere lectura inicial y final'; END IF;
    IF NEW.fecha_hora_fin IS NULL THEN NEW.fecha_hora_fin=NOW(); END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validar_movimiento_odometro BEFORE INSERT OR UPDATE ON movimientos_vehiculo FOR EACH ROW EXECUTE FUNCTION fn_validar_movimiento_odometro();

CREATE OR REPLACE FUNCTION fn_sincronizar_estado_posicion() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.llavero_actual_id IS NULL THEN
    IF NEW.estado='OCUPADA' THEN NEW.estado='VACIA'; END IF;
  ELSE
    NEW.estado='OCUPADA'; NEW.ultima_lectura_at=NOW();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_sincronizar_estado_posicion BEFORE INSERT OR UPDATE OF llavero_actual_id ON posiciones_gabinete FOR EACH ROW EXECUTE FUNCTION fn_sincronizar_estado_posicion();

-- Mantiene en dispositivos la asociacion con el ultimo usuario incluso despues del logout.
CREATE OR REPLACE FUNCTION fn_sincronizar_sesion_dispositivo() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    UPDATE dispositivos
       SET usuario_asociado_id=NEW.usuario_id,
           autenticado=(NEW.estado='ABIERTA'),
           updated_at=NOW()
     WHERE id=NEW.dispositivo_id;
  ELSIF TG_OP='UPDATE' THEN
    UPDATE dispositivos
       SET usuario_asociado_id=NEW.usuario_id,
           autenticado=(NEW.estado='ABIERTA'),
           updated_at=NOW()
     WHERE id=NEW.dispositivo_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_sincronizar_sesion_dispositivo
AFTER INSERT OR UPDATE OF estado,logout_at ON sesiones_dispositivo
FOR EACH ROW EXECUTE FUNCTION fn_sincronizar_sesion_dispositivo();

-- Actualiza el estado actual del dispositivo con cada heartbeat.
CREATE OR REPLACE FUNCTION fn_actualizar_dispositivo_heartbeat() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE dispositivos
     SET estado='ONLINE',
         bateria_porcentaje=COALESCE(NEW.bateria_porcentaje,bateria_porcentaje),
         gps_habilitado=COALESCE(NEW.gps_habilitado,gps_habilitado),
         tracking_habilitado=COALESCE(NEW.tracking_habilitado,tracking_habilitado),
         tipo_red=COALESCE(NEW.tipo_red,tipo_red),
         version_app=COALESCE(NEW.version_app,version_app),
         ultimo_heartbeat_at=NEW.fecha_hora_servidor,
         updated_at=NOW()
   WHERE id=NEW.dispositivo_id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_actualizar_dispositivo_heartbeat AFTER INSERT ON heartbeats_dispositivo
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_dispositivo_heartbeat();

-- Valida que un punto pertenezca a la sesion y completa usuario/vehiculo/movimiento desde ella.
CREATE OR REPLACE FUNCTION fn_validar_posicion_gps() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE s sesiones_seguimiento%ROWTYPE;
BEGIN
  SELECT * INTO s FROM sesiones_seguimiento WHERE id=NEW.sesion_seguimiento_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sesion de seguimiento inexistente'; END IF;
  IF s.dispositivo_id<>NEW.dispositivo_id THEN RAISE EXCEPTION 'El dispositivo no pertenece a la sesion de seguimiento'; END IF;
  IF s.estado<>'ACTIVO' THEN RAISE EXCEPTION 'La sesion de seguimiento no esta activa'; END IF;
  NEW.usuario_id:=COALESCE(NEW.usuario_id,s.usuario_id);
  NEW.vehiculo_id:=COALESCE(NEW.vehiculo_id,s.vehiculo_id);
  NEW.movimiento_id:=COALESCE(NEW.movimiento_id,s.movimiento_id);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validar_posicion_gps BEFORE INSERT ON posiciones_gps
FOR EACH ROW EXECUTE FUNCTION fn_validar_posicion_gps();

-- Mantiene solo la ultima posicion por dispositivo para mapa en tiempo real.
CREATE OR REPLACE FUNCTION fn_actualizar_ultima_posicion_gps() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO ultima_posicion_gps(
    dispositivo_id,posicion_gps_id,posicion_fecha_hora_servidor,sesion_seguimiento_id,
    usuario_id,vehiculo_id,movimiento_id,ubicacion,precision_metros,velocidad_kmh,
    rumbo_grados,altitud_metros,bateria_porcentaje,fecha_hora_dispositivo,fecha_hora_servidor,updated_at)
  VALUES(
    NEW.dispositivo_id,NEW.id,NEW.fecha_hora_servidor,NEW.sesion_seguimiento_id,
    NEW.usuario_id,NEW.vehiculo_id,NEW.movimiento_id,NEW.ubicacion,NEW.precision_metros,NEW.velocidad_kmh,
    NEW.rumbo_grados,NEW.altitud_metros,NEW.bateria_porcentaje,NEW.fecha_hora_dispositivo,NEW.fecha_hora_servidor,NOW())
  ON CONFLICT(dispositivo_id) DO UPDATE SET
    posicion_gps_id=EXCLUDED.posicion_gps_id,
    posicion_fecha_hora_servidor=EXCLUDED.posicion_fecha_hora_servidor,
    sesion_seguimiento_id=EXCLUDED.sesion_seguimiento_id,
    usuario_id=EXCLUDED.usuario_id,
    vehiculo_id=EXCLUDED.vehiculo_id,
    movimiento_id=EXCLUDED.movimiento_id,
    ubicacion=EXCLUDED.ubicacion,
    precision_metros=EXCLUDED.precision_metros,
    velocidad_kmh=EXCLUDED.velocidad_kmh,
    rumbo_grados=EXCLUDED.rumbo_grados,
    altitud_metros=EXCLUDED.altitud_metros,
    bateria_porcentaje=EXCLUDED.bateria_porcentaje,
    fecha_hora_dispositivo=EXCLUDED.fecha_hora_dispositivo,
    fecha_hora_servidor=EXCLUDED.fecha_hora_servidor,
    updated_at=NOW()
  WHERE EXCLUDED.fecha_hora_servidor >= ultima_posicion_gps.fecha_hora_servidor;

  UPDATE dispositivos
     SET ultima_posicion_at=NEW.fecha_hora_servidor,
         bateria_porcentaje=COALESCE(NEW.bateria_porcentaje,bateria_porcentaje),
         tracking_habilitado=TRUE,
         updated_at=NOW()
   WHERE id=NEW.dispositivo_id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_actualizar_ultima_posicion_gps AFTER INSERT ON posiciones_gps
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_ultima_posicion_gps();

-- Crea una particion mensual. Debe ejecutarse antes de mover registros del DEFAULT.
CREATE OR REPLACE FUNCTION fn_crear_particion_gps(p_mes DATE) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE inicio DATE:=date_trunc('month',p_mes)::date;
        fin DATE:=(date_trunc('month',p_mes)+INTERVAL '1 month')::date;
        nombre TEXT:='posiciones_gps_'||to_char(inicio,'YYYY_MM');
BEGIN
  IF to_regclass('gacor.'||nombre) IS NULL THEN
    EXECUTE format('CREATE TABLE gacor.%I PARTITION OF gacor.posiciones_gps FOR VALUES FROM (%L) TO (%L)',nombre,inicio,fin);
  END IF;
  RETURN nombre;
END $$;

-- Limpieza de datos temporales historicos expirados.
CREATE OR REPLACE FUNCTION fn_limpiar_gps_temporal() RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE n INTEGER;
BEGIN
  DELETE FROM restauraciones_gps
   WHERE expires_at<NOW() AND estado IN ('LISTA','EXPIRADA','ERROR');
  GET DIAGNOSTICS n=ROW_COUNT;
  RETURN n;
END $$;

-- Mantener solo 30 dias de historico de heartbeat; el ultimo estado permanece en dispositivos.
CREATE OR REPLACE FUNCTION fn_limpiar_heartbeats(p_dias INTEGER DEFAULT 30) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE n BIGINT;
BEGIN
  DELETE FROM heartbeats_dispositivo WHERE fecha_hora_servidor < NOW()-(p_dias||' days')::INTERVAL;
  GET DIAGNOSTICS n=ROW_COUNT;
  RETURN n;
END $$;

-- Audita exclusivamente cambios de foto de perfil sin copiar password_hash a bitacora.
CREATE OR REPLACE FUNCTION fn_auditar_foto_perfil_usuario() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_usuario_id BIGINT;
BEGIN
  IF NEW.foto_perfil_url IS DISTINCT FROM OLD.foto_perfil_url THEN
    BEGIN v_usuario_id:=NULLIF(current_setting('app.user_id',true),'')::BIGINT;
    EXCEPTION WHEN OTHERS THEN v_usuario_id:=NULL; END;
    INSERT INTO bitacora(usuario_id,entidad,entidad_id,accion,valor_anterior,valor_nuevo,fecha_hora,resultado)
    VALUES(v_usuario_id,'usuarios',NEW.id,'ACTUALIZAR_FOTO_PERFIL',
           jsonb_build_object('foto_perfil_url',OLD.foto_perfil_url),
           jsonb_build_object('foto_perfil_url',NEW.foto_perfil_url),NOW(),'OK');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_auditar_foto_perfil_usuario
AFTER UPDATE OF foto_perfil_url ON usuarios
FOR EACH ROW EXECUTE FUNCTION fn_auditar_foto_perfil_usuario();

-- Purga segura de un mes ya archivado. El archivo debe estar verificado y,
-- si la configuracion lo exige, copiado a un almacenamiento externo.
CREATE OR REPLACE FUNCTION fn_purgar_mes_gps(p_archivo_id BIGINT, p_usuario_id BIGINT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE a archivos_gps%ROWTYPE;
        c configuracion_gps%ROWTYPE;
        nombre TEXT;
        limite DATE;
BEGIN
  SELECT * INTO a FROM archivos_gps WHERE id=p_archivo_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Archivo GPS inexistente'; END IF;
  SELECT * INTO c FROM configuracion_gps WHERE id=1;

  IF a.estado NOT IN ('VERIFICADO','COPIADO_EXTERNO') THEN
    RAISE EXCEPTION 'El archivo debe estar VERIFICADO antes de purgar';
  END IF;
  IF c.requiere_backup_externo_antes_purga AND a.estado<>'COPIADO_EXTERNO' THEN
    RAISE EXCEPTION 'Se requiere copia externa antes de purgar';
  END IF;

  limite := (date_trunc('month',CURRENT_DATE) - ((c.meses_conservar_post_purga-1)||' months')::INTERVAL)::date;
  IF a.periodo_inicio >= limite THEN
    RAISE EXCEPTION 'Este mes debe conservarse en PostgreSQL segun la politica actual';
  END IF;

  nombre := 'posiciones_gps_'||to_char(a.periodo_inicio,'YYYY_MM');
  IF to_regclass('gacor.'||nombre) IS NULL THEN
    RAISE EXCEPTION 'No existe la particion mensual %',nombre;
  END IF;

  EXECUTE format('DROP TABLE gacor.%I',nombre);
  UPDATE archivos_gps SET estado='PURGADO',purgado_at=NOW() WHERE id=a.id;
  INSERT INTO bitacora(usuario_id,entidad,entidad_id,accion,valor_anterior,valor_nuevo,resultado)
  VALUES(p_usuario_id,'archivos_gps',a.id,'PURGAR_GPS_MES',
         jsonb_build_object('periodo_inicio',a.periodo_inicio,'periodo_fin',a.periodo_fin),
         jsonb_build_object('particion',nombre,'estado','PURGADO'),'OK');
  RETURN nombre;
END $$;

CREATE OR REPLACE FUNCTION fn_sincronizar_estado_mantenimiento_vehiculo() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.bloquea_vehiculo=TRUE AND NEW.estado IN ('ABIERTA','EN_MANTENIMIENTO') THEN
    UPDATE vehiculos SET estado_operativo='MANTENIMIENTO' WHERE id=NEW.vehiculo_id;
  ELSIF NEW.estado IN ('FINALIZADA','CANCELADA') THEN
    IF NOT EXISTS (SELECT 1 FROM ordenes_mantenimiento om WHERE om.vehiculo_id=NEW.vehiculo_id AND om.id<>NEW.id AND om.bloquea_vehiculo=TRUE AND om.estado IN ('ABIERTA','EN_MANTENIMIENTO')) THEN
      UPDATE vehiculos SET estado_operativo='DISPONIBLE' WHERE id=NEW.vehiculo_id AND estado_operativo='MANTENIMIENTO';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_sincronizar_estado_mantenimiento_vehiculo AFTER INSERT OR UPDATE OF estado,bloquea_vehiculo ON ordenes_mantenimiento FOR EACH ROW EXECUTE FUNCTION fn_sincronizar_estado_mantenimiento_vehiculo();

-- Auditoria generica. La API puede ejecutar SET LOCAL app.user_id='123'; SET LOCAL app.ip='10.0.0.1';
CREATE OR REPLACE FUNCTION fn_auditar_cambios() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_usuario_id BIGINT; v_ip INET; v_id BIGINT;
BEGIN
  BEGIN v_usuario_id:=NULLIF(current_setting('app.user_id',true),'')::BIGINT; EXCEPTION WHEN OTHERS THEN v_usuario_id:=NULL; END;
  BEGIN v_ip:=NULLIF(current_setting('app.ip',true),'')::INET; EXCEPTION WHEN OTHERS THEN v_ip:=NULL; END;
  IF TG_OP='DELETE' THEN v_id:=OLD.id; INSERT INTO bitacora(usuario_id,entidad,entidad_id,accion,valor_anterior,ip,resultado) VALUES(v_usuario_id,TG_TABLE_NAME,v_id,TG_OP,to_jsonb(OLD),v_ip,'OK'); RETURN OLD;
  ELSIF TG_OP='UPDATE' THEN v_id:=NEW.id; INSERT INTO bitacora(usuario_id,entidad,entidad_id,accion,valor_anterior,valor_nuevo,ip,resultado) VALUES(v_usuario_id,TG_TABLE_NAME,v_id,TG_OP,to_jsonb(OLD),to_jsonb(NEW),v_ip,'OK'); RETURN NEW;
  ELSE v_id:=NEW.id; INSERT INTO bitacora(usuario_id,entidad,entidad_id,accion,valor_nuevo,ip,resultado) VALUES(v_usuario_id,TG_TABLE_NAME,v_id,TG_OP,to_jsonb(NEW),v_ip,'OK'); RETURN NEW;
  END IF;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['vehiculos','asignaciones_vehiculo','lecturas_odometro','movimientos_vehiculo','sesiones_seguimiento','archivos_gps','restauraciones_gps','jornadas','prestamos_administrativos','cargas_combustible','posiciones_gabinete','llaveros','eventos_gabinete','planes_mantenimiento','ordenes_mantenimiento','detalle_mantenimiento','incidencias','alertas']
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%I_audit AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION fn_auditar_cambios()', t, t);
  END LOOP;
END $$;

-- Señal interna PostgreSQL -> backend. El backend publica por WebSocket/MQTT.
CREATE OR REPLACE FUNCTION fn_notify_realtime() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE payload JSONB;
BEGIN
  payload:=jsonb_build_object('table',TG_TABLE_NAME,'operation',TG_OP,'id',CASE WHEN TG_OP='DELETE' THEN CASE WHEN TG_TABLE_NAME='ultima_posicion_gps' THEN OLD.dispositivo_id ELSE OLD.id END ELSE CASE WHEN TG_TABLE_NAME='ultima_posicion_gps' THEN NEW.dispositivo_id ELSE NEW.id END END,'timestamp',NOW());
  PERFORM pg_notify('gacor_realtime',payload::TEXT);
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER trg_eventos_gabinete_notify AFTER INSERT OR UPDATE ON eventos_gabinete FOR EACH ROW EXECUTE FUNCTION fn_notify_realtime();
CREATE TRIGGER trg_alertas_notify AFTER INSERT OR UPDATE ON alertas FOR EACH ROW EXECUTE FUNCTION fn_notify_realtime();
CREATE TRIGGER trg_prestamos_notify AFTER INSERT OR UPDATE ON prestamos_administrativos FOR EACH ROW EXECUTE FUNCTION fn_notify_realtime();
CREATE TRIGGER trg_posiciones_notify AFTER INSERT OR UPDATE ON posiciones_gabinete FOR EACH ROW EXECUTE FUNCTION fn_notify_realtime();
CREATE TRIGGER trg_ultima_gps_notify AFTER INSERT OR UPDATE ON ultima_posicion_gps FOR EACH ROW EXECUTE FUNCTION fn_notify_realtime();
CREATE TRIGGER trg_seguimiento_notify AFTER INSERT OR UPDATE ON sesiones_seguimiento FOR EACH ROW EXECUTE FUNCTION fn_notify_realtime();

-- Genera alertas de mantenimiento a partir de la vista. Puede llamarse tras una lectura valida o por scheduler.
CREATE OR REPLACE FUNCTION fn_generar_alertas_mantenimiento() RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE r RECORD; v_count INTEGER:=0; v_tipo TEXT;
BEGIN
  FOR r IN SELECT * FROM vw_estado_mantenimiento WHERE estado_km IN ('PROXIMO','VENCIDO') LOOP
    v_tipo:=CASE WHEN r.estado_km='VENCIDO' THEN 'MANTENIMIENTO_VENCIDO' ELSE 'MANTENIMIENTO_PROXIMO' END;
    IF NOT EXISTS (SELECT 1 FROM alertas a WHERE a.tipo=v_tipo AND a.vehiculo_id=r.vehiculo_id AND a.tipo_entidad='PLAN_MANTENIMIENTO' AND a.entidad_id=r.plan_id AND a.estado IN ('PENDIENTE','VISTA','EN_ATENCION')) THEN
      INSERT INTO alertas(tipo,prioridad,vehiculo_id,tipo_entidad,entidad_id,titulo,mensaje)
      VALUES(v_tipo,CASE WHEN r.estado_km='VENCIDO' THEN 'ALTA'::prioridad_enum ELSE 'MEDIA'::prioridad_enum END,r.vehiculo_id,'PLAN_MANTENIMIENTO',r.plan_id,
             CASE WHEN r.estado_km='VENCIDO' THEN 'Mantenimiento vencido' ELSE 'Mantenimiento proximo' END,
             CONCAT(r.mantenimiento,' - Vehiculo ',r.placa,'. Km actual: ',COALESCE(r.kilometraje_actual::TEXT,'N/D'),'. Objetivo: ',COALESCE(r.proximo_kilometraje::TEXT,'N/D'),'. Restante: ',COALESCE(r.kilometros_restantes::TEXT,'N/D'),' km.'));
      v_count:=v_count+1;
    END IF;
  END LOOP;
  RETURN v_count;
END $$;

-- Genera una alerta para administradores cuando el historico GPS online alcanza
-- el limite configurado (5 meses por defecto). El scheduler de Spring puede llamarla diariamente.
CREATE OR REPLACE FUNCTION fn_generar_alerta_retencion_gps() RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE r RECORD;
BEGIN
  SELECT * INTO r FROM vw_retencion_gps;
  IF r.requiere_archivado=TRUE THEN
    IF NOT EXISTS (
      SELECT 1 FROM alertas
       WHERE tipo='GPS_RETENCION' AND estado IN ('PENDIENTE','VISTA','EN_ATENCION')
    ) THEN
      INSERT INTO alertas(tipo,prioridad,titulo,mensaje)
      VALUES('GPS_RETENCION','ALTA','Archivo historico GPS requerido',
             CONCAT('Existen ',r.meses_online,' meses de GPS en linea. El limite configurado es ',
                    r.meses_retencion_online,'. Genere y verifique el archivo historico antes de purgar; ',
                    'despues de la purga deben conservarse ',r.meses_conservar_post_purga,' mes(es) en PostgreSQL.'));
      RETURN TRUE;
    END IF;
  END IF;
  RETURN FALSE;
END $$;

-- ======================== DATOS BASE ========================================
INSERT INTO roles(codigo,nombre,descripcion) VALUES
('ADMINISTRADOR','Administrador','Control total de la plataforma.'),
('ENCARGADO_VEHICULOS','Encargado de Vehiculos','Opera flota, gabinete, mantenimiento e incidencias.'),
('SUPERVISOR','Supervisor','Supervisa pilotos, alertas e incidencias.'),
('PILOTO_BRIGADA','Piloto de Brigada','Responsable habitual de un vehiculo de brigada.'),
('PILOTO_ADMINISTRATIVO','Piloto Administrativo','Puede solicitar vehiculos administrativos disponibles.'),
('OPERADOR_FLOTA','Operador de Flota','Puede movilizar cualquier vehiculo por autorizacion especial.');

INSERT INTO permisos(codigo,nombre) VALUES
('VEHICULO_USAR_ASIGNADO','Usar vehiculo asignado'),
('VEHICULO_USAR_ADMINISTRATIVO','Usar vehiculo administrativo'),
('VEHICULO_USAR_CUALQUIERA','Usar cualquier vehiculo'),
('JORNADA_INICIAR','Iniciar jornada'),
('JORNADA_FINALIZAR','Finalizar jornada'),
('COMBUSTIBLE_REPORTAR','Reportar combustible'),
('GABINETE_VER','Ver gabinete'),
('GABINETE_LIBERAR_LLAVE','Solicitar liberacion normal de llave'),
('GABINETE_LIBERACION_ESPECIAL','Liberacion especial de llave'),
('MANTENIMIENTO_CREAR','Crear mantenimiento'),
('MANTENIMIENTO_FINALIZAR','Finalizar mantenimiento'),
('INCIDENCIA_REPORTAR','Reportar incidencia'),
('REPORTES_VER','Ver reportes'),
('REPORTES_VER_TODOS','Ver reportes globales'),
('USUARIOS_ADMINISTRAR','Administrar usuarios'),
('ROLES_ADMINISTRAR','Administrar roles y permisos'),
('CONFIGURACION_ADMINISTRAR','Administrar configuracion del sistema'),
('GPS_VER_TIEMPO_REAL','Ver seguimiento GPS en tiempo real'),
('GPS_ADMINISTRAR','Habilitar, pausar y configurar seguimiento GPS'),
('GPS_HISTORICO_VER','Consultar historico GPS'),
('GPS_ARCHIVAR','Generar y verificar archivos historicos GPS'),
('GPS_PURGAR','Eliminar particiones GPS ya archivadas y verificadas'),
('DISPOSITIVOS_ADMINISTRAR','Administrar dispositivos moviles');


INSERT INTO perfiles_seguimiento(codigo,nombre,modo,intervalo_movimiento_seg,intervalo_lento_seg,intervalo_detenido_seg,intervalo_detenido_prolongado_seg,segundos_para_detenido_prolongado,intervalo_heartbeat_seg,distancia_minima_m,velocidad_movimiento_kmh) VALUES
('NORMAL','Normal','ADAPTATIVO',15,30,60,120,120,60,10,5),
('AHORRO','Ahorro de bateria','ADAPTATIVO',30,60,120,300,180,120,20,5),
('INTENSIVO','Seguimiento intensivo','ADAPTATIVO',5,10,30,60,60,30,5,3);

INSERT INTO tipos_mantenimiento(nombre,categoria,control_por_km,control_por_tiempo,intervalo_km_default,requiere_modo_mantenimiento) VALUES
('Cambio de aceite','PREVENTIVO',TRUE,FALSE,5000,TRUE),
('Cambio de llantas','PREVENTIVO',FALSE,FALSE,NULL,TRUE),
('Cambio de frenos','PREVENTIVO',FALSE,FALSE,NULL,TRUE),
('Cambio de liquido de frenos','PREVENTIVO',FALSE,FALSE,NULL,TRUE),
('Recarga de refrigerante','PREVENTIVO',FALSE,FALSE,NULL,FALSE),
('Cambio de plumillas','PREVENTIVO',FALSE,FALSE,NULL,FALSE),
('Reparacion de pinchazo','REPARACION',FALSE,FALSE,NULL,FALSE);


-- Crear particiones del mes actual y los proximos 6 meses.
SELECT fn_crear_particion_gps((date_trunc('month',CURRENT_DATE) + (n||' months')::INTERVAL)::date)
FROM generate_series(0,6) AS g(n);

COMMIT;

-- Consultas utiles:
-- SELECT * FROM gacor.vw_ultimo_kilometraje_vehiculo;
-- SELECT * FROM gacor.vw_vehiculos_administrativos_disponibles;
-- SELECT * FROM gacor.vw_estado_mantenimiento ORDER BY estado_km DESC, kilometros_restantes;
-- SELECT gacor.fn_generar_alertas_mantenimiento();
-- SELECT * FROM gacor.vw_mapa_vehiculos_tiempo_real;
-- SELECT * FROM gacor.vw_estado_dispositivos;
-- SELECT * FROM gacor.vw_retencion_gps;
-- SELECT * FROM gacor.vw_meses_gps_archivables;
-- SELECT gacor.fn_generar_alerta_retencion_gps();
-- SELECT gacor.fn_limpiar_heartbeats(30);
-- SELECT gacor.fn_limpiar_gps_temporal();
-- LISTEN gacor_realtime;
