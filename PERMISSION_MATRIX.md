# Propuesta de matriz de autorización — para revisión

**Estado: propuesta aprobada para fixtures E2E locales.** El responsable aprobó usar esta propuesta para probar autorización positiva por rol en una base desechable. Esto no autoriza seed permanente ni cambios en bases compartidas o productivas. Las asignaciones de roles restantes y las condiciones operativas continúan sujetas a decisión.

## Base comprobada

El SQL oficial declara seis roles, 23 permisos y las tablas `rol_permiso` y `usuario_rol`. El seed carga roles y permisos, pero no asocia ninguno. En la base desechable se verificó: seis roles, 23 permisos, cero filas en `gacor.rol_permiso` y cero en `gacor.usuario_rol`.

`PermissionsGuard` exige todos los códigos efectivos del principal. `@RequirePermissions` declara el contrato del controlador y OpenAPI; el verificador contrasta cada código con el catálogo SQL, pero no demuestra que un rol deba recibirlo.

## Matriz propuesta para los roles del DDL

Leyenda: **Sí** = propuesta para revisión; **Condicional** = aprobar solo tras resolver el alcance o riesgo de la columna; **No propuesto** = no se deduce de la descripción del rol; **—** = no asignar hasta decisión funcional.

| Rol DDL | Permisos propuestos | Condiciones y límites |
|---|---|---|
| `ADMINISTRADOR` | Los 23 permisos del catálogo, por la descripción DDL “Control total de la plataforma”. | Elevación de roles, liberación especial de llaves y purga GPS son sensibles: exigir MFA, autorización reforzada, auditoría y doble aprobación operativa. El DDL no representa esas condiciones; deben resolverse antes de habilitar las acciones. |
| `ENCARGADO_VEHICULOS` | `GABINETE_VER`, `GABINETE_LIBERAR_LLAVE`, `MANTENIMIENTO_CREAR`, `MANTENIMIENTO_FINALIZAR` | La descripción DDL menciona flota, gabinete y mantenimiento. No se propone liberación especial. La ruta actual de crear mantenimiento solo opera sobre vehículo asignado al propio usuario; hace falta ruta/alcance administrativo antes de que este rol pueda gestionar la flota. |
| `SUPERVISOR` | `REPORTES_VER`, `GPS_VER_TIEMPO_REAL`, `GPS_HISTORICO_VER` — **condicionales** | La descripción menciona supervisar pilotos, alertas e incidencias, pero las rutas existentes de mapa e historial GPS son globales y no hay rutas administrativas para consultar/atender incidencias o alertas. Aprobar solo tras definir ámbito de brigada, retención y visibilidad. No se propone `REPORTES_VER_TODOS` sin alcance aprobado. |
| `PILOTO_BRIGADA` | `VEHICULO_USAR_ASIGNADO`, `JORNADA_INICIAR`, `JORNADA_FINALIZAR`, `COMBUSTIBLE_REPORTAR`, `INCIDENCIA_REPORTAR` | Coincide con la operación propia observada. El acceso se limita a vehículo/movimiento/asignación del principal. Anulación de jornada no está implementada ni propuesta. `GPS_HISTORICO_VER` queda condicional hasta separar el historial propio de la consulta global por vehículo. |
| `PILOTO_ADMINISTRATIVO` | `VEHICULO_USAR_ADMINISTRATIVO` | Permite solicitar vehículos administrativos disponibles. No habilita retiro, inicio de movimiento o devolución: esas transiciones físicas/de préstamo no están expuestas por la API. `COMBUSTIBLE_REPORTAR` e `INCIDENCIA_REPORTAR` quedan pendientes de confirmar cuando exista el flujo de uso administrativo completo. |
| `OPERADOR_FLOTA` | `VEHICULO_USAR_CUALQUIERA`, `VEHICULO_USAR_ADMINISTRATIVO`, `GABINETE_VER`, `GABINETE_LIBERAR_LLAVE` — **condicionales** | La descripción permite movilizar vehículos por autorización especial. Definir quién autoriza cada movimiento, registro de motivo y alcance. No se propone `GABINETE_LIBERACION_ESPECIAL` de forma ordinaria. Las rutas de movimiento y gabinete no implementan todavía todas esas operaciones. |

## Revisión permiso por permiso

Los permisos se deben asignar por la tabla de roles anterior, sujetando los condicionales a las notas de alcance.

| Código | Uso observado en rutas | Alcance que falta confirmar |
|---|---|---|
| `VEHICULO_USAR_ASIGNADO` | Asignaciones propias, jornadas, mantenimiento propio, movimientos asignados, odómetro y vehículos asignados | Propiedad de piloto y vehículo asignado activo; confirmar comportamiento histórico tras cerrar asignación. |
| `VEHICULO_USAR_ADMINISTRATIVO` | Préstamos/solicitud y disponibilidad administrativa | Solicitar vs. conducir/retiro/devolución son capacidades distintas; rutas actuales cubren solicitud y consulta, no el ciclo físico. |
| `VEHICULO_USAR_CUALQUIERA` | Sin ruta actual | Autorización especial por movimiento, aprobador y motivo. |
| `JORNADA_INICIAR`, `JORNADA_FINALIZAR` | `POST /journeys/me`, `PATCH /journeys/{id}/finish` | Piloto con asignación activa; confirmar si roles de flota pueden intervenir. |
| `COMBUSTIBLE_REPORTAR` | `GET/POST /fuel/*` | El repositorio filtra por usuario/movimiento propio; confirmar reportes ligados a préstamos administrativos. |
| `GABINETE_VER` | `GET /cabinet/*` | Lectura de todo el gabinete o solo una sede/área. |
| `GABINETE_LIBERAR_LLAVE`, `GABINETE_LIBERACION_ESPECIAL` | Sin ruta de escritura | Protocolo ESP32, step-up, aprobación y deduplicación pendientes; no habilitar. |
| `MANTENIMIENTO_CREAR`, `MANTENIMIENTO_FINALIZAR` | `POST /maintenance/me/orders` usa `MANTENIMIENTO_CREAR` junto con `VEHICULO_USAR_ASIGNADO`; sin ruta de finalizar | Aclarar permiso y ruta administrativa; no convertir el endpoint propio en acceso global. |
| `INCIDENCIA_REPORTAR` | `POST /incidents`, `/incidents/emergencies`, historial y detalle propio | Las rutas leen/reportan con ownership; no existe permiso separado de atender/cerrar. El supervisor no puede “supervisar” con este permiso por sí solo. |
| `REPORTES_VER`, `REPORTES_VER_TODOS` | Sin endpoint de reportes | Definir primero rutas, filtros y diferencia entre ámbito autorizado y global. |
| `USUARIOS_ADMINISTRAR` | GET administrativo de usuarios/permisos | Separar lectura, edición, alta, desactivación y asignación de roles si se implementan; hoy solo hay consultas. |
| `ROLES_ADMINISTRAR`, `CONFIGURACION_ADMINISTRAR` | Sin rutas actuales | Cambios privilegiados con auditoría y MFA; no implementar asociaciones automáticas. |
| `GPS_VER_TIEMPO_REAL` | `GET /gps/vehicles/latest` | Mapa global; definir si el supervisor ve su brigada o toda la flota. |
| `GPS_ADMINISTRAR` | Lectura actual de configuración y perfiles; no hay escritura | No otorgar hasta decidir quién puede cambiar perfil, iniciar/pausar seguimiento y con qué auditoría. |
| `GPS_HISTORICO_VER` | Sesiones/restauraciones propias y posiciones por `vehicleId` | Un mismo permiso combina recurso propio y consulta potencialmente global; separar código o imponer alcance del principal antes de otorgarlo a pilotos. |
| `GPS_ARCHIVAR`, `GPS_PURGAR` | Lectura actual de archivos/retención; sin endpoint de purga | Archivar y purgar son acciones diferentes; purga destructiva requiere procedimiento independiente y doble control. |
| `DISPOSITIVOS_ADMINISTRAR` | GET administrativo de dispositivos | Definir datos sensibles visibles y ciclo de alta/revocación. |

## Bloqueos detectados en la API actual

- `SUPERVISOR` no tiene permiso específico para leer/atender alertas o incidencias; `INCIDENCIA_REPORTAR` no equivale a supervisar.
- `ENCARGADO_VEHICULOS` no puede crear una orden para flota global mediante la ruta existente: `POST /maintenance/me/orders` usa la asignación propia.
- `PILOTO_ADMINISTRATIVO` puede solicitar un préstamo, pero no existe el resto del flujo de liberación, retiro, movimiento y devolución.
- `GPS_HISTORICO_VER` protege tanto rutas propias como la consulta de posiciones por vehículo, cuyo repositorio no recibe principal para filtrar alcance.
- La API no contiene escritura GPS autenticada por dispositivo; no asociar permisos de usuario a ese protocolo aún inexistente.

## Aprobación del responsable

La aprobación recibida permite que el test E2E local inserte temporalmente el rol `PILOTO_BRIGADA` y sus cinco permisos propuestos y los elimine al terminar. Las asociaciones generales y los roles restantes siguen pendientes; no se cambiará el DDL ni se sembrarán grants en bases compartidas o productivas. Siguen por decidir estos límites: alcance del supervisor; gestión administrativa de mantenimiento; ciclo de préstamo; acceso GPS histórico/global; acciones privilegiadas de gabinete y purga GPS.
