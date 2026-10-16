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

La referencia interactiva OpenAPI está en `/api/v1/docs`; el JSON está en `/api/v1/docs/openapi.json`. Los controladores protegidos declaran el esquema Bearer y las operaciones con permiso requerido incluyen la extensión `x-required-permissions`.

## Configuración

Copie `.env.example` a un mecanismo local de configuración o defina variables de entorno. Configure `AUTH_TOKEN_SECRET` mediante un gestor de secretos con un valor aleatorio de al menos 32 bytes; nunca use el marcador vacío del ejemplo. El administrador del VPS debe aportar posteriormente `DATABASE_URL` o `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER` y `PGPASSWORD`. No se incluyen valores ni credenciales de conexión. `PGSSL=disable` solo sirve para desarrollo local; con `NODE_ENV=production` y PostgreSQL configurado, la API rechaza el arranque salvo que `PGSSL=verify-full` active la validación del certificado y hostname.

## Comandos de verificación

```sh
npm test
npm run lint
npm run typecheck
npm run build
npm run sql:check
npm run openapi:check
```

`npm test` ejecuta unitarias con dobles de prueba; no necesitan PostgreSQL y no ejecutan el SQL de `docs/`. `npm run openapi:check` compila y verifica la especificación sin conectar a PostgreSQL. `npm run test:integration` está deshabilitado por defecto y solo debe usarse contra la instancia desechable confirmada. Las escrituras de dominio y E2E de autenticación usan el comando separado `npm run test:integration:domain-writes`, que exige además `PG_INTEGRATION_DOMAIN_WRITES_CONFIRMED=1` y rechaza destinos distintos de la DB local dedicada. Precondiciones, verificación del contenedor y cleanup están en [Preparación de integración PostgreSQL](docs/POSTGRES_INTEGRATION.md).

La estrategia y el arnés optativo de integración están descritos en [Preparación de integración PostgreSQL](docs/POSTGRES_INTEGRATION.md). Las pruebas de integración están excluidas de `npm test`.

La auditoría técnica, la arquitectura y el plan de cobertura están en [AUDIT.md](AUDIT.md), [ARCHITECTURE.md](ARCHITECTURE.md), [API_COVERAGE.md](API_COVERAGE.md), [API_ROADMAP.md](API_ROADMAP.md) y [TEST_STRATEGY.md](TEST_STRATEGY.md). La [matriz de autorización](PERMISSION_MATRIX.md) cataloga roles/permisos del DDL y rutas actuales; las asociaciones rol→permiso requieren aprobación del responsable.
