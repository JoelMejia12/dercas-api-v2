# Preparación de integración PostgreSQL

Este documento describe cómo preparar la integración y verificar el destino. La suite `test/integration/postgres.integration.spec.ts` está excluida de `npm test` y solo intenta conectarse cuando recibe `RUN_PG_INTEGRATION=1` junto con una URL y confirmación dedicadas.

## Configuración actual de la API

- La conexión normal admite `DATABASE_URL` o el conjunto `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`; no se deben mezclar ambos formatos. `PGPORT` es opcional. Una configuración parcial de variables `PG*` falla con un error genérico, sin repetir los valores.
- Si ninguna configuración de base de datos está presente, el proceso puede iniciar en modo no listo. `/api/v1/health/live` verifica el proceso y `/api/v1/health/ready` informa que la base no está configurada o no está disponible. Crear el `Pool` es diferido respecto a abrir conexiones; el readiness consulta disponibilidad con `SELECT 1`.
- `PGSSL=verify-full` configura `rejectUnauthorized: true`, que conserva validación de certificado y hostname. Con `NODE_ENV=production` y PostgreSQL configurado, la validación de entorno rechaza el arranque salvo que `PGSSL=verify-full`; si no hay DB configurada se conserva el modo no listo. `PGSSL=disable` se expresa explícitamente al driver, por lo que un `PGSSLMODE` ambiental no cambia silenciosamente la selección en desarrollo/test. En `DATABASE_URL`, el único `sslmode` permitido es `verify-full`; parámetros URL `ssl=...` se rechazan porque node-postgres permite que sustituyan la política TLS. Si el certificado usa una CA privada, esta debe estar en el almacén de confianza que usa Node; la API no define una variable de CA propia.
- `AUTH_TOKEN_SECRET` se valida antes de crear Nest y abrir el puerto HTTP. Debe contener al menos 32 bytes UTF-8, igual que el mínimo usado por el servicio de tokens. El error indica el nombre de la variable y el mínimo, nunca su valor. La variable no se copia al objeto de configuración retornado ni se registra. En producción debe suministrarse mediante un gestor de secretos.
- Los tests unitarios usan dobles y no requieren variables de conexión. Los errores del pool se registran con un mensaje fijo; los errores de readiness son genéricos. `SecureLogger` filtra campos cuyos nombres indican contraseñas, tokens, secretos o credenciales.

## Suite explícita de integración

La suite está diseñada para una base descartable de pruebas y actualmente contiene comprobaciones sin escrituras persistentes: conectividad, versión PostgreSQL, PostGIS, permisos/definiciones de vistas, tipos, triggers, índices, particionamiento GPS, consultas de vehículos y operación PostGIS. Comprueba además el ámbito transaccional de `app.user_id` y `app.ip` mediante `set_config` y rollback. La prueba de aislamiento de notificaciones requiere una fila de prueba ya preparada y separada.

Para habilitarla, definir únicamente en el entorno local de integración:

```sh
RUN_PG_INTEGRATION=1
PG_INTEGRATION_DATABASE_URL=postgresql://<usuario>:<clave>@127.0.0.1:32768/dercas_v2_test
PG_INTEGRATION_CONFIRM_DATABASE=dercas_v2_test
PG_INTEGRATION_CONFIRM_HOST=127.0.0.1
PG_INTEGRATION_CONFIRM_PORT=32768
PG_INTEGRATION_SSL=disable
```

Los marcadores `<usuario>:<clave>` se sustituyen localmente mediante el mecanismo de secretos del operador; no guardar la URL resultante en el repositorio ni imprimirla. La instancia efímera usada para esta verificación es el contenedor `dercas-gacor-audit-ephemeral`, mapeado a `127.0.0.1:32768`; Docker confirma que `/var/lib/postgresql/data` usa `tmpfs` de 1 GB y que no tiene mounts persistentes. La DB observada fue `dercas_v2_test`. Verificar de nuevo el nombre del contenedor, puerto, DB, `tmpfs` y ausencia de mounts antes de ejecutar integración; no confiar solo en este texto.

`PG_INTEGRATION_SSL` también admite `disable` para una instalación local aislada. La URL no debe contener parámetros de SSL; el arnés los configura mediante `PG_INTEGRATION_SSL`. El host y puerto de la URL deben coincidir con sus valores de confirmación, el nombre debe coincidir exactamente y terminar en `_test` o `_integration`, y la suite rechaza `NODE_ENV=production`. Tras conectar, confirma `current_database()` y verifica el `search_path` efectivo `gacor, public`. La conexión usa exclusivamente `PG_INTEGRATION_DATABASE_URL`; las variables normales de la aplicación no sirven como fallback. También compara `PGDATABASE` y el nombre de `DATABASE_URL` para rechazar una coincidencia; una URL de aplicación malformada hace fallar la comprobación de separación. Ejecutar explícitamente con `npm run test:integration`; sin `RUN_PG_INTEGRATION=1`, la suite queda omitida y no abre conexiones.

El harness crea el pool de lectura/inspección mediante `buildPoolConfig`, la misma fábrica usada por el módulo PostgreSQL de la aplicación. Los flujos HTTP crean temporalmente la aplicación con `DATABASE_URL` apuntando a la URL dedicada, `PGSSL` con la política confirmada y una clave de acceso aleatoria solo en memoria. No se debe imprimir ni guardar la URL con credenciales.

### Flujos HTTP de autenticación que escriben en la base

La prueba HTTP está deshabilitada salvo que se configuren `PG_INTEGRATION_AUTH_EMAIL`, `PG_INTEGRATION_AUTH_PASSWORD`, `PG_INTEGRATION_AUTH_DEVICE_ID` y `PG_INTEGRATION_AUTH_DEVICE_TOKEN`, y además se establezca `PG_INTEGRATION_AUTH_WRITES_CONFIRMED=1` tras aprobar expresamente la escritura. Las credenciales se leen del entorno; no agregarlas a `.env.example`, archivos versionados ni logs.

Antes de cualquier petición HTTP, la aplicación Nest ya creada verifica mediante su propio `DatabaseService` que `current_database()` coincida con `PG_INTEGRATION_CONFIRM_DATABASE` y que el `search_path` efectivo sea `gacor, public`. Después, el preflight de solo lectura exige el usuario activo ID `1` con el correo configurado, el dispositivo activo ID `1`, el hash SHA-256 del token configurado y `dispositivos.usuario_asociado_id = usuarios.id`; también exige que no exista ninguna sesión `ABIERTA` para ese dispositivo. El `deviceId` enviado en el login debe ser exactamente `1`. Si una comprobación falla, el servidor Nest se cierra y no se envía ninguna solicitud HTTP.

El dispositivo fixture debe estar **reservado exclusivamente** para esta prueba durante toda su ejecución: ningún usuario, proceso ni otra prueba puede iniciar sesión con él. La lectura previa no bloquea un login concurrente y `AuthRepository.createSession` puede cerrar sesiones abiertas expiradas de ese dispositivo; no ejecutar el flujo en paralelo con otro uso del dispositivo. El flujo exitoso modifica deliberadamente:

- `usuarios.ultimo_acceso_at` para el usuario de fixture.
- Inserta una fila nueva en `sesiones_dispositivo` al iniciar sesión.
- Actualiza el hash del refresh token de esa misma fila al renovarlo.
- Revoca esa misma fila, fija `logout_at`/`ip_logout` y deja `refresh_token_hash` nulo.

El registro final revocado se conserva: el test no lo borra ni limpia tablas. Si ya recibió un `sessionId` y conserva un access token de esa misma sesión, intenta revocarla en `finally`, incluso ante un fallo posterior. Comprueba que la respuesta sea `204`; cualquier otro código HTTP o error de transporte emite un diagnóstico estructurado que solo incluye el estado o una causa genérica, nunca credenciales, tokens, hashes ni IDs. Ese diagnóstico no reemplaza ni oculta el resultado original del test. Si no obtuvo el `sessionId` tras un login con resultado ambiguo, o no dispone de un access token utilizable, no inventa IDs, no borra filas y no ejecuta DML de limpieza; requiere recuperación manual. Un rechazo explícito del login con respuesta 4xx no se trata como una sesión posiblemente creada.

Si el test falla después de que el login haya confirmado su transacción (por ejemplo, se perdió la respuesta HTTP), inspeccionar manualmente —solo lectura— las sesiones del fixture, contrastando `usuario_id`, `dispositivo_id`, `login_at` y estado. Se puede usar una consulta `SELECT` equivalente a:

```sql
SELECT id::text, usuario_id::text, dispositivo_id::text, estado::text, login_at,
       logout_at, refresh_token_hash IS NULL AS refresh_hash_cleared
FROM gacor.sesiones_dispositivo
WHERE usuario_id = 1 AND dispositivo_id = 1
ORDER BY login_at DESC, id DESC;
```

No publicar hashes ni resultados sensibles. Una revocación fallida —incluyendo respuesta distinta de `204`, error de transporte o ausencia de token utilizable cuando el login pudo confirmar— requiere inspección manual de solo lectura. No borrar ni alterar la sesión como recuperación automática. Si queda `ABIERTA` y el test no puede revocarla con el token capturado, detener el siguiente intento y solicitar al administrador responsable que determine una recuperación autorizada para esa fila concreta. **No repetir la prueba hasta resolver y documentar esta inspección.**

No ejecutar contra una base compartida o con datos de valor. La URL con nombre `_test` no demuestra que sea descartable; se debe verificar por separado el servidor, el mapeo del contenedor y el volumen/destino de datos, además de obtener aprobación para las escrituras descritas.

Para probar aislamiento con dos usuarios, preparar en esa base aislada una notificación perteneciente al segundo usuario y aportar:

```sh
PG_INTEGRATION_USER_A_ID=<BIGINT_de_usuario_A>
PG_INTEGRATION_USER_B_ID=<BIGINT_de_usuario_B>
PG_INTEGRATION_NOTIFICATION_B_ID=<BIGINT_de_notificacion_de_B>
```

La suite espera que A no obtenga esa notificación y que B sí. No crea ni elimina fixtures y no ejecuta DML contra tablas del esquema: la prueba transaccional solo asigna `set_config(..., true)` y revierte una transacción intencional. Quien prepare la fila de fixture debe registrar IDs de la notificación y de su alerta relacionada; limpiar exclusivamente esos registros mediante un procedimiento revisado, respetando claves foráneas. Nunca limpiar tablas completas, truncar el esquema ni reutilizar una base con datos de producción.

## Inicialización manual futura

1. Crear una base PostgreSQL vacía y descartable para integración, con nombre terminado en `_test` o `_integration`. Verificar host, puerto y nombre por un canal independiente antes de configurar la suite.
2. Instalar en el servidor PostgreSQL el paquete de PostGIS compatible con PostgreSQL 16+ y comprobar que la extensión `postgis` está disponible para esa base. El SQL crea la extensión; no instala el paquete del servidor.
3. Una persona administradora debe revisar el SQL oficial y aplicarlo una sola vez a esa base vacía desde una sesión de mantenimiento controlada. El script abre `BEGIN` y termina en `COMMIT`; contiene `CREATE EXTENSION IF NOT EXISTS` y `CREATE SCHEMA IF NOT EXISTS`, pero los `CREATE TYPE`, tablas, índices y triggers no son idempotentes. También carga datos base con `INSERT` sin protección contra duplicados. Una segunda ejecución no es un método de actualización y puede fallar y revertir la transacción.
4. No convertir el SQL en migración ni editarlo para este paso. Si se requiere reinicializar la base descartable, la administración de esa base debe seguir un procedimiento separado y autorizado; esta API y esta suite no borran objetos.
5. Definir después una cuenta de aplicación separada, con mínimo privilegio, tras revisar las lecturas y escrituras reales de la API y los efectos de triggers. El SQL no contiene `GRANT`, `REVOKE`, roles de base de datos ni privilegios por defecto. La sección siguiente enumera candidatos justificables por código; no es una receta de concesión ni una matriz aprobada.
6. Conceder los permisos fuera de este repositorio y ejecutar la suite optativa contra esa base; revisar resultados y errores de permisos. La suite no verifica una matriz completa de permisos de producción ni reemplaza la revisión de privilegios.

## Elementos del SQL que debe cubrir la integración real

- PostgreSQL 16+ y extensión PostGIS; las columnas GPS usan `GEOGRAPHY(POINT,4326)`, con índices GiST y BRIN.
- El histórico GPS está particionado por `fecha_hora_servidor`, tiene partición `DEFAULT`, clave primaria y restricción única compuestas con la fecha, y un trigger mantiene `ultima_posicion_gps`.
- Las vistas consultadas por la API incluyen disponibilidad administrativa, estado de mantenimiento, dispositivos, mapa GPS y retención. La integración debe comprobar permisos de lectura y tipos devueltos; `BIGINT` y `NUMERIC` deben seguir mapeándose a cadenas en la API.
- Triggers tienen efectos laterales que requieren comprobación real: auditoría inserta en `bitacora`; GPS actualiza última posición y dispositivo; heartbeat actualiza dispositivo; fin de sesión sincroniza dispositivo; mantenimiento puede actualizar vehículos; gabinete sincroniza ocupación; movimiento valida odómetro. Los triggers de realtime usan `pg_notify`.
- Hay funciones de mantenimiento/retención que crean o eliminan particiones, borran filas o generan alertas. El SQL no dice qué rol debe ejecutarlas; su invocación y permisos deben decidirse y verificarse por separado. La función de purga de GPS contiene DDL (`DROP TABLE`) y no debe concederse a la cuenta normal del API por inferencia.
- Las restricciones únicas parciales para préstamos, movimientos y asignaciones deben probarse con escenarios concurrentes en la base aislada. Las pruebas unitarias actuales no validan su comportamiento real.

## Privilegios potenciales de la cuenta de aplicación

La siguiente lista resulta de los repositorios actuales. El acceso HTTP sigue limitado por guards y filtros de usuario, pero el SQL no habilita Row Level Security; por ello, los privilegios de PostgreSQL por sí solos no aíslan filas por usuario. No ejecutar `GRANT` a partir de esta lista sin revisar cada ruta habilitada y la política de GACOR.

| Necesidad | Justificación estática | Por verificar en PostgreSQL |
|---|---|---|
| `USAGE` del esquema `gacor` | Todas las referencias de repositorios califican tablas/vistas con `gacor.` | ACL efectiva del esquema, rol heredado y búsqueda de tipos/extensiones |
| `SELECT` en tablas consultadas directamente | Repositorios acceden a `usuarios`, `dispositivos`, `sesiones_dispositivo`, `roles`, `permisos`, `usuario_rol`, `rol_permiso`, `vehiculos`, `brigadas`, `asignaciones_vehiculo`, `jornadas`, `movimientos_vehiculo`, `lecturas_odometro`, `prestamos_administrativos`, `gabinetes`, `posiciones_gabinete`, `llaveros`, `eventos_gabinete`, `incidencias`, `alertas`, `notificaciones`, `ordenes_mantenimiento`, `detalle_mantenimiento`, `cargas_combustible`, `gasolineras`, `sesiones_seguimiento`, `ultima_posicion_gps`, `posiciones_gps`, `heartbeats_dispositivo`, `configuracion_gps`, `perfiles_seguimiento`, `archivos_gps`, `restauraciones_gps` y `posiciones_gps_temporales` | Conceder solo relaciones y columnas usadas por los módulos aprobados. Confirmar reglas de privilegios de vistas y columnas sensibles (`password_hash`, `device_token_hash`) con el rol real. `bitacora` solo se consulta indirectamente mediante triggers en el código revisado. |
| `SELECT` en vistas usadas | Se consultan `vw_ultimo_kilometraje_vehiculo`, `vw_vehiculos_administrativos_disponibles`, `vw_estado_mantenimiento`, `vw_mapa_vehiculos_tiempo_real`, `vw_estado_dispositivos` y `vw_retencion_gps` | Probar permisos sobre vistas y su comportamiento con ACL de tablas subyacentes y funciones PostGIS bajo versión/configuración reales |
| `INSERT`/`UPDATE` en tablas escritas | Los repositorios insertan en `sesiones_dispositivo`, `prestamos_administrativos`, `incidencias`, `ordenes_mantenimiento`, `lecturas_odometro`, `cargas_combustible` y `posiciones_gps`; actualizan `sesiones_dispositivo` y `usuarios` | Probar exactamente las columnas y defaults/identities usados, restricciones, triggers y transacciones; no hay `DELETE` directo en repositorios de producción revisados |
| Identidades y secuencias | Muchas PK se generan con `GENERATED ALWAYS AS IDENTITY`; no hay `CREATE SEQUENCE` explícito ni llamada API a `nextval` | Verificar si el rol puede insertar omitiendo la identidad en esta versión/configuración. No conceder acceso genérico a secuencias sin una falla observada y una revisión específica |
| Efectos de triggers | Auditoría inserta en `bitacora`; sesión sincroniza `dispositivos`; heartbeat y GPS actualizan `dispositivos`; GPS hace upsert en `ultima_posicion_gps`; mantenimiento modifica `vehiculos`; gabinete sincroniza estado | El SQL no marca esas funciones `SECURITY DEFINER`; comprobar con el rol real si los DML indirectos requieren permisos en las tablas afectadas y confirmar que ninguna política adicional lo altera. Los errores de trigger abortan la escritura/transacción correspondiente |
| Funciones y tipos PostGIS | El repositorio de posiciones llama directamente a `ST_SetSRID` y `ST_MakePoint`, convierte a `geography`; las vistas oficiales usan conversiones/funciones espaciales | Extensión `postgis` instalada por administrador; comprobar acceso al esquema/tipo y `EXECUTE` efectivo para las funciones bajo el rol de aplicación. El SQL no define ACL de extensión |
| Funciones SQL del esquema | Los repositorios no invocan directamente `gacor.fn_*`; las funciones identificadas ejecutan por triggers o están destinadas a tareas de retención/alertas | No conceder `EXECUTE` para funciones de mantenimiento por inferencia. Revisar por separado identidad de ejecución y permisos de funciones disparadas; `fn_purgar_mes_gps` hace `DROP TABLE` y no debe pertenecer al rol normal del API sin aprobación explícita |

El catálogo `roles`/`permisos` del SQL es autorización de la aplicación, no crea roles PostgreSQL ni concede ACL de base de datos. El script no contiene políticas RLS ni `SECURITY DEFINER`; las verificaciones HTTP de propiedad tampoco sustituyen una cuenta de base de datos de mínimo privilegio.

## Límites de lo comprobado

Los tests unitarios comprueban armado de configuración, liberación del pool, rollback y consultas frente a mocks. La integración se ejecutó en `dercas_v2_test` dentro de un contenedor temporal PostgreSQL 17/PostGIS con `tmpfs`; se verificaron lecturas de repositorios, catálogo SQL, PostGIS, vistas, triggers e índices. La corrida de lectura más reciente tuvo 12 pruebas aprobadas y 3 omitidas por fixtures opt-in. El test HTTP OpenAPI levanta Nest sin pool ni conexión de base, comprueba el JSON servido, valida DTO sin reflejar datos sensibles y revisa liveness/readiness sin DB. La suite `domain-writes` completó 3/3 casos contra otro contenedor `tmpfs`; su pool administrativo prepara los fixtures, mientras el proceso HTTP usa el rol `dercas_api_runtime` limitado al subconjunto ejercitado. No se ha validado ACL para todos los módulos ni TLS del despliegue; el detalle y la configuración local están abajo.

`npm run sql:check` compara las referencias de nombres `gacor.*` y casts de enums en `src/**/*.ts` con declaraciones del SQL oficial. Es un preflight estático: no valida columnas, tipos completos, permisos, triggers desplegados ni consultas contra un servidor; no sustituye la suite PostgreSQL.

### Verificación en una instancia recién preparada

El 2026-10-15 se creó `dercas-gacor-fresh-audit` desde `postgis/postgis:17-3.5`, expuesta solo en `127.0.0.1:32770`, con `/var/lib/postgresql/data` en `tmpfs` de 1 GB y `Mounts=[]`. En `dercas_fresh_test` se cargó sin editar `docs/GACOR_DERCAS_PostgreSQL_v3_GPS.sql`; PostgreSQL reportó versión 17.5, PostGIS disponible, 6 roles, 23 permisos y cero filas en `rol_permiso`/`usuario_rol`. La suite `npm run test:integration` pasó: 3 archivos, 12 pruebas aprobadas y 3 omitidas por fixtures opt-in. Para repetir se debe confirmar de nuevo el contenedor, host, puerto, base y `tmpfs`; el puerto es local de esta sesión y no constituye una configuración permanente. La instancia usa autenticación `trust` solo para este contenedor de pruebas ligado a loopback; no reutilizar esa configuración fuera de este entorno efímero. No se ejecutó la suite de escrituras en esta instancia.

La suite `repository-contract` ejecutó consultas con filtros opcionales combinados para comprobar armado de parámetros y tipos SQL, incluyendo el valor booleano `false` en eventos de gabinete. Sin filas de negocio, la evidencia confirma ejecución/shape vacío, no el mapeo completo de respuestas pobladas.

### Suite de dominio con escrituras y HTTP E2E aislado

`npm run test:integration:domain-writes` se mantiene deshabilitada salvo opt-in explícito. Esta suite usa únicamente `dercas_journey_test` en `gacor-journey-test-ephemeral`, `127.0.0.1:32769`, usuario PostgreSQL `postgres`; el propio test rechaza cualquier host, puerto, usuario o nombre diferente. Antes de cada ejecución, verificar independientemente el destino y que el almacenamiento sea desechable:

```sh
docker inspect gacor-journey-test-ephemeral --format 'status={{.State.Status}} mounts={{json .Mounts}} tmpfs={{json .HostConfig.Tmpfs}}'
docker exec gacor-journey-test-ephemeral psql -U postgres -d dercas_journey_test -Atqc "SELECT current_database(), current_setting('server_version_num'), postgis_full_version()"
```

No ejecutar si el contenedor no está activo, `Mounts` no está vacío o los datos no están en `tmpfs`. La URL debe coincidir exactamente con el host/puerto/usuario/base ya confirmados localmente. En la instancia de desarrollo autorizada se usa autenticación local de confianza, por lo que la URL no necesita contraseña; nunca copiar una contraseña ni imprimir una URL que la contenga.

El pool de fixtures usa `postgres` solo dentro de esta instancia descartable. La aplicación HTTP se conecta como `dercas_api_runtime`, un rol separado sin superusuario, creación de DB/roles, herencia, membresías, permisos DDL, `DELETE` ni acceso a gabinete. Antes de usarlo, aplicar explícitamente el fixture ACL —solo tras verificar destino/mounts como arriba— y mantener la configuración trust dentro del contenedor local:

```sh
docker exec -i gacor-journey-test-ephemeral psql -U postgres -d dercas_journey_test -v ON_ERROR_STOP=1 < test/fixtures/dercas_api_runtime_role.sql
```

El test verifica atributos y privilegios prohibidos del rol y se conecta con él para comprobar identidad/base antes de iniciar Nest. Las lecturas y escrituras reales del E2E (auth, jornada, combustible e incidencia) se ejecutan con ese rol; el pool administrativo queda separado para sembrar y limpiar fixtures. Los grants cubren solo las tablas/vistas y columnas necesarias para esos flujos. Las actualizaciones son a nivel de columna: último acceso del usuario; asociación/autenticación del dispositivo por trigger; estado/hash/IP de logout de sesión; estado/lectura final de movimiento y estado/observación final de jornada. Para el `FOR UPDATE` de asignación/vehículo solo se concede UPDATE de la columna `id`. El preflight comprueba estos grants y que no haya UPDATE de tabla completa ni acceso de escritura a `password_hash`, `device_token_hash`, `usuario_id`, propiedad del vehículo o asignación de jornada. No instalar el rol ni aplicar este SQL en una base compartida o productiva. El SQL fixture solo configura un rol y ACL; no cambia objetos del esquema.

Habilitar ambos marcadores solo para esta base desechable y ejecutar:

```sh
export PG_INTEGRATION_DATABASE_URL='postgres://postgres@127.0.0.1:32769/dercas_journey_test'
export PG_INTEGRATION_CONFIRM_DATABASE=dercas_journey_test
export PG_INTEGRATION_CONFIRM_HOST=127.0.0.1
export PG_INTEGRATION_CONFIRM_PORT=32769
export RUN_PG_INTEGRATION=1
export PG_INTEGRATION_DOMAIN_WRITES_CONFIRMED=1
npm run test:integration:domain-writes
```

La suite crea usuarios, dispositivos y registros de dominio con valores aleatorios; comprueba transacciones, duplicados/concurrencia, ownership, login/refresh/replay/revoke/logout HTTP y autorización por rol. El servidor HTTP se conecta como `dercas_api_runtime`; el pool PostgreSQL `postgres` se usa solo para fixtures/limpieza dentro del contenedor local. Sus bloques `finally` eliminan las filas del fixture por sus IDs concretos y las filas de bitácora generadas desde el límite de la prueba. La prueba GPS espera que el insert falle con SQLSTATE `42703` por incompatibilidad del trigger oficial y confirma rollback; no deshabilita triggers ni convierte ese fallo esperado en éxito funcional. La ACL mínima se ejercitó solo para las rutas HTTP de la suite, no para todos los módulos.

Al terminar, confirmar cleanup con consultas de conteo limitadas a las tablas del fixture:

```sh
docker exec gacor-journey-test-ephemeral psql -U postgres -d dercas_journey_test -Atqc "SELECT (SELECT count(*) FROM gacor.usuarios),(SELECT count(*) FROM gacor.dispositivos),(SELECT count(*) FROM gacor.sesiones_dispositivo),(SELECT count(*) FROM gacor.jornadas),(SELECT count(*) FROM gacor.movimientos_vehiculo),(SELECT count(*) FROM gacor.vehiculos)"
```

Si Vitest o el proceso termina abruptamente antes del `finally`, tratar el contenedor como potencialmente sucio y destruir/recrear solo esa instancia desechable siguiendo un procedimiento autorizado; no ejecutar `TRUNCATE`, borrar tablas completas ni apuntar a otra base para “limpiar”.
