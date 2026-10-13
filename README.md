# API DERCAS

Fundamentos del API para GACOR S.A., construido con NestJS, TypeScript y PostgreSQL mediante `pg` y SQL parametrizado.

## Estado de esta etapa

El API cuenta con autenticación propia, autorización por permisos efectivos, consultas personales y administrativas acotadas, y operaciones de escritura seleccionadas con `pg`, SQL parametrizado y auditoría transaccional. Incluye módulos para vehículos, préstamos, movimientos, jornadas (lectura), asignaciones personales, combustible, odómetro, mantenimiento, incidencias/emergencias, alertas/notificaciones, gabinete (lectura), GPS (lectura), usuarios y diagnóstico de dispositivos. La evidencia todavía no tiene flujo de almacenamiento ni endpoints.

La integración de escrituras GPS desde dispositivos permanece deshabilitada hasta definir autenticación de hardware y protocolo. No se implementaron transiciones físicas del gabinete. Las pruebas automatizadas usan mocks y no validan las vistas, funciones, triggers, PostGIS ni permisos reales de PostgreSQL.

## Ejecutar localmente

```sh
npm install
npm run start:dev
```

El proceso puede arrancar sin parámetros PostgreSQL, pero requiere `AUTH_TOKEN_SECRET` de al menos 32 bytes antes de abrir el puerto HTTP. `/api/v1/health/live` indica que el proceso está activo; `/api/v1/health/ready` responde no listo hasta que el administrador configure la base.

## Configuración

Copie `.env.example` a un mecanismo local de configuración o defina variables de entorno. Configure `AUTH_TOKEN_SECRET` mediante un gestor de secretos con un valor aleatorio de al menos 32 bytes; nunca use el marcador vacío del ejemplo. El administrador del VPS debe aportar posteriormente `DATABASE_URL` o `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER` y `PGPASSWORD`. No se incluyen valores ni credenciales de conexión. Para TLS se admite `PGSSL=verify-full`; `disable` es el valor por defecto para desarrollo y no debe asumirse adecuado para redes remotas.

## Comandos de verificación

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

Las pruebas incluidas usan dobles de prueba; no necesitan PostgreSQL y no ejecutan el SQL de `docs/`.

La estrategia y el arnés optativo para integración futura están descritos en [Preparación de integración PostgreSQL](docs/POSTGRES_INTEGRATION.md). Las pruebas de integración están excluidas de `npm test` y no se han ejecutado.
