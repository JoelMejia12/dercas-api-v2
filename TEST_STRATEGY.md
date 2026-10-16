# Estrategia de pruebas

## Resultados actuales (2026-10-16)

Los resultados anteriores en este documento son históricos. Árbol actual: `npm test` PASS (66 archivos/259 pruebas), `npm run typecheck` PASS, `npm run lint` PASS, `npm run openapi:check` PASS (72 operaciones), `npm run sql:check` PASS (51 referencias y 11 casts), `git diff --check` PASS. `test:integration:domain-writes` PASS (3/3) en base tmpfs con HTTP como `dercas_api_runtime`; incluye journeys y reproduce el bloqueo GPS `42703`. La integración de lectura ejecutó 12 casos, omitió 3 por fixtures opcionales y falló 1 aserción interna: el parser SQL de esa prueba cuenta dos declaraciones `CONSTRAINT`, pero exige más de diez. El catálogo PostgreSQL inspeccionado tenía 287 constraints de esquema; no se cambió la prueba ni el SQL.

El detalle de invocaciones, aislamiento verificado, matriz por endpoint y brechas de journeys está en [GLOBAL_API_AUDIT.md](GLOBAL_API_AUDIT.md). Para repetir escrituras debe verificarse de nuevo el destino desechable antes de cada ejecución. No hay procesos de pruebas corriendo.

El preflight `npm run sql:check` compara los nombres `gacor.*` y los casts de enums del código fuente contra declaraciones del SQL oficial (51 referencias y 11 casts). Es estático y complementa, pero no reemplaza, las pruebas PostgreSQL de consultas y comportamiento.

`npm run openapi:check` verifica las 72 operaciones: solo liveness/readiness y login/refresh son públicas; cada otra operación declara Bearer y cada escritura, salvo revoke/logout de la sesión propia, declara permisos del catálogo SQL.

Verificación ejecutada: `npm test` (65 archivos, 257 pruebas aprobadas), lint, typecheck, build, `npm run openapi:check` y audit de dependencias de producción aprobados. La instancia limpia `dercas_fresh_test` se creó en un contenedor loopback con `tmpfs`, recibió el SQL oficial y pasó la integración de lectura: 3 archivos, 12 aprobadas y 3 omitidas. La suite `npm run test:integration:domain-writes` se volvió a ejecutar en la DB efímera separada y aprobó 3/3; valida reintentos concurrentes de jornada/préstamo, competencia de una segunda jornada con UUID distinto y rollback sin escrituras parciales, sesión válida sin roles y permisos vacíos, ownership real de sesión/historial GPS, combustible, incidencia y mantenimiento; también un E2E HTTP que crea y limpia usuario/dispositivo, valida login concurrente 201/409, perfil sin secretos, acceso propio sin grants, estado GPS propio sin credenciales, 403 en todas las rutas GET protegidas declaradas por OpenAPI, refresh/replay, revoke y logout que invalidan ambos access tokens. El recuento posterior confirmó cero filas de fixture en las tablas verificadas. La misma suite registra como fallo esperado la incompatibilidad del trigger GPS, por lo que no acredita ingesta operativa. Otra prueba E2E HTTP levanta Nest sin pool, verifica Swagger UI y los 72 contratos (70 responses descriptivos, dos 204 sin cuerpo), rechaza DTO con campos inesperados sin reflejar un valor sensible y prueba liveness/readiness genérica sin DB. Las pruebas PostgreSQL incluyen lecturas SQL, objetos/vistas/enums/triggers, partición/PostGIS y rollback. El harness está deshabilitado por defecto; la suite HTTP de autenticación con escrituras exige opt-in y preflight estricto. Nunca apuntar a una DB compartida.

La suite `repository-contract` también ejecuta los filtros opcionales de listados (usuario/vehículo, estado de mantenimiento/alerta/notificación, tipo de incidencia, filtros combinados de eventos del gabinete incluyendo `result=false` y estado de archivo GPS) contra el esquema oficial. Esto prueba sintaxis, tipos y parámetros con resultados vacíos; no valida proyecciones con filas para todas las combinaciones.

La suite de dominio prueba ownership con filas reales para asignación, jornada, movimiento, odómetro, préstamo, combustible, incidencia y sesiones/historial GPS: el propietario obtiene su recurso y un segundo usuario no obtiene el mismo ID ni lo incorpora a su listado. Son pruebas de repositorio con grants vacíos, no sustituyen autorización HTTP positiva por rol.

En el E2E HTTP con una sesión válida sin roles, la suite obtiene `docs/openapi.json`, reemplaza los parámetros de ruta por IDs de prueba y exige `403` para cada operación `GET` que declara `x-required-permissions`. Todas pasaron en la instancia efímera. Es una verificación de denegación para las rutas protegidas que OpenAPI declara; no demuestra que cada operación requiera un permiso ni concede acceso positivo.

## Unitarias

- Servicios: reglas de aplicación, traducción de resultados, permisos y límites; mocks para repositorios.
- DTO/configuración: entradas válidas/inválidas, IDs BIGINT, límites de paginación, enums, fechas y coordenadas.
- Configuración de producción: una conexión PostgreSQL falla antes de abrir HTTP con `PGSSL` ausente o `disable`; `verify-full` es requerido. Producción sin conexión conserva readiness no listo para permitir diagnósticos.
- Seguridad: hashes/rotación/revocación, expiración, autenticación fallida con respuestas uniformes, saneamiento de logger/excepciones, no serializar campos sensibles.
- Repositorios: valores parametrizados, filtros de propietario, mapeo BIGINT/Numeric como strings, consulta de datos mínimos y uso transaccional. Los mocks no prueban SQL real.
- No tratar cobertura de mocks como prueba de vistas, triggers o DDL.

## Integración PostgreSQL aislada

- Preflight de solo lectura: versión, PostGIS, schema/search_path, tablas, enums, vistas, índices, constraints, partición DEFAULT y triggers requeridos; permisos del rol real y columnas protegidas.
- Contratos SQL de cada repositorio y tipos; `EXPLAIN` para consultas de alto volumen.
- Evidencia limitada ya obtenida: `EXPLAIN (COSTS OFF)` de lookup GPS por UUID recorrió `Merge Append` y usó índices únicos de cada partición en la DB efímera. Esto valida que el plan puede usar esos índices, no su latencia ni comportamiento bajo volumen.
- Escrituras de dominio contra fixtures desechables: transacción/rollback, trigger de bitácora, cascadas previstas, actualización de dispositivo/última posición, estados derivados.
- Concurrencia con sesiones independientes: login por dispositivo, asignaciones, préstamo/movimiento por vehículo/usuario, idempotencia en reintentos. Esperar el constraint como última defensa.
- GPS: la prueba real contra el DDL actual confirma que la inserción falla con SQLSTATE `42703` porque `fn_notify_realtime` usa `NEW.id` en `ultima_posicion_gps`; valida rollback y ausencia de efectos parciales. Después de corregir oficialmente el DDL, probar posiciones válidas/límites/rechazadas, partición, sesión y triggers. No desactivar triggers para que pase la prueba.
- Suite HTTP: permisos 401/403, aislamiento entre usuarios, no filtrar hashes/PII, ownership en IDs. Escrituras solo con fixtures reservados y cleanup transaccional o recreación completa del contenedor.
- Autorización positiva por rol aprobada solo para fixture local: `PILOTO_BRIGADA` recibe temporalmente sus cinco permisos propuestos; validar `/vehicles/assigned` y `/assignments/me/active` (200), y `/vehicles/administrative/available` (403). El E2E verifica primero denegación sin grant y después elimina los vínculos y datos creados; comprobar conteos en cero al final.
- Flujo HTTP de jornada con el mismo fixture: `POST /journeys/me` da 403 antes del grant; después inicia con 201, reintenta el mismo UUID con 201 y el mismo ID, y finaliza por `PATCH /journeys/:id/finish` con 200 y movimiento/odómetro final esperados. El test recoge el límite de `bitacora` antes del fixture y elimina únicamente las filas de auditoría generadas durante esa prueba en la base aislada.
- En ese flujo autorizado se reporta combustible en el movimiento abierto (201) y se lee con alcance propio (200); se reporta una incidencia `ACCIDENTE` (201) y se consulta su detalle propio (200). Dos POST concurrentes con el mismo UUID devuelven el mismo ID para ambas operaciones; un replay con contenido distinto devuelve 409. PostgreSQL confirma una sola fila de combustible, una de odómetro y una de incidencia por UUID. Ambas escrituras reciben 403 antes del grant. El E2E usa datos sintéticos y elimina las filas junto al movimiento fixture.
- El E2E crea un segundo usuario con el mismo rol/permisos efectivos, pero sin asignación ni propiedad de esos recursos; al consultar los IDs de jornada, combustible e incidencia ajenos obtiene 404 en los tres casos. Esto verifica autorización a nivel de objeto detrás de un permiso válido.
- El servidor HTTP E2E usa `dercas_api_runtime`, sin superusuario, herencia, membresías, creación de objetos/DB/roles, borrado de filas ni lectura de gabinete. Sus UPDATE son solo de las columnas requeridas por auth, triggers de sesión y transición de jornada; el lock de asignación/vehículo solo permite UPDATE de `id`. El preflight afirma que no hay UPDATE completo de esas tablas ni permiso de modificar hashes de credenciales/propietarios. La identidad y privilegios se verifican antes de abrir Nest; la siembra/limpieza queda en el pool administrativo del contenedor desechable.
- Validación HTTP en el flujo con permisos: jornada con kilometraje/formato y propiedad extra inválidos, combustible con galones cero e incidencia con propiedad inesperada responden 400; las consultas posteriores verifican cero filas de jornada/movimiento/odómetro, combustible/odómetro e incidencia para esos UUID. Las rutas documentadas nullable de vehículo, asignación, jornada y GPS retornan el literal JSON `null` cuando no hay recurso, no una respuesta vacía.

## E2E

Ejecutar API y DB descartables integradas desde esquema aprobado. Flujos principales: login→refresh→logout; consulta de perfil; disponibilidad y solicitud de préstamo; operación propia de vehículo; combustible/odómetro; incidente; mantenimiento; alertas/notificaciones; consultas GPS. Cubrir permiso insuficiente, usuario ajeno, recurso inexistente, conflicto por estado, timeout/DB caída y reintento. Verificar forma HTTP y `Cache-Control: no-store`; Swagger ya tiene E2E HTTP aislado.

## Aceptación transversal

- Cada endpoint aparece en OpenAPI y en matriz de permisos.
- Validación rechaza propiedades no permitidas y límites excesivos.
- Queries SQL están parametrizadas; cada lectura restringida aplica alcance del principal.
- Escrituras compuestas son transaccionales y reintentables donde aplique; las constraints/triggers del SQL se verifican con DB real.
- No se retornan ni registran contraseñas, hashes de token, secretos ni SQL/stack traces al cliente.
- Suite de integración declara claramente DB objetivo y falla antes de ejecutar si no demuestra aislamiento.
- Pruebas de estrés/retención nunca se corren sobre datos operativos.

## Puertas por fase

1. **Fundación**: typecheck/lint/build pasan en CI; preflight DB y versión de esquema documentados.
2. **Seguridad**: matriz de permisos aprobada y casos positivos/negativos por objeto cubiertos.
3. **Flujos de escritura**: integración transaccional, trigger, idempotencia y conflicto concurrente pasan en DB descartable.
4. **Operación**: readiness, logging, TLS, backup/restore y monitoreo revisados en ambiente de ensayo.
5. **Publicación**: revisión de API/SQL y plan de reversa aprobados; ningún test depende de fixtures operativos.
