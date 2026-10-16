# Arquitectura propuesta

## Principios

1. Mantener NestJS modular, DTOs/validación en entrada, servicios para casos de uso y repositorios para SQL parametrizado.
2. PostgreSQL es fuente de verdad para integridad, enums, restricciones, triggers, vistas y operaciones almacenadas ya definidas. No duplicar esos invariantes en lógica paralela; la capa de servicio coordina el caso de uso, autorizaciones y respuesta HTTP.
3. Toda operación que combine cambios y bitácora debe ejecutarse en una transacción. Conservar contexto de auditoría transaccional. Traducir errores conocidos de constraint a conflictos de dominio/HTTP sin revelar SQL ni datos; no ocultar errores desconocidos.
4. Autorizar tanto acción como objeto. Los predicados de ownership/alcance organizacional forman parte de SQL; permisos efectivos se obtienen desde el catálogo vigente. Ningún ID de URL es autorización.
5. Cuentas PostgreSQL distintas por ambiente y mínimo privilegio. No otorgar funciones de retención o purga al usuario HTTP. Evaluar RLS como defensa en profundidad, con variable de sesión transaccional y pruebas antes de activarla.
6. Contratos explícitos: BIGINT como string, NUMERIC con precisión, fechas ISO y coordenadas en WGS84. Idempotency key para reintentos de operaciones móviles.

Para crear sesiones de dispositivo, la transacción bloquea las filas de identidad con `FOR UPDATE` antes de limpiar sesiones vencidas e insertar. Esto serializa intentos simultáneos y reduce el riesgo de espera circular observado con el patrón anterior de bloqueos compartidos y actualización de último acceso; el índice parcial de PostgreSQL sigue como última defensa. La integración comprobó una respuesta `201` y una `409` en la carrera para el mismo dispositivo.

## Capas y módulos

- **HTTP transversal**: prefijo/versionado, autenticación, guards de permiso, validación estricta, filtro de excepciones, request ID, `Cache-Control: no-store`, logging sin secretos, health/live y health/ready. OpenAPI se genera desde metadatos Nest/DTO; `RequirePermissions` documenta `x-required-permissions` y los controladores protegidos declaran Bearer.
- **Identidad**: Auth (credenciales, sesión de dispositivo, renovación, revocación), Users/Access (perfil propio, administración según permiso). Tokens opacos/hash de refresh y secreto de firma gestionado fuera del repo.
- **Flota**: Vehicles, Assignments, Loans, Journeys, Movements y Odometer. Coordinar lecturas/escrituras en transacciones e índices únicos; PostgreSQL determina disponibilidad y estados persistidos.
- **Operación**: Fuel, Maintenance, Incidents, Alerts, Notifications. Flujos que tocan varias tablas deben ser atómicos e idempotentes, disparando efectos de esquema una sola vez.
- **Dispositivos**: GPS lectura y una futura puerta de ingesta con autenticación de hardware; Cabinet lectura/operación física solo tras definir protocolo confiable. Mantener almacenamiento GPS/particiones y PostGIS dentro de DB.
- **Administración**: Reports, Evidence, catálogos, retención y trabajos fuera del API interactivo. Procesos destructivos separados, auditados, aprobados y con permisos específicos.
- **Persistencia**: `DatabaseService`/`pg`, repositorios por agregado, consultas parametrizadas, transacciones unit-of-work. Sin ORM que vuelva a implementar reglas ya presentes en DDL.

## Permisos por área (propuesta para aprobar)

Los nombres entre comillas son permisos ya visibles en código; no se presupone qué roles de negocio los contienen.

| Rol/capacidad | Acceso recomendado |
|---|---|
| Usuario autenticado | Su perfil y acceso propios; sus alertas/notificaciones; sus sesiones/estado GPS propio según la política ya aplicada. |
| Piloto/brigadista | `VEHICULO_USAR_ASIGNADO`: vehículo/asignación, jornadas/movimientos, odómetro, GPS histórico propio y consultas de mantenimiento de su vehículo; `INCIDENCIA_REPORTAR`; reportar combustible solo cuando aplique la operación. |
| Conductor administrativo | `VEHICULO_USAR_ADMINISTRATIVO`: solicitudes/lectura de préstamos disponibles y movimientos propios del préstamo. |
| Operador autorizado | `GABINETE_VER` para lectura. Comandos de gabinete requieren identidad del equipo, firma/protocolo, replay protection y permisos separados; no están cubiertos por lecturas actuales. |
| Mantenimiento | `MANTENIMIENTO_CREAR` para altas; separar permiso para actualizar/cerrar órdenes y modificar planes/catálogos, actualmente no evidenciado como CRUD completo. |
| Supervisor de flota | Permisos separados para asignar/cancelar asignaciones, operar incidentes, revisar flota y reportes; no asumir rol existente sin catálogo/decisión. |
| Administrador de usuarios | `USUARIOS_ADMINISTRAR`; separar gestionar roles/permisos de solo lectura de usuario cuando se construya escritura. |
| Administrador GPS | `GPS_HISTORICO_VER` y permisos explícitos para configuración/archivo/restauración; las rutas de lectura hoy agrupan alcance y deben revisarse por datos personales/ubicación. Purga separada. |
| Servicio de hardware | Credenciales por dispositivo, scopes mínimos y endpoints dedicados; no una sesión humana estándar. |
| Proceso de mantenimiento DB | Rol distinto y credencial no accesible al proceso HTTP para retención, particiones y purgas. |

## Contratos y límites

La API debe documentar paginación y filtros máximos, códigos de conflicto por constraints, idempotencia, timestamps del cliente frente al servidor, retención/privacidad GPS, acceso a evidencias y semántica de transiciones. `Cache-Control: no-store` se aplica transversalmente; faltan límites de solicitudes y rate limits. La configuración ahora exige TLS `verify-full` cuando producción conecta a PostgreSQL; deben comprobarse certificado/CA en el ambiente de ensayo. Proxy explícito requiere una lista de confianza aprobada.

## Decisiones pendientes

Responsable debe aprobar taxonomía final de roles/permisos, límites de datos de GPS e incidencias, flujo de evidencia/almacenamiento, autenticación de hardware, operaciones de gabinete, estrategia de migración/versionado del SQL ya existente, despliegue y política TLS/CA. No reemplazar ni recrear el esquema proporcionado.
