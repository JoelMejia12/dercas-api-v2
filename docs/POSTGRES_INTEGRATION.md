# Preparación de integración PostgreSQL

Este documento prepara la integración, pero no inicializa bases ni ejecuta el SQL. La suite `test/integration/postgres.integration.spec.ts` está excluida de `npm test` y solo intenta conectarse cuando recibe `RUN_PG_INTEGRATION=1` junto con una URL y confirmación dedicadas.

## Configuración actual de la API

- La conexión normal admite `DATABASE_URL` o el conjunto `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`; no se deben mezclar ambos formatos. `PGPORT` es opcional. Una configuración parcial de variables `PG*` falla con un error genérico, sin repetir los valores.
- Si ninguna configuración de base de datos está presente, el proceso puede iniciar en modo no listo. `/api/v1/health/live` verifica el proceso y `/api/v1/health/ready` informa que la base no está configurada o no está disponible. Crear el `Pool` es diferido respecto a abrir conexiones; el readiness consulta disponibilidad con `SELECT 1`.
- `PGSSL=verify-full` configura `rejectUnauthorized: true`, que conserva validación de certificado y hostname. `PGSSL=disable` ahora se expresa explícitamente al driver, por lo que un `PGSSLMODE` ambiental no cambia silenciosamente esa selección. En `DATABASE_URL`, el único `sslmode` permitido es `verify-full`; parámetros URL `ssl=...` se rechazan porque node-postgres permite que sustituyan la política TLS. Si el certificado usa una CA privada, esta debe estar en el almacén de confianza que usa Node; la API no define una variable de CA propia.
- `AUTH_TOKEN_SECRET` se valida antes de crear Nest y abrir el puerto HTTP. Debe contener al menos 32 bytes UTF-8, igual que el mínimo usado por el servicio de tokens. El error indica el nombre de la variable y el mínimo, nunca su valor. La variable no se copia al objeto de configuración retornado ni se registra. En producción debe suministrarse mediante un gestor de secretos.
- Los tests unitarios usan dobles y no requieren variables de conexión. Los errores del pool se registran con un mensaje fijo; los errores de readiness son genéricos. `SecureLogger` filtra campos cuyos nombres indican contraseñas, tokens, secretos o credenciales.

## Suite explícita de integración

La suite está diseñada para una base descartable de pruebas y actualmente contiene comprobaciones sin escrituras persistentes: conectividad, versión PostgreSQL, PostGIS, permisos/definiciones de vistas, tipos, triggers, índices, particionamiento GPS, consultas de vehículos y operación PostGIS. Comprueba además el ámbito transaccional de `app.user_id` y `app.ip` mediante `set_config` y rollback. La prueba de aislamiento de notificaciones requiere una fila de prueba ya preparada y separada.

Para habilitarla, definir únicamente en el entorno local de integración:

```sh
RUN_PG_INTEGRATION=1
PG_INTEGRATION_DATABASE_URL=postgresql://<usuario>:<clave>@<host>:<puerto>/<base_descartable_test>
PG_INTEGRATION_CONFIRM_DATABASE=<mismo_nombre_de_base>
PG_INTEGRATION_SSL=verify-full
```

`PG_INTEGRATION_SSL` también admite `disable` para una instalación local aislada. La URL no debe contener parámetros de SSL; el arnés los configura mediante `PG_INTEGRATION_SSL`. La base debe terminar en `_test` o `_integration`, el nombre debe coincidir exactamente con la confirmación y la suite rechaza `NODE_ENV=production`. La conexión usa exclusivamente `PG_INTEGRATION_DATABASE_URL`; las variables normales de la aplicación no sirven como fallback. Sí compara `PGDATABASE` y el nombre de `DATABASE_URL` para rechazar una coincidencia; una URL de aplicación malformada hace fallar la comprobación de separación. Ejecutar explícitamente con `npm run test:integration`; sin `RUN_PG_INTEGRATION=1`, la suite queda omitida y no abre conexiones.

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

Los tests unitarios pueden comprobar el armado de configuración, la liberación del pool, los flujos de rollback y las consultas parametrizadas frente a mocks. La suite de integración todavía no se ha ejecutado. Certificados, conexión, permisos efectivos, extensiones, tipos, vistas, triggers, índices y particiones solo quedarán comprobados después de inicializar y usar una base PostgreSQL/PostGIS aislada.
