# API DERCAS

API para GACOR S.A., desarrollada con NestJS, TypeScript y PostgreSQL mediante el cliente `pg` y consultas SQL parametrizadas.

## Estado de esta etapa

La API incluye autenticación propia, autorización basada en permisos efectivos, consultas personales y administrativas, y operaciones de escritura seleccionadas con auditoría transaccional.

Los módulos implementados abarcan vehículos, préstamos, movimientos, jornadas, asignaciones personales, combustible, odómetro, mantenimiento, incidencias y emergencias, alertas y notificaciones, gabinete, GPS de lectura, usuarios y diagnóstico de dispositivos. El alcance funcional y las limitaciones de cada módulo se documentan en los informes de auditoría y cobertura.

El flujo de almacenamiento de evidencias y los endpoints de reportes todavía no están implementados. La ingesta de posiciones GPS desde dispositivos permanece deshabilitada hasta definir un protocolo de autenticación de hardware y su modelo de autorización. Tampoco están implementadas las transiciones físicas del gabinete.

Las pruebas unitarias utilizan dobles de prueba y no validan por sí solas el comportamiento de PostgreSQL. Existen suites de integración separadas para verificar contratos, acceso a datos y flujos HTTP en una base de pruebas desechable. La cobertura de vistas, funciones, triggers, PostGIS y privilegios reales depende de los casos que ejecute cada suite; no debe asumirse que todos están cubiertos.

## Ejecutar localmente

Instale las dependencias:

```bash
npm install
```

Configure las variables de entorno siguiendo la sección siguiente y arranque el servidor:

```bash
npm run start:dev
```

La aplicación requiere `AUTH_TOKEN_SECRET` con al menos 32 bytes antes de abrir el puerto HTTP. Puede arrancar sin conexión PostgreSQL configurada, pero `/api/v1/health/ready` no estará listo hasta que la base de datos esté correctamente configurada y accesible. `/api/v1/health/live` indica si el proceso está activo.

La documentación interactiva OpenAPI está disponible en `/api/v1/docs` y el documento JSON en `/api/v1/docs/openapi.json`. Las operaciones protegidas documentan el esquema Bearer; las operaciones con permisos requeridos incluyen la extensión `x-required-permissions`.

## Configuración

Copie `.env.example` como referencia para su configuración local o defina las variables de entorno mediante el mecanismo de configuración de su entorno.

Configure `AUTH_TOKEN_SECRET` con un valor aleatorio de al menos 32 bytes. No utilice el marcador vacío del ejemplo ni almacene secretos reales en el repositorio.

El administrador del entorno deberá proporcionar `DATABASE_URL` o las variables `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER` y `PGPASSWORD`. El repositorio no debe contener credenciales reales de conexión.

`PGSSL=disable` está destinado al desarrollo local. En producción, cuando PostgreSQL está configurado, la aplicación exige `PGSSL=verify-full` para validar el certificado y el nombre del servidor.

## Comandos de verificación

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run sql:check
npm run openapi:check
```

Las pruebas unitarias se ejecutan con `npm test`; utilizan dobles de prueba y no requieren una conexión a PostgreSQL.

`npm run openapi:check` compila la aplicación y verifica el contrato OpenAPI. `npm run sql:check` valida los elementos del contrato SQL que comprueba el script correspondiente. Estas comprobaciones no sustituyen las pruebas de integración contra PostgreSQL.

Las pruebas de integración se ejecutan por separado:

```bash
npm run test:integration
npm run test:integration:domain-writes
```

**Importante:** ejecute las pruebas de integración únicamente contra la base PostgreSQL/PostGIS desechable prevista para ellas. Los flujos de escritura requieren la confirmación explícita mediante `PG_INTEGRATION_DOMAIN_WRITES_CONFIRMED=1` y validan que el destino sea la base local dedicada. No utilice bases de producción ni compartidas.

Las precondiciones, la configuración del contenedor, las restricciones de seguridad y la limpieza de datos están documentadas en [Preparación de integración PostgreSQL](https://github.com/JoelMejia12/dercas-api-v2/blob/main/docs/POSTGRES_INTEGRATION.md).

Las pruebas de integración están excluidas de `npm test`.

## Documentación técnica

- [Auditoría técnica](https://github.com/JoelMejia12/dercas-api-v2/blob/main/AUDIT.md)
- [Arquitectura](https://github.com/JoelMejia12/dercas-api-v2/blob/main/ARCHITECTURE.md)
- [Cobertura de la API](https://github.com/JoelMejia12/dercas-api-v2/blob/main/API_COVERAGE.md)
- [Plan de trabajo](https://github.com/JoelMejia12/dercas-api-v2/blob/main/API_ROADMAP.md)
- [Estrategia de pruebas](https://github.com/JoelMejia12/dercas-api-v2/blob/main/TEST_STRATEGY.md)
- [Matriz de permisos](https://github.com/JoelMejia12/dercas-api-v2/blob/main/PERMISSION_MATRIX.md)
- [Integración PostgreSQL](https://github.com/JoelMejia12/dercas-api-v2/blob/main/docs/POSTGRES_INTEGRATION.md)

La matriz de permisos documenta los roles, permisos y rutas identificados. Las asociaciones permanentes entre roles y permisos deben ser aprobadas por el responsable del sistema antes de aplicarse.