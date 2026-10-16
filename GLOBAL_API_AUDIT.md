# Auditoría global de la API GACOR/DERCAS

Fecha: 2026-10-16. Alcance: inspección estática del árbol actual y del SQL oficial; pruebas ejecutadas solo en la DB local efímera verificada. Este bloque produjo informes; no cambió implementación, SQL ni base de datos compartida.

## Estado ejecutivo

- Stack comprobado: Node >=22, NestJS 11, TypeScript, Express, `pg` con SQL parametrizado, PostgreSQL/PostGIS, `class-validator`, Argon2 y Vitest. No se encontró ORM, migraciones ejecutables, Dockerfile, Compose ni CI en el árbol revisado.
- Hay 17 controladores y 72 operaciones HTTP bajo `/api/v1`. `evidence` y `reports` no tienen controladores/casos de uso. No existe módulo/controlador para otorgar roles; usuarios solo tienen lecturas propias y administración de lectura.
- `npm test`, typecheck, lint, build/OpenAPI y `sql:check` pasan actualmente. La suite de integración de lectura tuvo 12 aprobadas, 3 omitidas y 1 fallida por una expectativa inconsistente de su propio conteo SQL. La suite de dominio pasó 3/3 en entorno efímero.
- El insert GPS está bloqueado por defecto real del SQL oficial: SQLSTATE `42703` cuando `fn_notify_realtime` evalúa `NEW.id` en la tabla `ultima_posicion_gps`, que no contiene esa columna. La transacción completa se revierte.
- El SQL declara 6 roles y 23 permisos, pero no asigna permisos a roles ni usuarios. El HTTP usa `PermissionsGuard` y permisos del catálogo; la autorización efectiva depende de datos de provisión que no están definidos. La única asignación aprobada y ejercitada fue temporal para fixture local `PILOTO_BRIGADA`.
- El score reproducible de avance funcional es **49%** bajo la rúbrica explícita de este informe. No se calcula por conteo de pruebas ni de archivos.

## Reglas de evidencia

`Comprobado` significa inspeccionado en el árbol/SQL o ejecutado en la base efímera indicada. `Inferencia` identifica riesgo derivado del código, sin afirmar explotación o fallo de una instancia operativa. `No verificado` significa que no hubo evidencia suficiente. El SQL de referencia es `docs/GACOR_DERCAS_PostgreSQL_v3_GPS.sql`; no se modificó.

Estados del inventario: **V** = ruta existe y tiene evidencia funcional relevante (sin implicar despliegue certificado); **P** = ruta existe, cobertura parcial o solo unit/consulta/denegación; **A** = endpoint/caso de uso ausente; **B** = bloqueado por defecto o decisión externa. `U` significa unitarias del módulo/capa; `DB` integración PostgreSQL; `H` HTTP con Nest. La ausencia de `H+` significa que no hay prueba HTTP positiva específica, aunque pueda existir una respuesta 403 de denegación.

## Inventario completo por endpoint

Rutas relativas a `/api/v1`. En `Permiso/alcance`, `Auth` significa sesión Bearer activa; permisos separados por `+` son acumulativos. La pertenencia/ownership indicada es también un filtro de repositorio cuando la ruta es propia. `SQL` enumera las entidades centrales; los efectos laterales por triggers se resumen después. Las pruebas `U/DB/H` identifican capas existentes; los huecos se expresan en la última columna.

| Método y ruta | Estado | Permiso y alcance | SQL principal | Evidencia actual / falta principal |
|---|---|---|---|---|
| GET `/health/live` | V | público | proceso | H sin DB; falta prueba de despliegue |
| GET `/health/ready` | V | público | `SELECT 1` | H sin DB; falta DB caída real/supervisión |
| POST `/auth/sessions` | V | público; credencial + dispositivo | `usuarios`, `dispositivos`, `sesiones_dispositivo`, RBAC | U+DB+H; login/replay concurrente; falta rate limit y auditoría durable |
| POST `/auth/sessions/refresh` | V | refresh token/sesión | `sesiones_dispositivo`, `dispositivos` | U+DB+H; rotación/replay; falta concurrencia refresh/logout |
| POST `/auth/sessions/revoke` | V | Auth; propia | `sesiones_dispositivo`, trigger dispositivo | U+DB+H; revoke invalida access; carrera faltante |
| POST `/auth/sessions/logout` | V | Auth; propia | `sesiones_dispositivo`, trigger dispositivo | U+DB+H; logout invalida access; diferencia operativa revoke/logout pendiente |
| GET `/users/me` | V | Auth; perfil propio | `usuarios` | U+DB+H; omisión de hashes comprobada |
| GET `/users/me/access` | V | Auth; roles/permisos propios | `usuario_rol`, `roles`, `rol_permiso`, `permisos` | U+DB+H; grants de rol productivos sin definir |
| GET `/users` | P | Auth + `USUARIOS_ADMINISTRAR`; listado global paginado | `usuarios` | U+DB; HTTP positiva/admin ausente, alcance de PII por aprobar |
| GET `/users/:id` | P | Auth + `USUARIOS_ADMINISTRAR`; perfil global | `usuarios` | U+DB; HTTP positiva/admin ausente y proyección a revisar |
| GET `/users/:id/access` | P | Auth + `USUARIOS_ADMINISTRAR`; acceso global | `usuario_rol`, `roles`, `rol_permiso`, `permisos` | U+DB; HTTP positiva/admin ausente; no hay escritura RBAC |
| GET `/vehicles/assigned` | P | Auth + `VEHICULO_USAR_ASIGNADO`; asignado al usuario | `vehiculos`, `asignaciones_vehiculo`, vista de odómetro | U+DB; H solo denegación, positiva de lectura por HTTP ausente |
| GET `/vehicles/me/assignments` | P | Auth + `VEHICULO_USAR_ASIGNADO`; propio | `asignaciones_vehiculo`, `vehiculos` | U+DB+ownership de repositorio; H positiva ausente |
| GET `/vehicles/assigned/maintenance-status` | P | Auth + `VEHICULO_USAR_ASIGNADO`; vehículo asignado | `vehiculos`, mantenimiento/vistas | U+DB; H positiva ausente |
| GET `/vehicles/administrative/available` | P | Auth + `VEHICULO_USAR_ADMINISTRATIVO`; flota disponible | vista de disponibilidad, `vehiculos`, gabinete | U+DB; H solo denegación, positiva admin ausente |
| GET `/vehicles/administrative/available/:id` | P | Auth + `VEHICULO_USAR_ADMINISTRATIVO`; flota disponible | vista de disponibilidad, `vehiculos` | U+DB; H positiva/admin y caso fuera de alcance ausentes |
| GET `/assignments/me/active` | P | Auth + `VEHICULO_USAR_ASIGNADO`; propia | `asignaciones_vehiculo`, `vehiculos`, `brigadas` | U+DB+H positiva en flujo piloto; faltan estado vacío/IDOR HTTP dedicado |
| GET `/assignments/me/history` | P | Auth + `VEHICULO_USAR_ASIGNADO`; propia | `asignaciones_vehiculo`, `vehiculos` | U+DB+H denegación; positiva HTTP ausente |
| GET `/assignments/me/:id` | P | Auth + `VEHICULO_USAR_ASIGNADO`; propia | `asignaciones_vehiculo`, `vehiculos` | U+DB+ownership; H positivo y ajeno/inexistente diferenciado ausentes |
| POST `/journeys/me` | P | Auth + `VEHICULO_USAR_ASIGNADO` + `JORNADA_INICIAR`; asignación activa propia | `jornadas`, `movimientos_vehiculo`, asignación, odómetro | U+DB+H; inicio/replay/conflicto/404 sin asignación; falta 401 específico |
| PATCH `/journeys/:id/finish` | P | Auth + `VEHICULO_USAR_ASIGNADO` + `JORNADA_FINALIZAR`; jornada propia | jornadas, movimientos, odómetro, vehículo | U+DB+H; 200, 409 km, ajeno 404 y rollback; falta 403 por permiso específico y 401 dedicado |
| GET `/journeys/me/history` | P | Auth + `VEHICULO_USAR_ASIGNADO`; propias, orden fecha desc/ID desempate | `jornadas`, movimientos, vehículos | U+DB+H; positivo, filtro propietario, empate y DTO; faltan 401/contraste ajeno vs no existe por ID |
| GET `/journeys/me/current` | P | Auth + `VEHICULO_USAR_ASIGNADO`; jornada propia activa | `jornadas`, `movimientos_vehiculo`, asignación | U+DB+H; positiva/ausencia/segundo usuario; falta 401 específico |
| GET `/journeys/:id` | P | Auth + `VEHICULO_USAR_ASIGNADO`; propia | jornadas, movimientos, vehículo | U+DB+H; dueño 200 y ajeno 404; falta prueba separada ID inexistente vs ajeno y 401 |
| GET `/movements/me/assigned` | P | Auth + `VEHICULO_USAR_ASIGNADO`; propios/asignados | `movimientos_vehiculo`, jornadas, odómetro, préstamo | U+DB; H solo denegación; falta lectura HTTP positiva y filtros multiusuario |
| GET `/movements/me/assigned/open` | P | Auth + `VEHICULO_USAR_ASIGNADO`; movimiento abierto propio | movimientos, jornadas, asignación | U+DB; HTTP positiva/ausencia y carrera no verificadas |
| GET `/movements/me/assigned/:id` | P | Auth + `VEHICULO_USAR_ASIGNADO`; propio | movimientos, vehículo, jornada | U+DB+ownership repo; H positiva/IDOR dedicado ausente |
| GET `/movements/me/administrative` | P | Auth + `VEHICULO_USAR_ADMINISTRATIVO`; propios administrativos | movimientos, préstamo, vehículo, odómetro | U+DB; H positiva/admin ausente |
| GET `/movements/me/administrative/open` | P | Auth + `VEHICULO_USAR_ADMINISTRATIVO`; abierto propio | movimientos, préstamo | U+DB; H positiva/estado vacío ausente |
| GET `/movements/me/administrative/:id` | P | Auth + `VEHICULO_USAR_ADMINISTRATIVO`; propio | movimientos, préstamo, vehículo | U+DB; H positiva/IDOR ausente |
| GET `/odometer/me/history` | P | Auth + `VEHICULO_USAR_ASIGNADO`; alcance propio/asignación | `lecturas_odometro`, vehículos | U+DB+ownership repo; H positiva ausente |
| GET `/odometer/:id` | P | Auth + `VEHICULO_USAR_ASIGNADO`; lectura dentro del alcance | lecturas, vehículo, movimiento | U+DB+ownership repo; H positiva y casos IDOR ausentes |
| POST `/loans` | P | Auth + `VEHICULO_USAR_ADMINISTRATIVO`; solicitud propia | préstamos, vehículos, vista disponibilidad | U+DB; creación/replay/concurrencia; HTTP positiva y ciclo de decisión ausentes |
| GET `/loans/:id` | P | Auth + `VEHICULO_USAR_ADMINISTRATIVO`; solicitante | préstamos, vehículos | U+DB+ownership repo; HTTP positiva/IDOR ausentes |
| GET `/loans/me/active` | P | Auth + `VEHICULO_USAR_ADMINISTRATIVO`; propio | préstamos, vehículo | U+DB; HTTP positiva ausente |
| GET `/loans/me/history` | P | Auth + `VEHICULO_USAR_ADMINISTRATIVO`; propio | préstamos, vehículo | U+DB; HTTP positiva/orden contractual ausentes |
| GET `/loans/me/available-vehicles` | P | Auth + `VEHICULO_USAR_ADMINISTRATIVO`; vehículos elegibles | vista disponibilidad, gabinete, llaveros | U+DB; HTTP positiva y reglas físicas ausentes |
| GET `/fuel/me/history` | P | Auth + `COMBUSTIBLE_REPORTAR`; propio/alcance por movimiento | `cargas_combustible`, movimiento, odómetro | U+DB; no hay HTTP positiva de historial ni aislamiento dedicado |
| GET `/fuel/:id` | V | Auth + `COMBUSTIBLE_REPORTAR`; propietario/alcance | combustible, movimiento, vehículo | U+DB+H; dueño 200, otro 404 |
| POST `/fuel` | V | Auth + `COMBUSTIBLE_REPORTAR`; movimiento autorizado | combustible, movimiento, odómetro | U+DB+H; creación, conflicto de payload, replay concurrente y rollback |
| GET `/maintenance/me/orders` | P | Auth + `VEHICULO_USAR_ASIGNADO`; órdenes de vehículos asignados | órdenes, detalle, vehículo, vistas | U+DB; H positivo ausente |
| GET `/maintenance/me/orders/:id` | P | Auth + `VEHICULO_USAR_ASIGNADO`; orden en alcance | orden, detalle, vehículo | U+DB; H positivo/IDOR ausente |
| GET `/maintenance/me/plans` | P | Auth + `VEHICULO_USAR_ASIGNADO`; planes pertinentes | planes, tipos, vehículo | U+DB; H positivo y decisión de alcance ausentes |
| GET `/maintenance/me/alerts` | P | Auth + `VEHICULO_USAR_ASIGNADO`; alertas propias/en alcance | vistas mantenimiento, alertas | U+DB; H positivo ausente; falta job de generación |
| POST `/maintenance/me/orders` | P | Auth + `VEHICULO_USAR_ASIGNADO` + `MANTENIMIENTO_CREAR`; alcance de vehículo | orden, detalle, vehículo | U+DB; colisión índice parcial y trigger; H positivo/negativos ausentes |
| POST `/incidents` | V | Auth + `INCIDENCIA_REPORTAR`; propio, asignación/movimiento | incidencias, seguimiento, alerta | U+DB+H; creación/replay/IDOR por detalle; carga bajo HTTP concurrente |
| POST `/incidents/emergencies` | P | Auth + `INCIDENCIA_REPORTAR`; propio/ubicación | incidencias, seguimiento, alertas | U+DB; endpoint existe, HTTP positiva y flujo de emergencia ausentes |
| GET `/incidents/me/history` | P | Auth + `INCIDENCIA_REPORTAR`; propio | incidencias, seguimiento | U+DB; H positiva/lista no filtrada ausentes |
| GET `/incidents/:id` | V | Auth + `INCIDENCIA_REPORTAR`; propietario | incidencias, seguimiento, alertas | U+DB+H; dueño 200 y ajeno 404 |
| GET `/alerts/me` | P | Auth; propias según predicado SQL | alertas, notificaciones | U+DB; H denegación/aislamiento probado; positiva propia/alcance GPS ausentes |
| GET `/alerts/me/:id` | P | Auth; destinatario/propietario | alertas, notificaciones | U+DB+H negativa ajena 404; positiva propia HTTP ausente |
| GET `/notifications/me` | P | Auth; destinatario propio | notificaciones, alertas | U+DB; H positiva/lista entre dos usuarios ausente |
| GET `/notifications/me/:id` | P | Auth; destinatario propio | notificaciones, alertas | U+DB+H ajeno 404; positiva HTTP específica ausente |
| GET `/cabinet` | P | Auth + `GABINETE_VER`; gabinetes visibles | gabinetes, posiciones, estado | U+DB; HTTP verifica 403 sin grant; positiva con rol no probada; solo lectura |
| GET `/cabinet/keyrings` | P | Auth + `GABINETE_VER`; llaveros visibles | llaveros, gabinetes | U+DB; H positiva/aislamiento ausentes |
| GET `/cabinet/events` | P | Auth + `GABINETE_VER`; eventos según filtros | eventos_gabinete, gabinete | U+DB; H positiva/alcance y asociación usuario ausentes |
| GET `/cabinet/:id/positions` | P | Auth + `GABINETE_VER`; posiciones del gabinete | posiciones_gabinete, llaveros | U+DB; H positiva/IDOR ausentes; no existe comando físico |
| GET `/gps/me/latest` | P | Auth; posición propia | última posición, posiciones, dispositivo | U+DB+H positiva/JSON null; inserción no viable por trigger |
| GET `/gps/me/device-status` | P | Auth; dispositivo de sesión propia | dispositivos, heartbeat | U+DB+H positiva; faltan expiración/heartbeat y no filtrar token hash |
| GET `/gps/me/sessions` | P | Auth + `GPS_HISTORICO_VER`; sesiones propias | sesiones seguimiento | U+DB; H solo denegación, positiva no probada |
| GET `/gps/me/sessions/:id` | P | Auth + `GPS_HISTORICO_VER`; dueño de sesión | sesiones seguimiento | U+DB+ownership; H positivo/IDOR ausente |
| GET `/gps/me/sessions/:id/positions` | P | Auth + `GPS_HISTORICO_VER`; sesión propia | sesiones, posiciones GPS particionadas | U+DB; H positiva/paginación ausente |
| GET `/gps/me/restorations` | P | Auth + `GPS_HISTORICO_VER`; restauraciones propias | restauraciones, archivos, posiciones temporales | U+DB; H positiva ausente; flujo de restauración no implementado |
| GET `/gps/me/restorations/:id/positions` | P | Auth + `GPS_HISTORICO_VER`; dueño de restauración | restauraciones, posiciones temporales | U+DB; H positiva/IDOR ausentes |
| GET `/gps/vehicles/latest` | P | Auth + `GPS_VER_TIEMPO_REAL`; alcance flota aprobado | vista mapa, última posición | U+DB; HTTP positiva no probada; ubicación sensible |
| GET `/gps/vehicles/:vehicleId/positions` | P | Auth + `GPS_HISTORICO_VER`; flota/vehículo | posiciones GPS particionadas | U+DB; HTTP positiva, autorización por vehículo y límites temporales faltantes |
| GET `/gps/devices` | P | Auth + `DISPOSITIVOS_ADMINISTRAR`; inventario global | dispositivos, vista estado | U+DB; HTTP positiva ausente; no hay alta/revocación |
| GET `/gps/devices/:id` | P | Auth + `DISPOSITIVOS_ADMINISTRAR`; diagnóstico global | dispositivos, heartbeat/sesiones | U+DB; HTTP positiva y proyección de diagnóstico faltan |
| GET `/gps/configuration` | P | Auth + `GPS_ADMINISTRAR`; global | configuración GPS | U+DB; HTTP positiva ausente; no hay actualización |
| GET `/gps/profiles` | P | Auth + `GPS_ADMINISTRAR`; global | perfiles seguimiento | U+DB; HTTP positiva ausente; no hay CRUD |
| GET `/gps/archives` | P | Auth + `GPS_ARCHIVAR`; global | archivos GPS | U+DB; HTTP positiva ausente; job de archivo no implementado |
| GET `/gps/retention` | P | Auth + `GPS_ARCHIVAR`; política/estado global | vista retención, meses archivables | U+DB; HTTP positiva ausente; job/retención sin política operativa |

`evidence` / **evidencias**: no hay endpoint HTTP. SQL contiene tabla `evidencias` y FK/índice para entidad; no hay carga, descarga, almacenamiento, autorización, escaneo de contenido ni retención en la API. `reports` / **reportes**: no hay endpoint, controlador, servicio ni repositorio; vistas de costos y detalle existen en el SQL pero no constituyen reportes expuestos. **Roles/permisos**: los endpoints de consulta existen en `/users/:id/access`; no existe API de otorgamiento, revocación o catálogo administrable.

## Esquema y reglas SQL

La suite de catálogo leyó PostgreSQL 17/PostGIS efímero. El SQL declara 26 enums, 12 vistas, funciones/triggers de auditoría, odómetro, gabinete, sesión/dispositivo, heartbeat, GPS, mantenimiento, notificación, alertas y retención; `posiciones_gps` es particionada con partición default. Restricciones/índices parciales protegen sesión abierta por dispositivo, asignación activa, movimiento abierto, préstamo activo, seguimiento activo y orden bloqueante. El código emplea consultas parametrizadas y transacciones en escrituras compuestas; no reemplaza estas invariantes. `fn_purgar_mes_gps` ejecuta DDL destructivo (DROP de partición) y no debe quedar disponible al usuario HTTP.

**No comprobado:** definición desplegada fuera de las DB de prueba, permisos de cada ruta con todos los roles efectivos, rendimiento con volumen productivo, ni configuración TLS/backup de operación.

## GPS: reproducción y diagnóstico

En `test:integration:domain-writes`, `GpsPositionRepository.insert()` contra el SQL oficial cargado en `gacor-journey-test-ephemeral` devolvió SQLSTATE `42703`. El flujo de trigger es `posiciones_gps` → `fn_actualizar_ultima_posicion_gps` → upsert de `ultima_posicion_gps` → `trg_ultima_gps_notify` → `fn_notify_realtime`. Esta última evalúa `NEW.id` para INSERT/UPDATE. `ultima_posicion_gps` no tiene columna `id`; su clave es `dispositivo_id` y tiene `posicion_gps_id` como referencia al punto. La evaluación falla dentro del trigger y PostgreSQL revierte toda la transacción (posición, latest y efectos del dispositivo); las consultas de verificación posteriores vieron cero filas del fixture. Esto no es un error de DTO ni de consulta del repositorio.

Propuesta compatible para revisión del responsable SQL: adaptar la función/trigger en el **SQL fuente oficial** para seleccionar identificador según relación/evento: `NEW.dispositivo_id` para latest o `NEW.posicion_gps_id` si se requiere ID de posición; mantener el identificador genérico solo para tablas que realmente tienen `id`. Luego probar insert/update/delete, contenido de `pg_notify`, rollback, partición del mes y uso de `dercas_api_runtime` con DDL corregido. No se cambió trigger/esquema y no se propone workaround de aplicación porque no puede evitar que falle el trigger AFTER.

### Seguimiento de corrección autorizada (2026-10-16)

Se cambió únicamente la expresión del campo `id` de `fn_notify_realtime`: para `ultima_posicion_gps` ahora selecciona la PK `dispositivo_id` en NEW/OLD según operación; para otras tablas conserva `NEW.id`/`OLD.id`. La copia original verificable es la versión `HEAD` del SQL antes del cambio, SHA-256 `b62e735c953cfda386ecca3e90a01f6055efa8910cde671fd7044e2e33eb1d1c`; la integración del nuevo SQL en una instancia limpia completó la carga sin error. La definición contractual general del JSON es `{table, operation, id, timestamp}`, donde `id` representa la clave de la fila que disparó el trigger y, para `ultima_posicion_gps`, por tanto, la clave del dispositivo. SQL comenta que el backend publica la señal a WebSocket/MQTT; no se encontró implementación/consumidor de ese canal en este repositorio, así que no se afirma que otro consumidor espere esta semántica.

La validación funcional quedó detenida antes de insertar: `dercas_api_runtime` no tiene INSERT en `posiciones_gps`/`ultima_posicion_gps` ni UPDATE de las columnas de dispositivo usadas por el trigger; la operación como ese rol fue rechazada por `permission denied for table posiciones_gps`, sin ejecutar trigger ni dejar filas. No se añadieron privilegios. Solicitar aprobación explícita de ACL mínima temporal/local (o identidad de servicio de hardware aprobada) antes de continuar con pruebas positivas de escritura y compatibilidad de triggers. No se usó administrador para simular tráfico de aplicación. La migración/cambio aplicado solo existe en el archivo SQL oficial local; requiere el proceso futuro aprobado para propagarlo, fuera de esta validación.

## Autorización y exposición

- `AuthGuard` verifica Bearer, token, sesión activa y carga permisos efectivos; `PermissionsGuard` requiere metadatos no vacíos y todas las capacidades, y falla cerrado si falta principal. Todos los controladores de negocio inspeccionados declaran `AuthGuard` en clase o ruta; health y login/refresh son públicos intencionalmente. `/auth/sessions/revoke` y `logout` exigen autenticación y operan sobre principal propio.
- `@ApiAuthenticated` solo describe OpenAPI; no protege por sí solo. Las rutas que dependen de permiso además usan `PermissionsGuard`; catálogo y strings del código se cotejan con 23 permisos del SQL mediante `openapi:check`.
- SQL inserta seis roles y 23 permisos, pero no `rol_permiso` ni `usuario_rol`. En base recién cargada, permisos efectivos son ninguno. No se puede derivar asignación por nombre de rol. Solo el fixture desechable `PILOTO_BRIGADA` usó asociaciones aprobadas previamente.
- El rol DB `dercas_api_runtime` se probó con ACL mínima en flujos auth/journey/fuel/incident y denegaciones. No tiene acceso a gabinete ni cobertura positive HTTP para todos los módulos. `repository-contract` y preparación de fixtures usan el pool de inspección/admin dentro del contenedor descartable; esto no demuestra ACL de runtime para cada ruta.
- El SQL no declara RLS. Por tanto aislamiento por fila depende de predicados del repositorio y guards; una omisión de predicado es riesgo de IDOR aunque el usuario tenga permiso de dominio.
- Falta ruta de administración de roles, control de cambios de permisos y auditoría del otorgamiento. `sesiones_dispositivo` no está en el set de triggers genéricos de bitácora y las funciones auth no generan evento manual visible; login/refresh/logout/revoke no tienen auditoría durable verificada.
- Transversal comprobado: `ValidationPipe` global transforma, elimina/rechaza propiedades desconocidas; Helmet, `no-store`, request ID y filtro genérico; logs omiten datos sensibles. No se halló rate limiter. Proxy trust queda deshabilitado; apropiado salvo despliegue detrás de proxy sin configuración aprobada. Argon2 y tokens en código, pero no se probó política productiva de rotación/secret store.

## Módulos incompletos y límites funcionales

| Dominio | Existe | Falta funcional | Evidencia/riesgo |
|---|---|---|---|
| Evidencias | tabla SQL, referencias desde incidencia/foto | HTTP upload/download, almacenamiento binario, metadatos, antivirus, ownership, ciclo de retención | Sin módulo funcional; decisión de backend y protección de PII |
| Reportes | vistas de detalle/costos/retención | endpoints y caso de uso que componga/exporte datos, permisos y límites | Sin controlador/servicio/repositorio de reportes |
| Mantenimiento administrativo | alta propia de orden y lecturas propias | cola global, aprobación/ejecución/cierre/cancelación, detalle de operaciones, CRUD plan/taller/tipo | Índice y trigger para bloqueo existen; no son workflow administrativo |
| Préstamos | solicitud y lecturas del solicitante/disponibilidad | aprobación, entrega física, keyring, devolución, cierre/cancelación | No se exponen transiciones, pese a tablas/eventos de gabinete |
| Gabinete | cuatro consultas | comando ESP32, autenticación de hardware, ACK/timeout, reconciliación de estado | Protocolo de equipo no está en repo |
| Dispositivos | lecturas administrativas GPS | enrolamiento, rotación/revocación token, asociación y estado de ciclo de vida | No endpoint de provisioning; hashes no deben exponerse |
| Auditoría | triggers insertan bitácora | API/visor restringido, filtros y retención; auditoría de auth/ACL | No hay controlador de auditoría; cobertura de eventos incompleta |
| Retención GPS | consultas de archivo/retención y funciones SQL | scheduler/worker, política y restauración/purga controladas | `fn_purgar_mes_gps` destructiva; fuera de HTTP |

## Jornadas: brechas HTTP cerradas en el bloque del 2026-10-16

La integración E2E ahora prueba solicitudes sin Bearer para `POST /journeys/me`, `PATCH /journeys/:id/finish`, `GET /journeys/me/current`, `GET /journeys/me/history` y `GET /journeys/:id`: las respuestas son `401 UNAUTHENTICATED` sin datos del recurso. Para `PATCH /journeys/:id/finish`, quita temporalmente solo el enlace local de `JORNADA_FINALIZAR` del fixture, conserva `VEHICULO_USAR_ASIGNADO`, recibe `403 FORBIDDEN` y compara mediante el pool administrativo el estado de jornada, movimiento, lectura final y conteo de odómetro antes/después; restaura el enlace en `finally`. `GET /journeys/:id` prueba por separado ID ajeno e ID inexistente: ambos `404 NOT_FOUND` con el mismo cuerpo público salvo `requestId`, sin incluir los IDs solicitados.

Resultado: `npm run test:integration:domain-writes` pasó 3/3 en `dercas_journey_test`; `npm test` pasó 66 archivos/259 pruebas; typecheck y `git diff --check` pasaron. Las consultas de limpieza de solo lectura devolvieron cero usuarios/dispositivos/asignaciones/jornadas/movimientos/lecturas/combustible/incidencias/vehículos/brigadas y enlaces de permiso de fixture. La carga está en `tmpfs`; las solicitudes HTTP usan `dercas_api_runtime`. Estos casos cierran las tres brechas HTTP concretas antes listadas; la valoración de avance por capacidad no se eleva solo por añadir casos de prueba.

## Pruebas y resultado real (árbol de 2026-10-16)

| Comando | Resultado |
|---|---|
| `npm test` | PASS: 66 archivos, 259 pruebas |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run openapi:check` | PASS; build y 72 operaciones, 70 schemas, 23 códigos de permisos, dos 204 |
| `npm run sql:check` | PASS; 51 referencias `gacor.*`, 11 casts de enum |
| `git diff --check` | PASS |
| `npm run test:integration` en `dercas_v2_test` | 12 aprobadas, 3 omitidas, 1 fallida. Falla antes del catálogo instalado: test extrae exactamente 2 líneas `CONSTRAINT` con su regex y exige `>10`; la fuente oficial solo tiene esas dos declaraciones con esa forma. Es una expectativa inválida del test, no evidencia de faltantes de constraints en DB (catálogo mostró 287 constraints del esquema). No se editó la prueba. |
| `npm run test:integration:domain-writes` en `dercas_journey_test` | PASS: 3/3; incluye E2E HTTP `dercas_api_runtime`, autorización, aislamiento, journeys (401/403 anti-permiso y 404 ajeno/inexistente), fuel/incidents, y reproducción GPS `42703` esperada como defecto |
| Consultas de limpieza (solo lectura) | 0 fixtures en usuarios, dispositivos, asignaciones, jornadas, movimientos, odómetros, combustible, incidencias, vehículos, brigadas y enlaces de permiso `PILOTO_BRIGADA` |

Verificación del contenedor: `dercas-gacor-fresh-audit`, `gacor-journey-test-ephemeral` y `dercas-gacor-audit-ephemeral` están `running`, sin mounts y con `/var/lib/postgresql/data` en `tmpfs`; puertos ligados a `127.0.0.1`. Se excluyó explícitamente `dercas-v2-postgres`: tiene volumen persistente y no se usó. No hay prueba/proceso de larga duración iniciado. SQL oficial sin cambios.

## Decisiones que requieren responsable

1. Asignaciones efectivas rol→permiso→acción→alcance para todos los seis roles; solo PILOTO_BRIGADA temporal local fue aprobado.
2. Matriz efectiva rol→permiso→acción→alcance para el resto de módulos; el comportamiento de jornadas verificado es 401 no autenticado, 403 sin permiso requerido y 404 para ID ajeno o inexistente.
3. Solución al trigger GPS en el SQL oficial, y protocolo/credenciales/rotación/volumen del hardware GPS.
4. Backend de evidencias, permisos, clasificación de datos y retención.
5. Reportes requeridos, destinatarios, exportación, agregaciones y permisos.
6. Flujo de aprobación de préstamo y contrato físico ESP32/gabinete.
7. Roles administrativos de mantenimiento, transiciones, catálogo y aprobadores.
8. Auditoría durable de autenticación y administración RBAC; acceso/retención de bitácora.
9. Política legal de retención/restauración/purga GPS, identidad separada del worker y respaldos.
10. Despliegue, proxy confiable, TLS/CA, rate limiting, gestión de secretos y objetivos de operación.

## Avance funcional: rúbrica reproducible

Unidad de valoración: capacidad de negocio de extremo a extremo, no ruta individual, prueba o archivo. Escala discreta: `1.0` solo si el flujo acordado está implementado, conectado al esquema oficial, con permiso/alcance definido y pruebas funcionales positivas y negativas apropiadas; `0.5` si existe una porción real utilizable pero falta alguna transición, decisión, autorización o prueba esencial; `0.0` si está ausente o bloqueada. Ponderaciones reflejan criticidad/alcance de negocio; total 100%. Fórmula reproducible: `Σ peso × valor`. Para este checkpoint cada área parcial recibe exactamente 0.5; evidencias/reportes/auditoría funcional reciben 0.0 al no existir endpoints/casos de uso completos.

| Capacidad | Peso | Estado | Puntos | Justificación resumida |
|---|---:|---:|---:|---|
| Autenticación y sesiones | 15 | 0.5 | 7.5 | Ciclo HTTP y concurrencia ejercitados; faltan rate limit, auditoría durable y política operativa |
| Usuarios y RBAC | 10 | 0.5 | 5.0 | Perfil/acceso/lecturas admin; no hay escrituras RBAC ni mapeo efectivo aprobado |
| Vehículos y asignaciones | 12 | 0.5 | 6.0 | Lecturas y ownership parcial; no hay despacho/gestión y faltan positivos HTTP amplios |
| Jornadas, movimientos y odómetro | 15 | 0.5 | 7.5 | Jornada de punta a punta; otros módulos son lectura, y quedan tres brechas journey |
| Préstamos y gabinete | 12 | 0.5 | 6.0 | Solicitud/lectura parcial; aprobación y transacción física ausentes |
| Combustible, incidencias y mantenimiento | 15 | 0.5 | 7.5 | Fuel/incidente reportable; emergencia y mantenimiento administrativo incompletos |
| GPS, dispositivos y retención | 14 | 0.5 | 7.0 | Consultas presentes; ingesta bloqueada y operación/provisioning ausentes |
| Alertas/notificaciones | 4 | 0.5 | 2.0 | Lectura propia; cambios/entrega y positivos HTTP parciales |
| Evidencias, reportes y auditoría | 3 | 0.0 | 0.0 | Esquema/trigger parcial; capacidades HTTP no implementadas |
| **Total** | **100** |  | **48.5 → 49%** | Redondeado al entero más próximo; no representa porcentaje de pruebas aprobadas |

## Plan por bloques y aceptación

| Bloque | Dependencias | Criterios de aceptación verificables |
|---|---|---|
| 0. Resolver contrato y seguridad | Responsable aprueba matriz rol/permiso/alcance, estados HTTP jornada y procesos administrativos | Matriz firmada; cada ruta protegida tiene acción y predicado de objeto; fixtures locales de positivo/negativo; no se siembran grants generales automáticamente |
| 1. Cerrar journeys | DB descartable; fixture local `PILOTO_BRIGADA`; `dercas_api_runtime` | **Completado 2026-10-16:** 401 sin Bearer, 403 sin `JORNADA_FINALIZAR` sin mutación, 404 comparables para ID ajeno/inexistente; suite, typecheck y limpieza read-only pasaron |
| 2. Lecturas HTTP de movimientos de brigada | Fixture local aprobado, asignación/jornada propia y DB `tmpfs`; `dercas_api_runtime` para HTTP | Positivo/estructura/alcance para `GET /movements/me/assigned`, `/assigned/open`, `/assigned/:id`; vacío, 401/403 e IDOR ajeno/inexistente; verificar por lectura DB y limpiar fixtures |
| 3. Reparar contrato de auditoría de integración | Mantener SQL oficial sin tocar | Corregir expectativa de extracción/umbral en prueba para comparar declaraciones reales; integrar contra DB cargada desde SQL, registrar resultado; no cambiar esquema para satisfacer test |
| 4. Autorizar lecturas restantes por dominio | Matriz y ACL runtime revisadas | Positivos, 401/403, IDOR, límites y respuestas sin PII para vehicle/assignment/odometer/loans/fuel/incidents/alerts/notifs/cabinet/GPS; app se conecta solo como runtime |
| 4. GPS DDL y protocolo | Aprobación expresa del responsable SQL + fabricante/protocolo | Corregir oficialmente `fn_notify_realtime`, revisión del diff SQL, pruebas trigger/notify/rollback/partición en instancia nueva; luego ingesta autenticada con rotación, replay control y límites |
| 5. Completar flujos administrativos | Decisiones de negocio por préstamo, mantenimiento, roles, dispositivos | Casos de uso/transiciones especificadas, permisos separados aprobados, transacciones e idempotencia; HTTP multirol positiva/negativa y concurrency en DB desechable |
| 6. Evidencias/reportes/auditoría | Clasificación/retención/almacenamiento y destinatarios aprobados | API, almacenamiento, autorización, virus/size controls, exportación acotada, audit log verificable; pruebas de contenido no permitido y acceso cruzado |
| 7. Retención y operación | Política legal, backups, worker con credencial separada | Job dry-run idempotente, restore verificado y ejecución auditada; purga no ejecutable con `dercas_api_runtime` |
| 8. Certificación de release | CI/deploy/TLS/proxy/rate limits definidos | Suites completas sin skips obligatorios, catálogo SQL compatible, OpenAPI, cargas/restore, configuración TLS real y checklist de reversión aprobados |

## Archivos de evidencia examinados

Controladores y módulos `src/{auth,users,vehicles,assignments,journeys,movements,odometer,loans,fuel,maintenance,incidents,alerts,notifications,cabinet,gps,health}`; servicios/repositorios/DTO/guards; `src/main.ts`, configuración, módulo de DB y OpenAPI; `test/**`, `scripts/verify-sql-contract.mjs`, `package.json`; `docs/GACOR_DERCAS_PostgreSQL_v3_GPS.sql`, `docs/POSTGRES_INTEGRATION.md`, `PERMISSION_MATRIX.md`. El estado de rutas puede rastrearse en `API_COVERAGE.md`; recomendaciones estructurales en `ARCHITECTURE.md`; orden de implementación en `API_ROADMAP.md`; casos y puertas de pruebas en `TEST_STRATEGY.md`.
