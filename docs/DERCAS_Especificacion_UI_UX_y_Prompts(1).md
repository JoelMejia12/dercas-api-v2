# DERCAS · GACOR S.A.
## Especificación integral de UI/UX y prompts de diseño

Portal web primero · Aplicación móvil después  
Versión de propuesta: 1.0 · 7 de septiembre de 2026

Este documento describe cómo debe verse y comportarse DERCAS en sus pantallas principales, formularios, detalles, diálogos y estados alternativos. Es una especificación de diseño para crear prototipos y orientar el desarrollo; no representa un sistema ya implementado ni una aprobación de las decisiones pendientes.

### Fuentes y lectura de la propuesta

**[F1]** «DERCAS GACOR S.A. v2.0 - Gestión Vehicular-1.pdf», versión 2.0, 14/08/2026. Fuente funcional: apartados 5–17 y 20; RF-001 a RF-039, RNF-001 a RNF-016, RN-001 a RN-020 y CU-001 a CU-010.

**[F2]** «Planificacion_Formal_Desarrollo_DERCAS_GACOR.docx», versión interna 1.1, 29/08/2026. Complementa arquitectura, Angular obligatorio, estados, recuperación, sincronización, entregas y decisiones D-01 a D-10.

Las funciones de negocio se basan en estas fuentes. La composición visual, nombres de navegación, tamaños, colores, microtextos, distribución de formularios y pantallas auxiliares son **propuestas de UI/UX**. Los permisos finos, políticas y umbrales siguen sujetos a validación. Los datos de ejemplo son ficticios y deben rotularse como demostración.

### Cómo utilizar los prompts

1. Para diseñar el portal, copiar el **prompt maestro web** de la parte I y adjuntar sus fichas W01–W40 y las reglas comunes.
2. Para diseñar la app, copiar el **prompt maestro móvil** de la parte II y adjuntar las fichas M01–M28 y las reglas comunes.
3. Trabajar por módulo, manteniendo el mismo sistema visual y los mismos datos de demostración.
4. Para diseñar una sola pantalla, utilizar la plantilla de prompt por pantalla del cierre y pegar la ficha correspondiente.
5. Exigir los estados alternativos y las conexiones del flujo; una colección de pantallas sin comportamiento no completa esta especificación.

---

# PARTE I · PORTAL WEB

## 1. Prompt maestro web listo para copiar

> Actúa como diseñador senior de producto, especialista en UX de operaciones de flota e interfaces empresariales. Diseña el portal web DERCAS de GACOR S.A., destinado a administración de vehículos, pilotos, asignaciones, préstamos administrativos, custodia de llaves mediante gabinete inteligente, jornadas, combustible, mantenimiento, incidencias, emergencias, evidencias, auditoría y reportes.
>
> El portal se implementará obligatoriamente con Angular y TypeScript estricto. Diseña componentes reutilizables, formularios reactivos y rutas por dominio. No sustituyas Angular ni asumas que la app móvil utiliza el mismo framework. En esta etapa entrega diseño y especificación, no despliegue.
>
> Respeta dos operaciones diferentes: aproximadamente cuatro vehículos administrativos compartidos, cuyas llaves se custodian en un gabinete de hasta cuatro posiciones; y aproximadamente veinte vehículos de brigada asignados a pilotos por semanas o meses. Las cantidades son referencias iniciales, no cifras fijas del dashboard. Una jornada de brigada no exige retirar o devolver llaves al gabinete.
>
> Crea una interfaz empresarial sobria, moderna, clara y orientada a resolver pendientes. Utiliza fondo gris claro, superficies blancas, navegación azul profundo, acciones primarias azules, tipografía legible y estados con icono y texto. No conviertas el dashboard en una pared de gráficas decorativas. Prioriza emergencias, mantenimiento crítico, reportes incompletos, anomalías y préstamos prolongados.
>
> Diseña las fichas W01–W40 de esta especificación. Para cada vista entrega composición, jerarquía, contenido, campos, acciones, navegación, permisos, validaciones, estados de carga, vacío, error, éxito, datos desactualizados y adaptación responsiva. Incluye variantes por rol y prototipos navegables de CU-001 a CU-010.
>
> No cierres préstamos sin bloqueo físico confirmado. No representes una orden enviada como apertura confirmada. No muestres datos antiguos del gabinete como disponibilidad actual. Distingue el estado de la llave, el estado operativo del vehículo y el estado del préstamo. Las correcciones deben conservar valor anterior, nuevo, autor y motivo.
>
> Aplica acceso por rol y brigada. Ocultar botones no sustituye validación de permisos. El supervisor accede a su ámbito; el usuario administrativo a su uso personal. Los permisos sensibles deben ser explícitos.
>
> No agregues GPS permanente, rutas en vivo, diagnóstico OBD-II, telemetría de tanque, encendido remoto ni integraciones con aseguradoras o autoridades. La ubicación solo aparece puntualmente en emergencias cuando existe permiso y disponibilidad. No inventes aprobaciones jerárquicas, reservas con calendario ni biometría obligatoria: presenta estas políticas como pendientes de validación.
>
> Usa español claro, quetzales, kilómetros y galones. Muestra fechas legibles y zona horaria operativa de Guatemala como propuesta configurable. Las métricas deben indicar período, unidad, origen y datos insuficientes. Nunca inventes rendimientos ni uses cero para datos desconocidos.
>
> Entrega primero el sistema visual y el mapa de navegación; luego las pantallas organizadas por módulos; finalmente los flujos conectados, estados excepcionales, inventario de componentes y criterios de aceptación. Todo elemento visible debe tener una función comprensible.

## 2. Dirección visual y estructura del portal

### 2.1 Apariencia propuesta

La primera impresión debe ser la de un centro de operación de flota ordenado. El área principal usa espacio suficiente para distinguir prioridades; las tablas permiten revisar muchos vehículos sin perder legibilidad. El logo real se incorporará cuando esté disponible: mientras tanto utilizar la marca tipográfica «DERCAS · GACOR S.A.» sin inventar un emblema corporativo oficial.

| Elemento | Especificación propuesta |
|---|---|
| Fondo de aplicación | #F4F7FB |
| Superficies | #FFFFFF, borde #DDE4EE |
| Navegación lateral | #12243A, texto claro |
| Acción principal | #1D4ED8, texto blanco |
| Texto principal / secundario | #172033 / #526176 |
| Éxito | Texto #166534 sobre fondo #DCFCE7 |
| Advertencia | Texto #92400E sobre fondo #FEF3C7 |
| Error o crítico | Texto #991B1B sobre fondo #FEE2E2 |
| Información | Texto #1E40AF sobre fondo #DBEAFE |
| Tipografía | Inter; alternativa de sistema si no está disponible |
| Tamaños | Título 28–32 px; sección 20–24 px; cuerpo 16 px; tabla 14–16 px |
| Espaciado | Escala 4, 8, 12, 16, 24, 32 y 48 px |
| Contenedores | Radios 10–12 px; sombras sutiles solo para elevación |
| Controles | Altura habitual 44 px, etiquetas externas visibles |
| Iconos | Una única familia de trazos; siempre con etiqueta en acciones críticas |

Verificar contraste en la implementación y conservar foco visible. No usar gris muy claro para información importante. Evitar degradados extensos, cristales translúcidos, animaciones ornamentales y fotografías de relleno.

### 2.2 Estructura común

En escritorio de referencia de 1440 × 900 px: barra lateral de unos 248 px, barra superior de 64 px y contenido con márgenes de 24–32 px. La barra lateral puede contraerse conservando etiquetas accesibles. La barra superior contiene búsqueda dentro del ámbito permitido, notificaciones, ayuda y perfil. La búsqueda global es una propuesta de conveniencia y reutiliza los registros ya autorizados.

Cada página comienza con ruta de navegación, título, descripción de una línea y acción principal. Debajo aparecen filtros, indicadores relevantes y contenido. Los filtros activos se muestran como etiquetas removibles con «Limpiar filtros». Conservar búsqueda, filtros, orden y página al abrir y cerrar un expediente.

En tablet, navegación en panel desplegable y formularios de una o dos columnas. En ancho pequeño, una columna; tablas convertidas a tarjetas para consultas frecuentes o desplazamiento horizontal localizado con placa e identificación visibles. Nunca obligar a desplazar toda la página horizontalmente.

### 2.3 Navegación propuesta

- **Inicio:** resumen y pendientes prioritarios.
- **Operación:** vehículos, pilotos, asignaciones, préstamos, gabinete y jornadas.
- **Control de flota:** combustible, mantenimiento, incidencias y emergencias.
- **Análisis:** dashboard analítico, reportes e historial.
- **Administración:** usuarios, permisos, catálogos, parámetros, evidencias, auditoría y estado del sistema.
- **Mi cuenta:** perfil, sesiones y ayuda.

Mostrar únicamente secciones pertinentes al usuario. Para el usuario administrativo, sustituir la navegación extensa por Inicio, Solicitar vehículo, Mi préstamo, Mi historial y Ayuda. El piloto desarrolla su trabajo principalmente en la app.

### 2.4 Alcance por rol

Esta matriz traduce los roles de F1, apartado 8; la autorización definitiva corresponde a D-02 de F2.

| Rol | Inicio y consultas | Operación | Límites y permisos especiales |
|---|---|---|---|
| Administrador | Visión global | Usuarios, parámetros, flota y funciones autorizadas | Apertura excepcional y cambios sensibles con permiso y motivo |
| Encargado de Vehículos | Pendientes de flota | Asignaciones, validaciones, mantenimientos, gabinete e incidencias | No asumir administración de seguridad por defecto |
| Supervisor | Su personal y brigadas | Seguimiento de jornadas, alertas y emergencias | Ajustes o desbloqueos solo si se otorgan expresamente |
| Piloto | Vehículo activo e historial propio | Jornadas, combustible, incidencias y pánico desde app | Sin reasignación ni correcciones de terceros |
| Usuario administrativo | Disponibilidad y registros propios | Solicitud, retiro, combustible y devolución | Sin acceso a expedientes privados de otros usuarios |

Una persona puede tener más de una función si se aprueba. En ese caso, ofrecer cambio visible de contexto; evitar que ese cambio cree o amplíe permisos.

## 3. Pantallas del portal web

### W01 · Inicio de sesión

**Vista.** Panel central compacto con marca, título «Ingresa a DERCAS», identificador y contraseña. En escritorio puede acompañarse de un panel sobrio con una frase sobre la gestión de flota; en móvil se elimina ese panel. Etiquetas encima de los campos, mostrar/ocultar contraseña y botón «Ingresar» de ancho completo.

**Comportamiento.** El método depende de D-01: dibujar credenciales como variante inicial, no como decisión aprobada. Mostrar acceso corporativo únicamente si se adopta. Incluir recuperación de acceso y contacto de soporte. Sin registro público de cuentas.

**Estados.** Credenciales incorrectas con mensaje general; cuenta inactiva con ruta a soporte; servicio temporalmente no disponible con reintento. Durante ingreso, bloquear envíos repetidos. Tras autenticar, abrir el inicio correspondiente al rol o la ruta autorizada solicitada.

### W02 · Recuperación y restablecimiento de acceso

**Vista.** Secuencia breve: solicitar recuperación, aviso de envío y nueva contraseña cuando el mecanismo aprobado lo permita. Instrucciones claras y requisitos de contraseña visibles antes de escribir.

**Comportamiento.** Mensaje de solicitud uniforme, exista o no la cuenta. Enlace vencido con «Solicitar otro». Si se usa directorio corporativo, orientar al canal correspondiente en lugar de presentar un formulario que no funciona. Confirmar el cambio y regresar al ingreso.

### W03 · Inicio operativo por rol

**Vista.** Título «Resumen de operación», período y última actualización. Primera franja: emergencias abiertas, mantenimiento crítico, jornadas incompletas y préstamos que requieren seguimiento. Cada tarjeta lleva cantidad, descripción y enlace filtrado.

**Contenido.** Debajo, disponibilidad administrativa y situación de brigadas en bloques separados. Tabla «Requiere tu atención» con prioridad, vehículo, responsable, motivo, antigüedad y siguiente acción. Añadir actividad reciente al final.

**Variantes.** Administrador: panorama global; Encargado: gestión diaria; Supervisor: su personal; usuario administrativo: vehículo disponible y préstamo propio. Un período sin pendientes muestra «No tienes pendientes en este período», sin indicadores ficticios.

**UX.** Una emergencia nueva permanece visible; una falla de un bloque no vacía toda la página. Señalar fecha de actualización por bloque si difiere.

### W04 · Inventario de vehículos

**Vista.** Filtros por placa, tipo, brigada, estado y responsable. Tabla con placa destacada, marca/modelo, tipo, responsable, kilometraje válido y fecha, estado operativo, mantenimiento y acciones.

**Acciones.** «Registrar vehículo», «Ver expediente» y cambio de estado según permiso. Las filas abren W05; el menú secundario concentra editar y restringir. Fotografía opcional sin desplazar los datos esenciales.

**Estados.** Diferenciar disponible, prestado, asignado, reservado, mantenimiento, fuera de servicio y restringido. Si no hay inventario, explicar cómo registrar o importar; si los filtros no coinciden, ofrecer limpiarlos. Desactivar funciones incompatibles con el tipo de vehículo.

### W05 · Expediente de vehículo

**Vista.** Cabecera persistente con placa, tipo, estado, responsable y kilometraje validado con origen y fecha. Pestañas: Resumen, Préstamos/asignaciones, Jornadas, Combustible, Mantenimiento, Incidencias y Evidencias. El historial unificado se consulta desde un enlace destacado.

**Contenido.** Resumen con datos de identificación, próximo servicio y restricciones. Mostrar gabinete/posición solo en vehículos administrativos. Mostrar asignación prolongada en brigadas. La identidad del vehículo permanece visible al cambiar de pestaña.

**Acciones.** Editar datos, gestionar asignación, registrar mantenimiento y cambiar estado según permiso. Una restricción incluye quién la estableció, fecha y motivo. No presentar «Disponible» cuando el vehículo está restringido aunque la llave esté guardada.

### W06 · Alta, edición y estado de vehículo

**Formulario.** Agrupar Identificación —placa, marca, modelo, año—; Operación —tipo, estado, kilometraje inicial validado—; y Custodia —asociación de posición cuando aplique—. No convertir todos los campos en obligatorios sin validar su necesidad con GACOR.

**Validación.** Placa única, valores de año razonables y kilometraje no negativo. Si cambia el tipo y existe préstamo o asignación, explicar la incompatibilidad antes de guardar. Los ajustes de kilometraje vigente se tramitan en W23, no como edición silenciosa.

**Cambio de estado.** Diálogo específico con estado actual, nuevo estado, motivo e impacto sobre nuevos préstamos/asignaciones. No cerrar automáticamente operaciones activas. Confirmar el resultado y registrar auditoría.

### W07 · Pilotos

**Vista.** Buscador por nombre, filtros de brigada y estado. Filas con nombre, brigada, licencia, vehículo activo y reportes pendientes. No mostrar datos personales innecesarios.

**Acciones.** Crear perfil vinculado a usuario, abrir expediente y asignar vehículo. Si no tiene vehículo, presentar «Sin asignación activa» y siguiente acción para el encargado. El supervisor solo ve su ámbito.

### W08 · Expediente y edición de piloto

**Vista.** Encabezado con nombre, brigada, estado y vehículo activo. Secciones: datos operativos, licencia, asignaciones, kilometraje, combustible, incidencias e historial. Los vencimientos de licencia pueden mostrarse si se dispone de fecha; bloquear por vencimiento requiere política aprobada.

**Formulario.** Usuario relacionado, datos operativos personales, licencia, brigada y estado. Evitar duplicar una cuenta al crear un piloto. En historial, filtros por fecha y vehículo, sin borrar la responsabilidad de asignaciones anteriores.

**UX.** Los indicadores de cumplimiento deben explicar cómo se calculan; no comparar usuarios con jornadas esperadas desconocidas ni mostrar clasificaciones punitivas sin contexto.

### W09 · Asignaciones de brigada

**Vista.** Pestañas Activas, Programadas e Historial; tabla de vehículo, piloto, brigada, inicio, fin, responsable y estado. Acceso inmediato a asignaciones sin datos de cierre.

**Acciones.** «Asignar vehículo», «Reasignar» y «Cerrar asignación» según permiso. El detalle conserva observaciones y cronología. La pantalla no incluye llaves del gabinete como requisito de operación de campo.

### W10 · Asignar, reasignar y cerrar asignación

**Vista.** Asistente de tres pasos: seleccionar piloto y vehículo elegible; definir fechas y observaciones; revisar responsabilidad y confirmar. Para reasignar, mostrar relación actual y nueva lado a lado.

**Reglas.** No permitir relaciones activas incompatibles. Antes de sustituir una asignación, pedir cierre formal con kilometraje de entrega y observaciones. Si hay jornada abierta, identificarla y ofrecer resolverla mediante el flujo autorizado, sin inventar un cierre automático.

**Resultado.** Mostrar quién queda responsable y desde cuándo. Si los datos cambiaron mientras se completaba el formulario, conservar lo ingresado y presentar el conflicto. Revalidar disponibilidad al confirmar.

### W11 · Disponibilidad administrativa

**Vista.** Tarjetas grandes para los vehículos compartidos: placa, modelo, estado operativo, kilometraje vigente, estado de llave y posición. Hasta cuatro posiciones iniciales, sin llenar espacios con vehículos ficticios.

**Acción.** «Solicitar vehículo» en unidades elegibles. Vehículos prestados, restringidos o con gabinete sin respuesta muestran motivo y alternativa de contacto. La información sobre otros responsables se limita al permiso del usuario.

**UX.** El estado «Reservado» está previsto en las fuentes, pero no define un sistema completo de reservas; no añadir calendario ni prioridades de reserva como si ya estuvieran aprobados.

### W12 · Formulario de salida administrativa

**Vista.** Resumen fijo del vehículo arriba; debajo kilometraje inicial sugerido con origen, destino, motivo y observaciones. Pie con «Cancelar» y «Validar y continuar al retiro».

**Reglas.** Si se corrige el kilometraje sugerido, pedir motivo y preservar el anterior. Revalidar usuario, vehículo, llave, gabinete y ausencia de préstamo activo. No liberar mientras falten campos obligatorios.

**UX.** Mostrar errores junto al campo y un resumen con foco en el primero. No añadir aprobación manual del jefe salvo política posterior. Si otro usuario toma el vehículo, explicar y regresar a disponibilidad conservando destino y motivo como borrador, sin asignarlos al nuevo vehículo automáticamente.

### W13 · Retiro guiado de llave

**Vista.** Número de posición muy visible, placa y miniatura esquemática del gabinete. Secuencia: «Validando» → «Solicitando habilitación» → «Posición habilitada» → «Esperando retiro» → «Retiro confirmado».

**Mensajes.** Solo después del acuse: «Retira la llave de la posición 02, iluminada en naranja». Tras sensor válido, confirmar hora real y préstamo activo. Representar el aro rojo después del retiro; no usar verde de éxito como estado físico del aro.

**Fallos.** Si no hay acuse, «No pudimos confirmar la habilitación». Si termina el plazo configurado, comprobar el estado antes de reintentar. Una solicitud repetida no debe abrir una segunda operación. «Orden enviada» nunca equivale a «Llave retirada».

### W14 · Préstamos y préstamo activo

**Vista de encargado.** Tabla con usuario, vehículo, salida, destino, duración, estado y alertas. Filtros por fecha, responsable y estado. Préstamos prolongados se basan en umbral configurable.

**Vista personal.** Tarjeta del préstamo actual con placa, hora de retiro, kilometraje inicial y acciones «Registrar combustible», «Reportar incidencia» y «Devolver vehículo».

**Detalle.** Cronología de solicitud, habilitación, retiro, cargas y devolución. Mostrar excepción pendiente si existe; no declarar cancelado un préstamo con llave retirada sin resolver custodia.

### W15 · Formulario de retorno administrativo

**Vista.** Vehículo y kilometraje inicial visibles; kilometraje final, kilómetros calculados, estado del vehículo, incidencias y confirmación de combustible cargado. Listar cargas ya registradas con comprobantes; permitir añadir una faltante.

**Reglas.** Final igual o mayor que inicial. Si se declara carga, completar su registro y evidencia. Si hubo incidencia, abrir campos de descripción y evidencia según corresponda. Las fotografías de odómetro de brigada no se trasladan como requisito obligatorio al préstamo administrativo sin aprobar esa ampliación.

**Acción.** «Guardar retorno y habilitar devolución». La confirmación indica que todavía falta devolver físicamente la llave.

### W16 · Devolución física y cierre

**Vista.** Posición correcta destacada; secuencia «Formulario guardado» → «Posición habilitada» → «Llavero identificado» → «Bloqueo confirmado» → «Préstamo cerrado».

**Fallos.** Llavero equivocado: indicar la posición esperada sin cerrar. Llave detectada pero bloqueo sin confirmar: «La llave fue detectada; falta confirmar el bloqueo». Mantener seguimiento y contacto al encargado. Corte de red: mostrar estado desconocido y consulta de recuperación.

**Resultado.** Resumen con salida, retorno, kilómetros e incidencias. Distinguir «Devolución completada» de «Vehículo disponible»: una incidencia o mantenimiento puede mantenerlo restringido. El aro y su etiqueta deben respetar la indisponibilidad del vehículo según la política física validada.

### W17 · Monitor del gabinete

**Vista.** Representación 2 × 2 de posiciones físicas, con número, placa, chip abreviado, presencia, bloqueo y LED confirmado. Encabezado con conectividad, última comunicación y estado de conciliación.

**Acciones.** Abrir detalle, revisar eventos, iniciar diagnóstico autorizado y solicitar apertura excepcional. Mostrar leyenda verde/naranja/rojo más texto; agregar desconocido/fuera de línea mediante patrón o icono diferente.

**UX.** Estados físico y lógico separados. Si la telemetría es antigua, reemplazar la apariencia de disponibilidad por «Sin confirmación actual». No dibujar señales de UPS, temperatura o sensores que el hardware aprobado no entregue.

### W18 · Configuración de posiciones y llaveros

**Vista.** Lista de posiciones con vehículo asociado, identificador de chip, estado y última lectura. Alta/edición guiada: seleccionar posición, leer o introducir identificador autorizado, asociar vehículo y validar.

**Reglas.** Llavero asociado a un solo vehículo. Detectar duplicidad y ocupación antes de guardar. Cambiar una asociación con préstamo activo requiere resolver custodia; no reutilizar silenciosamente la posición.

**Estados.** Lectura ausente, chip ya registrado, identificación incompatible y prueba correcta. Los identificadores técnicos completos se reservan a personal autorizado.

### W19 · Apertura administrativa excepcional

**Vista.** Diálogo con posición, vehículo, estado físico conocido y motivo obligatorio. Explicar que la acción queda auditada y no sustituye automáticamente un préstamo o devolución regular.

**Acción.** «Confirmar apertura excepcional», con validación adicional solo si se aprueba en D-01. Permiso explícito, no acceso por ser simplemente usuario de oficina.

**Resultado.** Seguir acuse y sensor igual que el retiro normal. Registrar autor, fecha, motivo y resultado, incluida falla. Nunca mostrar «Apertura realizada» cuando solo se envió el comando.

### W20 · Conciliación y contingencia del gabinete

**Vista.** Tabla de discrepancias: posición, estado registrado, lectura física, última comunicación y operación relacionada. Encabezado «Revisión necesaria tras interrupción».

**Flujo.** Recuperar comunicación, consultar eventos, inspeccionar la discrepancia y regularizar con motivo y responsable. Mostrar antes/después en cada propuesta. Prohibir un botón genérico que convierta todas las posiciones a disponibles.

**Contingencia.** Acceso al procedimiento manual aprobado. Una apertura realizada manualmente se registra como regularización con fecha del hecho y fecha de registro, sin simular que el sistema observó sensores inexistentes.

### W21 · Jornadas y reportes pendientes

**Vista.** Fecha o período, brigada, piloto, vehículo y estado. Tabla con inicio/final, fotos disponibles, kilómetros, pendiente y última actualización. Vistas «Todas», «Sin inicio», «Sin cierre» y «En revisión».

**Reglas.** Determinar ausencias contra calendario o jornadas esperadas configuradas. No marcar automáticamente como incumplimiento cada día natural sin reporte. Identificar datos que todavía no se han recibido sin asumir qué existe en un teléfono desconectado.

**Acciones.** Abrir W22 y seguimiento según permiso. Recordatorios mediante canal aprobado; no enviarlos sin configuración ni prometer que fueron leídos.

### W22 · Detalle y revisión de jornada

**Vista.** Cabecera con piloto, vehículo, fecha y estado. Dos bloques comparables: inicio con kilometraje/foto/hora y fin con kilometraje/foto/hora. Entre ellos, kilómetros calculados.

**Contenido.** Evidencias ampliables, combustible relacionado, incidencias y trazabilidad. Mostrar hora de captura y recepción cuando difieran por captura offline. Señalar anomalías sin alterar los datos originales.

**Acciones.** Revisar, solicitar aclaración si existe canal aprobado y proponer ajuste W23 con permiso. Un supervisor sin permiso de corrección conserva consulta y seguimiento.

### W23 · Corrección auditada y conflicto de kilometraje

**Vista.** Registro original, valor vigente y valor propuesto; fotografía de apoyo y motivo obligatorio. Mostrar qué jornada, préstamo o lectura se modifica y efectos sobre continuidad o mantenimiento.

**Comportamiento.** Antes de confirmar, revisar lecturas posteriores; no sumar kilómetros ni seleccionar automáticamente el mayor como solución universal. Mantener original y ajuste vinculados.

**Conflicto.** Presentar versión enviada desde móvil y versión central con sus fechas; ofrecer resolver a personal autorizado. El piloto puede aportar aclaración sin decidir sobre registros de terceros. Resultado con estado «Ajuste registrado», autor y motivo.

### W24 · Combustible: registros e indicadores

**Vista.** Filtros por período, vehículo, piloto, brigada y anomalía. Resumen de galones, gasto y precio promedio ponderado; tabla con fecha, responsable, kilometraje, galones, monto y comprobante.

**UX.** Cada total abre los registros que lo componen. Los campos monetarios usan Q y dos decimales. Una advertencia de posible duplicado conserva el registro y lo envía a revisión.

**Métricas.** Costo/km y rendimiento solo con datos compatibles suficientes. Mostrar «Datos insuficientes» y motivo cuando falten distancias o lecturas; no presentar cargas parciales como consumo medido del tanque.

### W25 · Alta y detalle de carga de combustible

**Formulario.** Vehículo, responsable vigente, préstamo/jornada relacionada, fecha/hora, kilometraje, galones, monto total, comprobante y observaciones. Precargar contexto si se abre desde una operación; no permitir cambiar responsable arbitrariamente.

**Validación.** Galones y monto mayores que cero; evidencia fotográfica obligatoria y legible; coherencia del kilometraje. Mostrar precio/galón derivado como solo lectura. La fecha de captura offline y la de recepción se conservan por separado.

**Detalle.** Datos a la izquierda y comprobante ampliable a la derecha; en ancho pequeño, apilados. Ajustes mediante trazabilidad. Factura borrosa: permitir reemplazar el borrador antes de enviar; después, conservar historial de corrección según política.

### W26 · Bandeja de anomalías

**Vista.** Filas con tipo —salto de kilometraje, carga atípica o posible comprobante duplicado—, vehículo, responsable, fecha, regla que la generó y estado de revisión.

**Detalle.** Mostrar registro señalado y comparación que explica el aviso. Acciones propuestas: «Revisado sin ajuste», «Solicitar aclaración» o «Registrar ajuste autorizado» con motivo. Esos nombres son diseño, no nuevos permisos implícitos.

**Regla.** Una anomalía no demuestra fraude ni provoca bloqueo automático. Los umbrales de D-10 deben ser configurables y la interfaz debe explicar por qué se generó la alerta.

### W27 · Centro de mantenimiento

**Vista.** Priorizar lista por urgencia: crítico, vencido, próximo y al día. Columnas de vehículo, concepto, kilometraje vigente, objetivo, distancia restante, fecha objetivo cuando aplique y responsable.

**Organización.** Separar condición del vencimiento de estado del trabajo: un servicio puede estar programado y seguir vencido. Filtros por ambos ejes. Vista de agenda solo para trabajos con fecha programada real.

**Acciones.** Configurar plan, programar, registrar servicio y gestionar restricción. Cada tarjeta conduce al vehículo y concepto concreto.

### W28 · Plan de mantenimiento por vehículo

**Formulario.** Concepto configurable, último servicio confirmado, kilometraje base, intervalo en km, intervalo temporal opcional y umbral de alerta. Mostrar próximo objetivo calculado y origen de los datos.

**Reglas.** Si falta un servicio base confiable, pedir establecerlo de forma autorizada; no inventar fecha o kilometraje. Cuando se use km y tiempo, dejar explícita la regla de vencimiento, propuesta «lo que ocurra primero» sujeta a D-04.

**UX.** Vista previa: «Avisar a partir de…; objetivo…». Editar parámetros muestra impacto y deja auditoría. No establecer intervalos universales fijos para todos los vehículos.

### W29 · Programar y registrar mantenimiento

**Programación.** Vehículo, concepto, fecha prevista, proveedor/taller y observaciones. Programar no equivale a completar ni elimina por sí solo la alerta.

**Registro realizado.** Fecha efectiva, kilometraje, concepto, costo, taller/proveedor, observaciones y evidencia opcional. Resumen del próximo objetivo antes de confirmar.

**Resultado.** Recalcular desde el servicio confirmado. Si hay otras restricciones, mantenerlas. «Mantenimiento registrado» no debe convertirse automáticamente en «Vehículo habilitado» sin revisar su estado operativo.

### W30 · Incidencias

**Vista.** Lista con prioridad, vehículo, responsable, descripción breve, fecha y estado. Propuesta de estados: abierta, en revisión, atendida y cerrada, a validar con operación. Pánico es una categoría prioritaria con flujo propio W31–W32.

**Detalle.** Descripción, evidencias, operación relacionada, persona asignada y cronología de notas. Registrar cierre con resultado y responsable. Evitar un chat informal que sustituya el registro de decisiones.

**Acciones.** Asignar atención, comentar, registrar medida y cerrar según permiso. Marcar fuera de servicio requiere acción autorizada diferenciada; no toda incidencia supone inmovilización.

### W31 · Centro de emergencias

**Vista.** Lista prioritaria de alertas abiertas con piloto, vehículo, hora, antigüedad, estado, responsable y ubicación disponible/no disponible. Aviso persistente para eventos nuevos con sonido solo según política y preferencias aprobadas.

**UX.** El foco permanece en la tarea actual hasta interacción; la emergencia debe destacar sin hacer imposible usar el portal. Acciones «Ver emergencia» y «Tomar atención». Evitar cerrar o reconocer por abrir accidentalmente una notificación.

**Concurrencia.** Si otro responsable ya la atiende, mostrarlo inmediatamente para coordinar. El acceso del supervisor respeta su brigada y los destinatarios definidos en D-05.

### W32 · Detalle y seguimiento de emergencia

**Vista.** Piloto, vehículo, teléfono autorizado, hora y estado al inicio. Ubicación puntual en mapa solo si existe; acompañar con hora de captura y precisión cuando esté disponible. Si no existe, mensaje visible, sin pin ficticio.

**Flujo.** Distinguir recepción técnica en servidor, acuse del responsable y estado operativo. Presentar «Marcar recibida», «Tomar atención» y «Cerrar emergencia» según transición válida. Notas y cada cambio quedan auditados.

**Cierre.** Requiere resultado y responsable. Una activación accidental transmitida se documenta como tal, sin borrar el evento. Si falla el proveedor de mapa, conservar coordenadas autorizadas y contactos.

### W33 · Dashboard analítico

**Vista.** Filtros globales de período, tipo, vehículo, piloto, brigada y estado. Primera fila: kilómetros, gasto de combustible, galones y costo/km con cobertura. Debajo, barras comparativas por vehículo, tendencia mensual y mantenimiento.

**Contenido.** Incluir kilómetros por piloto/brigada, vehículos de mayor gasto, variación mensual, administrativos disponibles, duración de préstamos, asignaciones activas, reportes faltantes, incidencias y fuera de servicio.

**UX.** Barras horizontales para comparaciones; líneas para evolución; evitar 3D y dobles ejes confusos. Cada gráfica ofrece tabla equivalente, unidad y acceso al detalle. Comparar períodos equivalentes y señalar datos parciales. No graficar ceros para datos ausentes.

### W34 · Reportes y exportaciones

**Vista.** Selector de reporte: préstamos, kilometraje, combustible, mantenimiento, pilotos, incidencias o asignaciones. Filtros específicos, columnas opcionales y vista previa del alcance.

**Acciones.** «Exportar PDF» y «Exportar Excel». Mostrar filtros, fechas y cantidad de registros estimada si se conoce. Para generación larga, estado en proceso con posibilidad de seguir trabajando.

**Reglas.** Exportar solo el ámbito autorizado. Archivos con título, período, unidades, fecha de generación y filtros. Error con reintento; no confirmar descarga antes de existir un archivo. No agregar envíos programados por correo como función aprobada.

### W35 · Historial unificado

**Vista.** Línea cronológica filtrable por vehículo o piloto, fecha y tipo: préstamo, asignación, jornada, carga, mantenimiento, incidencia y ajuste. Cada evento muestra fecha, actor y resumen enlazado al registro.

**UX.** Paginación o carga por períodos; conservar contexto al abrir detalles. Distinguir hechos ocurridos de registros recibidos posteriormente. Los ajustes se muestran junto al original, sin convertir la cronología en un historial reescrito.

### W36 · Usuarios, roles y alcance

**Vista.** Directorio con nombre, puesto, departamento, rol, estado y ámbito. Formulario de usuario y panel de permisos organizado por módulo y acciones: consultar, crear, corregir, administrar y ejecutar operaciones especiales.

**Reglas.** Matriz final en D-02. Vista previa «Este usuario podrá…» para reducir errores. Cambios de estado o permisos con auditoría; advertir sobre pérdida de acceso o responsabilidades activas. No borrar silenciosamente una cuenta con historial.

**Sesiones.** Desde usuario autorizado, revisar y revocar sesiones, especialmente por teléfono perdido. No mostrar contraseñas, tokens ni secretos. Cambiar rol no debe otorgar permisos fuera del alcance asignado.

### W37 · Configuración y catálogos

**Vista.** Secciones internas: brigadas, departamentos, proveedores/talleres, conceptos de mantenimiento, umbrales, canales y responsables de alertas, evidencias y parámetros operativos.

**Formulario.** Nombre, valor, unidad, alcance y explicación del efecto. Guardar por sección con aviso de cambios pendientes. Valores aún no aprobados se presentan como «Pendiente de configuración», no como política vigente.

**Decisiones.** Autenticación, permisos, hardware, mantenimiento, destinatarios de pánico, evidencias, Android, infraestructura, continuidad y anomalías corresponden a D-01–D-10. No fijar desde UI tamaños máximos de foto, retención, timeout, bloqueo por licencia ni contactos de emergencia sin definición.

### W38 · Evidencias y auditoría

**Evidencias.** Dos vistas internas claramente separadas. La primera permite consultar archivos por tipo, fecha, vehículo, autor y registro relacionado. Miniaturas con visor, zoom, metadatos y enlace al origen. No ofrecer eliminación masiva indiscriminada.

**Auditoría.** Tabla de fecha/hora, usuario, acción, entidad, resultado y motivo. Detalle con valores anterior/nuevo, dispositivo cuando corresponda y operación relacionada. Solo lectura para quienes consultan; ningún botón «Editar bitácora».

**Estados.** Archivo no disponible, acceso vencido, formato incompatible o sin permiso deben tener mensajes distintos. Renovar acceso al archivo sin exponer direcciones privadas o credenciales. La política de retención procede de D-06.

### W39 · Estado técnico, importación y recuperación

**Vista técnica.** Solo personal autorizado: conectividad de servicios, última comunicación del gabinete, incidencias de sincronización recibidas y estado de respaldos si la infraestructura lo expone. Mostrar salud desconocida cuando no se dispone de señal.

**Carga inicial.** Vista auxiliar respaldada por F2, apartado 17: seleccionar catálogo y archivo de plantilla, revisar columnas, validar filas, mostrar aceptadas/rechazadas con causa y confirmar importación. Informe final de conteos y origen. No incorporar históricos no confiables sin regla aprobada.

**Recuperación.** Acceso a procedimiento, registros de ejecución y responsables. Una restauración de producción no se reduce a un botón de operación cotidiana; la interfaz documenta el procedimiento autorizado y su resultado. Falla parcial de importación conserva un resumen preciso.

### W40 · Notificaciones, cuenta y ayuda

**Notificaciones.** Panel con Críticas y Operativas, fecha, contexto y vínculo al registro. Leer un aviso no equivale a atender o cerrar una emergencia. Estado vacío claro y filtros de leídas/no leídas.

**Cuenta.** Datos personales permitidos, cambio de contraseña según proveedor, sesiones y cierre de sesión. Cambio de rol/contexto solo cuando corresponda.

**Ayuda.** Guías por rol, retiro/devolución, reportes, sincronización y contingencia. Contactos configurados por GACOR. Incluir pantallas transversales de acceso denegado, sesión vencida y página inexistente con retorno seguro, conservando formularios cuando sea posible sin exponerlos a otra cuenta.

---

# PARTE II · APLICACIÓN MÓVIL

## 4. Prompt maestro móvil listo para copiar

> Actúa como diseñador senior de aplicaciones Android para operaciones de campo. Diseña la aplicación DERCAS de GACOR S.A. para pilotos de brigada y usuarios administrativos autorizados. Utiliza la misma identidad visual del portal, adaptada a uso con una mano, luz exterior, conectividad intermitente y captura de fotografías.
>
> La app comienza en Android; su tecnología nativa o híbrida está pendiente de decisión. No conviertas el portal Angular en una página comprimida. Diseña interacciones móviles, cámara, teclado numérico, navegación corta, permisos contextuales y almacenamiento temporal para reportes no críticos.
>
> Distingue perfiles: el piloto consulta su vehículo asignado y registra inicio y cierre de jornada con kilometraje y foto, combustible con comprobante, incidencias, mantenimiento y pánico. El usuario administrativo solicita un vehículo, completa salida, retira la llave, registra combustible y devuelve vehículo y llave. No exijas gabinete diario al piloto ni permitas asignar vehículos desde la app del piloto.
>
> Diseña todas las fichas M01–M28. La página de inicio debe mostrar el vehículo, el estado actual y la siguiente acción principal. Evita dashboards densos. Usa navegación inferior con cuatro destinos y un acceso de emergencia persistente, claramente separado de acciones habituales. Botones amplios, textos legibles, campos con etiquetas y evidencia fácil de capturar.
>
> Diferencia siempre «Guardado en este teléfono», «Enviando», «Sincronizado», «Conflicto» y «Error». El cierre local de una jornada no significa que el supervisor ya la recibió. Conserva registros y fotos tras cierre de app o reconexión; los reintentos no deben duplicar operaciones.
>
> Las órdenes al gabinete requieren conexión y confirmación física. El pánico exige un estado de transmisión veraz. Si no puede enviarse, muestra «No pudimos enviar la alerta» y acceso a llamada al contacto configurado, sin prometer que alguien recibió ayuda. No inventes números de emergencia ni implementes un servicio de despacho externo.
>
> Solicita cámara al tomar evidencia, notificaciones cuando se explique su uso y ubicación únicamente al activar una emergencia. Si no hay ubicación, intenta transmitir los demás datos sin bloquear. No muestres rastreo permanente, recorrido GPS ni tanque en tiempo real.
>
> Usa las mismas reglas operativas del portal, español claro, quetzales, kilómetros y galones. Incluye carga, vacío, errores, permisos denegados, captura offline, sesión expirada, cambio de asignación, conflictos, foto pendiente y confirmaciones reales del gabinete. Conecta los flujos completos y entrega componentes reutilizables, variantes y criterios de usabilidad.

## 5. Apariencia, navegación y ergonomía móvil

Diseño base para 390 × 844 px, verificable también a 360 px de ancho. Fondo claro, tarjetas blancas y cabecera simple. Márgenes laterales de 16 px; título de 24–28 px; cuerpo de 16–18 px; información secundaria de 14 px. Botones principales de 52–56 px de alto y áreas táctiles de al menos 48 × 48 unidades de diseño. Son objetivos de propuesta, a comprobar en dispositivos reales.

El vehículo aparece como placa grande y modelo secundario. Una fotografía es opcional; no debe consumir la mitad del inicio. Los datos principales se leen con brillo exterior: kilometraje, estado, siguiente acción y pendientes de envío. Permitir ampliación de texto sin recortes ni superposición del botón de emergencia.

**Piloto:** Inicio, Registros, Avisos y Perfil. Desde Inicio se accede a jornada, combustible e incidencia. **Administrativo:** Inicio, Vehículos, Historial y Perfil, con avisos accesibles desde cabecera. El botón de pánico corresponde al piloto según F1; mostrarlo a otros perfiles requiere validación de permisos.

La acción principal se fija al pie solo cuando no oculte campos, teclado o navegación. Al aparecer el teclado, desplazar el campo enfocado. Evitar acciones que dependan únicamente de deslizar, mantener pulsado o reconocer un icono. El uso de vibración es complementario, nunca la única confirmación.

## 6. Pantallas móviles

### M01 · Apertura y recuperación de sesión

**Vista.** Marca sobre fondo sencillo durante la carga real, sin espera decorativa. Leer sesión, perfil y borradores. Transición directa a inicio cuando sea posible.

**Estados.** Primer acceso requiere autenticación en línea. Acceso con datos locales en sesiones previamente autorizadas depende de la política de seguridad. Si la sesión caducó, preservar pendientes de forma protegida y pedir reconexión/autenticación antes de sincronizar. No borrar datos por un arranque sin Internet.

### M02 · Inicio de sesión y recuperación

**Vista.** Logo, identificador, contraseña, «Ingresar» y recuperación. Controles grandes, contraseña visible mediante acción explícita y teclado adecuado. El contacto de soporte aparece en segundo nivel.

**Variantes.** Biometría únicamente si se aprueba, existe capacidad y el usuario la habilita después de autenticar; ofrecer alternativa. Acceso corporativo según D-01. Errores sin borrar identificador. No incluir registro libre de empleados.

### M03 · Bienvenida y permisos contextuales

**Vista.** Breve explicación de tres tareas del perfil; permitir omitir y consultar después. No solicitar todos los permisos al abrir por primera vez.

**Permisos.** Cámara al capturar foto; acceso a imágenes al adjuntar; notificaciones al explicar alertas; ubicación al activar emergencia. Cada explicación indica para qué se usa y qué sucede si se deniega. Un rechazo permanente ofrece «Abrir ajustes» y una alternativa válida cuando exista.

### M04 · Inicio del piloto

**Vista.** Nombre y brigada en cabecera, estado de conexión discreto, vehículo asignado y tarjeta «Tu jornada de hoy». Si no empezó: último kilometraje válido y «Iniciar jornada». Si está abierta: inicio, hora y «Cerrar jornada». Si está cerrada: resumen y estado de sincronización.

**Acciones.** Accesos secundarios grandes «Combustible» y «Reportar incidencia»; mantenimiento próximo debajo. Franja «Tienes 2 registros pendientes de envío» enlaza M27. Acceso a emergencia visible sin ocupar el lugar del botón habitual.

**UX.** El inicio no debe mostrar treinta indicadores. Explicar qué sigue y qué requiere atención. No estimar la distancia recorrida en tiempo real antes de registrar el kilometraje final.

### M05 · Sin asignación o cambio de vehículo

**Sin asignación.** Ilustración mínima o icono, «No tienes un vehículo asignado» y contacto al encargado. Historial y perfil accesibles; no permitir seleccionar libremente una unidad para reportar.

**Cambio.** Mostrar vehículo anterior y nuevo, fecha efectiva y responsable. Si hay jornada o borradores del anterior, conservarlos con su vehículo original y enviarlos a revisión cuando corresponda. Un reporte creado offline no se reasocia al nuevo vehículo al reconectar.

**Emergencia.** Si falta asignación, mantener contacto de ayuda; la política para registrar pánico sin vehículo debe definirse, sin inventar una relación activa.

### M06 · Mi vehículo

**Vista.** Placa, modelo, brigada, asignación vigente y estado. Bloques de kilometraje validado con fecha, mantenimiento próximo e incidencias propias relevantes.

**Acciones.** Abrir historial relacionado y contactar encargado. Una restricción explica el motivo y responsable; no ofrecer «Quitar bloqueo». El piloto no puede editar la placa, cambiar el kilometraje maestro ni asignarse otro vehículo.

### M07 · Inicio de jornada

**Vista.** Vehículo y fecha arriba; campo numérico grande con kilometraje sugerido y su origen; evidencia inicial con botón «Tomar foto». Observaciones opcionales cuando aporten valor.

**Reglas.** Cambiar el kilometraje sugerido revela «Motivo de corrección» obligatorio. Inicio requiere kilometraje y foto. Teclado numérico sin decimales para odómetros configurados en km enteros; ajustar si el inventario exige otra precisión.

**Acción y estados.** «Guardar inicio»; en línea solo confirmar recepción cuando ocurra. Offline: «Inicio guardado en este teléfono. Pendiente de envío». Evitar un segundo inicio de la misma jornada y guardar borrador si se interrumpe la captura.

### M08 · Cámara de odómetro

**Vista.** Encuadre central, instrucción «Asegúrate de que se lean todos los números», disparador grande, flash cuando exista y opción de adjuntar una imagen si la política lo permite. No sobrecargar con herramientas de edición.

**UX.** Tras capturar, abrir M09. Si la cámara falla, ofrecer reintentar o adjuntar; si no es posible obtener evidencia, conservar borrador sin marcar el inicio/cierre completo. No asumir reconocimiento óptico automático: OCR no forma parte del alcance documentado.

### M09 · Revisión de evidencia

**Vista.** Fotografía ampliable, contexto «Odómetro inicial», «Odómetro final» o «Comprobante» y botones «Repetir» / «Usar foto». Conservar orientación correcta y permitir revisar legibilidad.

**Reglas.** Compresión que preserve lectura, límites según D-06. Mostrar guardado local y carga remota como procesos distintos. Si falla la carga, mantener la imagen y ofrecer reintento. No reemplazar una foto original por una imagen generada ni modificar números.

### M10 · Jornada abierta

**Vista.** Vehículo, hora de inicio y kilometraje inicial; estado local/sincronizado. Acciones «Registrar combustible», «Reportar incidencia» y «Cerrar jornada».

**UX.** Mostrar cargas y novedades registradas en esa jornada. Evitar mapas o velocímetros sin fuente. Al regresar desde cámara o suspender la app, continuar donde quedó el usuario. Si el inicio aún no se ha enviado, permitir captura no crítica posterior con dependencia conservada.

### M11 · Cierre de jornada

**Vista.** Kilometraje inicial en solo lectura, kilometraje final editable, distancia calculada y foto final obligatoria. Pregunta breve «¿Hubo alguna incidencia?» que expande descripción/evidencias si se responde sí.

**Validación.** Final menor al inicial: error bloqueante con ambos valores. Valor atípico: advertencia y justificación según política, sin bloqueo indiscriminado. Igual a inicial es válido y representa cero recorrido.

**Acción.** «Guardar cierre». El resumen muestra inicio, final, distancia y estado de envío. Si falta foto, señalar el campo; si se guarda offline, no afirmar que la jornada está recibida o validada por el servidor.

### M12 · Mis registros y pendientes de jornada

**Vista.** Lista por fecha con estado, vehículo, inicio/final y kilómetros cuando se conocen. Filtros sencillos por período y tipo de registro. Pestaña o filtro de incompletos.

**Detalle.** Fotos, horas, cargas e incidencias relacionadas. Si falta cierre anterior, destacar «Completar reporte» con flujo autorizado y fecha real; no crear un cierre retroactivo como si se hubiera capturado puntualmente.

**UX.** Historial propio, sin acceso a otros pilotos. Las correcciones confirmadas aparecen con explicación y vínculo al ajuste, conservando la evidencia original.

### M13 · Registrar combustible

**Vista.** Vehículo y responsable precargados; kilometraje actual, galones y monto en Q; captura del comprobante. Mostrar préstamo o jornada vinculada. Observaciones al final.

**Interacción.** Teclado decimal para galones y monto, unidad persistente y precio por galón calculado. Una carga parcial se registra como carga, no como lectura exacta de consumo del tanque.

**Reglas.** Campos obligatorios completos y comprobante legible. Si falta contexto de operación, explicar y solicitar resolución autorizada; no asociar al azar. Guardado offline permitido con identidad y relación originales. Posible duplicidad genera revisión, no borrado automático.

### M14 · Historial y detalle de combustible

**Vista.** Tarjetas con fecha, vehículo, galones, monto y estado de envío. Detalle con kilometraje, comprobante ampliable y operación relacionada.

**Acciones.** Corregir borrador antes de enviar; para registros confirmados, usar el proceso de aclaración/ajuste autorizado. Reintentar cargas fallidas desde M27. No mostrar «0 Q» cuando el monto está ausente o un registro no se pudo cargar.

### M15 · Reportar incidencia

**Vista.** Vehículo automático, descripción breve, categoría si el catálogo está definido, fotos cuando existan y referencia a jornada/préstamo. Pregunta opcional sobre posibilidad de continuar si GACOR aprueba su uso operativo.

**UX.** «Si necesitas ayuda inmediata, usa Emergencia» con acceso claro al flujo de pánico del piloto. La selección de gravedad no pretende realizar diagnóstico mecánico automático.

**Acción.** «Guardar incidencia», con estado local o enviado. Si se considera no crítica, disponible offline. No prometer notificación al supervisor hasta transmisión confirmada.

### M16 · Mis incidencias y seguimiento

**Vista.** Lista de abiertas y cerradas, estado, fecha, vehículo y resumen. Detalle con evidencias, persona responsable si fue asignada y cronología de atención.

**Interacción.** Aportar información adicional según permiso. Mostrar «Sin actualización recibida» cuando corresponda, no «Sin atención» basándose solo en caché. Cierre administrativo con resultado visible; el usuario no puede borrar el caso para quitarlo de pendientes.

### M17 · Mantenimiento y avisos personales

**Vista.** Próximos servicios del vehículo activo, concepto, kilometraje objetivo y distancia restante calculada desde lectura válida. Estado y fecha de actualización visibles.

**Avisos.** Reporte faltante, servicio próximo, restricción y cambio de asignación. Cada aviso abre una pantalla concreta. Abrir una notificación no equivale a completar el reporte ni levantar la restricción.

**Límites.** El piloto consulta; registrar mantenimiento realizado o cambiar intervalos pertenece al rol autorizado. Si el dato está desactualizado por falta de red, indicarlo.

### M18 · Activar emergencia

**Vista.** Acceso persistente abre una pantalla con título «Enviar alerta de emergencia», piloto, vehículo y explicación breve de los destinatarios configurados. Dos acciones claramente separadas: «Enviar alerta» y «Cancelar». Esta confirmación satisface CU-007 sin convertir el flujo en un formulario largo.

**Ubicación.** Solicitar ubicación solo en este contexto; no esperar indefinidamente ni bloquear envío si se deniega o no está disponible. Informar «Se enviará sin ubicación» cuando aplique.

**UX.** Activación rápida y accesible, sin depender de pulsación prolongada. Evitar animaciones decorativas. No exigir texto, fotografía ni completar jornada antes de pedir ayuda.

### M19 · Emergencia en envío y seguimiento

**Vista.** Estado dominante y hora: «Enviando alerta», «Alerta recibida por el sistema», «Responsable notificado» solo con evidencia de ese paso, y «En atención» cuando se registre. Evitar la frase «Ayuda en camino» salvo confirmación humana documentada.

**Contenido.** Vehículo, identificación del caso, ubicación enviada/no disponible y contacto configurado. Actualizaciones de seguimiento con fecha. El estado técnico de transmisión no se confunde con aceptación humana.

**Acciones.** Llamar al contacto configurado y consultar seguimiento. Si fue accidental después de transmitirse, permitir informar esa circunstancia; el evento permanece para cierre trazable.

### M20 · Emergencia sin transmisión

**Vista.** Mensaje inequívoco «No pudimos enviar la alerta. No hay confirmación de recepción». Botones «Llamar al contacto de emergencia» y «Reintentar envío». Mostrar número/nombre solo si GACOR los configuró.

**Reglas.** No mostrar check verde ni colocar el pánico silenciosamente en la misma cola que un recibo. Si se registra localmente el intento, mantenerlo como transmisión fallida. Reintentos utilizan el mismo identificador para evitar duplicidad.

**Recuperación.** Un reenvío tardío debe mostrar hora del intento original y estado actual; definir en D-05 la política de reintento para no hacer pasar un evento antiguo por una emergencia recién ocurrida. Una llamada iniciada tampoco equivale a llamada atendida.

### M21 · Inicio administrativo y vehículos disponibles

**Vista.** Si no hay préstamo activo, título «Solicita un vehículo» y tarjetas con placa, modelo, estado y posición. Si hay préstamo, abrir resumen M24 como prioridad.

**Acción.** Seleccionar vehículo elegible y pasar a M22. Mostrar última actualización; si está desconectado, permitir consulta de datos guardados con advertencia, pero no iniciar liberaciones. Disponibilidad se revalida en línea al solicitar.

### M22 · Solicitud administrativa móvil

**Vista.** Formulario vertical con placa fija, kilometraje inicial sugerido, destino, motivo y observaciones. Motivo de corrección si se cambia el kilometraje. Resumen antes de continuar.

**Acción.** «Continuar al retiro». No pedir nuevamente nombre, placa y hora cuando el sistema ya los conoce. La información incompleta no habilita la llave. No añadir reservas futuras ni un paso de aprobación gerencial no definido.

**Error.** Si otro usuario tomó la unidad, explicar y volver a la lista. Si se pierde conexión, conservar formulario y bloquear la acción física hasta restablecerla.

### M23 · Retiro guiado desde el teléfono

**Vista.** Número de posición, placa e instrucción de acercarse al gabinete. Estados de validación, orden, acuse, habilitación y retiro confirmado.

**UX.** Solo decir «Retira la llave» cuando la posición esté habilitada. Confirmación breve visual y vibración opcional después de detección real. Si se cierra la app durante el proceso, al volver consultar la operación existente.

**Fallos.** Timeout o estado desconocido con «Comprobar estado» y contacto al encargado; sin repetir ciegamente la apertura. El préstamo se activa al retiro confirmado, según el flujo documentado.

### M24 · Mi préstamo activo

**Vista.** Placa, destino, hora de retiro, kilometraje inicial y responsabilidad vigente. Botón principal «Devolver vehículo»; secundarios «Combustible» e «Incidencia». Historial de cargas breve.

**UX.** La duración es informativa; no inventar hora límite si no hay política. Volver a esta pantalla al abrir la app mientras el préstamo siga activo. Pérdida de conexión conserva consulta, pero no permite declarar devolución física completada.

### M25 · Retorno administrativo y llave

**Paso 1.** Kilometraje final, kilómetros calculados, estado, incidencias y confirmación de cargas con sus comprobantes. Validación igual a W15.

**Paso 2.** Posición habilitada, llavero identificado y bloqueo confirmado. Distinguir el guardado del formulario de la devolución. Llave incorrecta o bloqueo sin confirmar deja el préstamo esperando devolución/excepción.

**Resultado.** Comprobante de cierre con fecha y distancia, solo después de confirmación física. Si el vehículo sigue restringido, indicarlo. La app no debe hacer creer que devolver una llave resuelve un problema mecánico.

### M26 · Historial administrativo

**Vista.** Préstamos propios por fecha con placa, duración, kilómetros y estado. Detalle con salida, retorno, combustible, incidencias y confirmaciones de custodia.

**UX.** Un préstamo sin bloqueo confirmado se distingue de los cerrados, aunque el formulario esté completo. Filtros simples, carga paginada y resumen vacío «Aún no has realizado préstamos». No mostrar el historial de otros empleados.

### M27 · Centro de sincronización y conflictos

**Vista.** Resumen «3 pendientes de envío» y lista por registro: tipo, vehículo, fecha de captura, estado de datos y estado de fotos. Estados: local pendiente, enviando, sincronizado, conflicto y error reintentable.

**Acciones.** «Reintentar», «Ver detalle» y abrir la corrección permitida. Mostrar dependencias: un cierre espera al inicio relacionado; una evidencia faltante impide marcar el registro completo. No habilitar «Borrar todo» como solución a fallos.

**Conflictos.** Explicar en lenguaje operativo: «La asignación cambió» o «Existe una lectura posterior». Preservar original local y versión central; derivar al encargado cuando el piloto no pueda resolver. Si falta almacenamiento, avisar antes de perder captura y conservar lo ya guardado.

**Sesión.** Autenticar con la misma cuenta para enviar sus pendientes. Nunca transmitir borradores del usuario anterior bajo la identidad del siguiente. Mostrar último envío exitoso, no confundir conectividad del teléfono con disponibilidad de DERCAS.

### M28 · Perfil, ayuda, seguridad y estados generales

**Perfil.** Nombre, brigada/departamento, rol y vehículo activo cuando corresponda. Cambio de contraseña según proveedor, preferencias permitidas y cierre de sesión. Biometría solo como opción aprobada.

**Ayuda.** Instrucciones cortas de foto, jornada, combustible, préstamo, emergencias y contingencia; contactos configurados. La configuración explica que no existe seguimiento permanente de ubicación.

**Cierre de sesión.** Si quedan reportes locales, informar cantidad y ofrecer sincronizar o mantenerlos protegidos según política; no eliminar evidencias sin aviso ni mostrarlas a otra cuenta. Incluir sesión vencida, permiso denegado, actualización necesaria y servicio no disponible con acciones de recuperación.

---

# PARTE III · REGLAS COMPARTIDAS Y VALIDACIÓN

## 7. Estados que el diseño debe representar

### 7.1 Estado operativo y estado físico

| Dominio | Estados documentados o interpretación de diseño |
|---|---|
| Vehículo | Disponible, prestado/asignado, reservado, mantenimiento, fuera de servicio, restringido |
| Préstamo | Borrador, autorizado, esperando retiro, activo, esperando devolución, cerrado, cancelado, excepción |
| Asignación | Programada, activa, cerrada, cancelada |
| Jornada | Pendiente, abierta, cerrada, incompleta, en revisión |
| Posición del gabinete | Disponible/verde, habilitada/naranja, retirada o no disponible/rojo, error, fuera de línea |
| Mantenimiento | Al día, próximo, vencido, crítico; programación/realización visibles como estado de trabajo separado |
| Emergencia | Generada, recibida, en atención, cerrada, transmisión fallida; detalle técnico de envío complementario |
| Sincronización | Local pendiente, enviando, sincronizada, conflicto, error reintentable |

«Autorizado» no implica necesariamente aprobación humana; puede ser validación de reglas. «Llave presente» no significa vehículo disponible. «Formulario de retorno guardado» no significa préstamo cerrado. «Jornada cerrada localmente» no significa registro sincronizado. «Notificación leída» no significa emergencia atendida.

El uso del aro rojo para un vehículo indisponible con llave almacenada debe conciliarse con las reglas físicas definitivas de D-03. En interfaz siempre mostrar presencia, bloqueo y disponibilidad como datos separados, evitando depender solo del color.

### 7.2 Contrato de estados de cada pantalla

- **Carga:** estructura provisional con etiquetas accesibles; no cifras inventadas ni indicadores de 0 durante la espera.
- **Vacío real:** explicar qué falta y ofrecer la primera acción permitida.
- **Sin resultados por filtros:** mantener filtros y ofrecer limpiarlos.
- **Error recuperable:** conservar datos y mostrar qué se puede reintentar.
- **Sin permiso:** no revelar datos privados; ofrecer volver o contactar al responsable.
- **Datos antiguos:** mostrar cuándo se obtuvieron y qué acciones necesitan confirmación actual.
- **Guardado en curso:** impedir doble envío sin inmovilizar innecesariamente toda la aplicación.
- **Éxito:** describir exactamente qué se confirmó y cuál es el siguiente paso.
- **Conflicto concurrente:** conservar lo ingresado, explicar el cambio y revisar antes de aplicar.
- **Cambios sin guardar:** advertir al salir de formularios relevantes y permitir continuar editando.

### 7.3 Microtextos de referencia

| Situación | Texto sugerido |
|---|---|
| Kilometraje sugerido | «Último registro válido: 48,250 km · 6 sep, 17:20» |
| Corrección | «Indica por qué el kilometraje es diferente. Conservaremos el valor anterior.» |
| Final inválido | «El kilometraje final debe ser igual o mayor que 48,250 km.» |
| Foto faltante | «Agrega una foto legible del odómetro para completar el reporte.» |
| Guardado offline | «Guardado en este teléfono. Pendiente de envío.» |
| Fotos pendientes | «Los datos se enviaron; falta enviar 1 fotografía.» |
| Gabinete sin confirmación | «No podemos confirmar el estado de la llave. Consulta al encargado.» |
| Retorno aún abierto | «El formulario está guardado. Falta devolver y bloquear la llave.» |
| Alerta fallida | «No pudimos enviar la alerta. No hay confirmación de recepción.» |
| Rendimiento no calculable | «Datos insuficientes para estimar el rendimiento de este período.» |
| Posible duplicado | «Encontramos una carga similar. Revisa los datos antes de continuar.» |

Las cifras y fechas de esta tabla son ejemplos ficticios.

## 8. Evidencias, métricas y datos coherentes

**Kilometraje.** Una sola referencia válida por vehículo, con origen y fecha. Las correcciones generan ajustes auditados. El cálculo de recorrido usa final menos inicial sobre un mismo tramo válido; no sumar tramos superpuestos de jornadas y préstamos ni contar dos veces datos sincronizados.

**Tiempo.** En línea, registrar tiempo del sistema; offline, conservar fecha/hora de captura del dispositivo y recepción del servidor. Detectar desfases relevantes y presentarlos en revisión. Usar zona operativa de Guatemala como propuesta, almacenando información suficiente para reconstruir el evento.

**Combustible.** Precio promedio por galón = suma de montos / suma de galones, no promedio simple de precios de cargas. Costo de combustible por km = gasto compatible / distancia válida del mismo alcance. Denominarlo explícitamente «Costo de combustible/km» para no confundirlo con costo total operativo.

**Rendimiento.** No tratar galones comprados en un período como consumo exacto sin base suficiente. Definir método de estimación y ventana compatible con GACOR; mostrarlo en ayuda del indicador. Sin cobertura suficiente, presentar N/D. No añadir sensores de tanque ni requerir llenado total como regla documentada.

**Mantenimiento.** Próximo objetivo en km = kilometraje del último servicio confirmado + intervalo configurado. La proximidad se calcula contra el kilometraje vigente válido. El siguiente servicio no se calcula simplemente desde «hoy» si el mantenimiento registrado ocurrió antes.

**Cumplimiento.** Reportes faltantes requieren días/jornadas esperados definidos; no penalizar fines de semana, permisos o ausencias sin esa configuración. Mostrar cobertura de datos antes de comparar pilotos o brigadas.

**Evidencias.** Vincular archivo a registro, usuario, fecha y tipo. Preservar contexto de vehículo y responsable. No comprimir hasta volver ilegible el odómetro o comprobante. Formatos, tamaño, retención y acceso se resuelven en D-06.

## 9. Componentes reutilizables

| Componente | Variantes necesarias |
|---|---|
| Cabecera de entidad | Vehículo, piloto, préstamo, jornada y emergencia |
| Etiqueta de estado | Texto, icono, color y estado desconocido |
| Tarjeta de acción | Pendiente operativo con cantidad y acceso filtrado |
| Tabla operativa | Filtros, orden, paginación, vacío, error y permisos |
| Selector de entidad | Búsqueda, disponibilidad y ámbito autorizado |
| Campo de kilometraje | Sugerido, editable con motivo, error y valor validado |
| Visor de evidencia | Cámara/archivo, vista previa, zoom, carga y fallo |
| Progreso de gabinete | Orden, acuse, habilitación, sensor, bloqueo y excepción |
| Cronología | Evento, captura/recepción, actor, ajuste y resultado |
| Confirmación sensible | Entidad, impacto, motivo y permiso |
| Indicador de sincronización | Datos y evidencias por separado |
| Alerta de emergencia | Generación, transmisión, atención y cierre |
| Formulario de registro | Borrador, validación, guardado, conflicto y confirmación |
| Gráfica con datos | Unidad, período, cobertura, tabla y acceso a registros |

## 10. Flujos completos que deben quedar conectados

| Caso de uso de F1 | Recorrido principal de diseño |
|---|---|
| CU-001 Retirar administrativo | W11 → W12 → W13 → W14; móvil M21 → M22 → M23 → M24 |
| CU-002 Devolver administrativo | W14 → W15 → W16; móvil M24 → M25 → M26 |
| CU-003 Asignar brigada | W07/W09 → W10 → W05/W08; reflejo en M04/M05 |
| CU-004 Iniciar jornada | M04 → M07 → M08/M09 → M10; consulta W21/W22 |
| CU-005 Finalizar jornada | M10 → M11 → M08/M09 → M12; revisión W22/W23 |
| CU-006 Combustible | M10/M24 → M13 → M09 → M14; administración W24/W25 |
| CU-007 Pánico | M18 → M19 o M20 → W31/W32 → seguimiento móvil |
| CU-008 Mantenimiento | W27 → W28/W29 → W05; aviso M17 |
| CU-009 Dashboard | W03 → W33 → registro detallado o W34 |
| CU-010 Apertura especial | W17 → W19 → confirmación física; excepción W20 |

Además, prototipar captura offline → cierre de app → reapertura → reconexión → envío sin duplicados; corrección con dato original conservado; devolución con llave equivocada; dos usuarios solicitando la misma unidad; mantenimiento crítico que impide nuevo préstamo/asignación; emergencia sin ubicación; emergencia sin conexión; cambio de asignación con registros locales pendientes.

## 11. Trazabilidad de cobertura funcional

| Requisitos | Pantallas principales |
|---|---|
| RF-001–002 Identidad y permisos | W01–02, W36, W40; M01–03, M28 |
| RF-003 Clasificación | W04–06; M05–06, M21 |
| RF-004–010 Préstamo y gabinete | W11–18, W20; M21–26 |
| RF-011–013 Pilotos y asignaciones | W07–10; M04–06 |
| RF-014–018 Jornadas | W21–23; M07–12, M27 |
| RF-019–023 Combustible | W24–26, W33; M13–14 |
| RF-024–028 Mantenimiento y bloqueo | W05–06, W27–29; M06, M17, M21 |
| RF-029–031 Emergencias | W31–32; M18–20 |
| RF-032–033 Historiales | W05, W08, W35; M12, M14, M16, M26 |
| RF-034–035 Dashboard y reportes | W03, W33–34 |
| RF-036 Auditoría | W23, W38; cambios sensibles de todos los módulos |
| RF-037 Apertura excepcional | W19–20 |
| RF-038 Offline | M01, M07–17, M27–28 |
| RF-039 Evidencias | W22, W25, W29–30, W38; M08–09, M13–16 |

W39 recoge capacidades auxiliares de la planificación, no nuevos requisitos RF inventados. La UI de incidencias desarrolla funciones ya incluidas en alcance, entidades y jornadas de F1/F2; sus estados y categorías requieren refinamiento operativo.

## 12. Criterios de aceptación de UI/UX

1. Un piloto identifica vehículo y siguiente acción sin abrir menús adicionales.
2. Un reporte diario normal puede completarse en menos de dos minutos en prueba con usuarios reales, incluyendo evidencia según el alcance de la prueba. Es una meta documental, no una medición ya realizada.
3. Las pantallas habituales cumplen la meta de menos de tres segundos bajo carga acordada; la orden de apertura apunta a menos de dos segundos en red normal. La confirmación física se mide por separado y nunca se simula para aparentar rapidez.
4. Ninguna llave se libera con formulario incompleto o permiso ausente.
5. Ningún préstamo se cierra antes del bloqueo físico confirmado.
6. Un usuario distingue a simple vista guardado local, envío, sincronización completa y conflicto.
7. Ninguna emergencia se muestra recibida sin confirmación; la contingencia es accesible cuando falla la transmisión.
8. Fotos y formularios sobreviven a interrupciones normales y no se duplican al reintentar.
9. Todo ajuste conserva origen, valor anterior/nuevo, autor y motivo.
10. Ningún supervisor consulta otra brigada sin autorización; las exportaciones respetan el mismo alcance.
11. Colores de estado siempre tienen texto o icono; el foco de teclado es visible y el orden de lectura es lógico.
12. Ampliación de texto, teclado móvil y mensajes largos no ocultan controles críticos.
13. Los registros incompletos o desconocidos no se representan como cero, éxito o disponibilidad.
14. Cada indicador conduce a los registros que lo explican y muestra unidad, período y cobertura.
15. Los flujos de brigada funcionan sin depender del gabinete administrativo.
16. No aparecen funciones excluidas de la primera versión como GPS permanente u OBD-II.

## 13. Decisiones pendientes que afectan el diseño

| Decisión F2 | Impacto en pantallas |
|---|---|
| D-01 Autenticación | Credenciales/directorio, recuperación, PIN o biometría opcional, confirmación sensible |
| D-02 Roles y ámbito | Navegación, botones, supervisión por brigada, correcciones y exportaciones |
| D-03 Hardware | Lecturas disponibles, timeout, posición, bloqueo, LED y conciliación |
| D-04 Mantenimiento | Intervalos, alertas, combinación km/tiempo y restricción crítica |
| D-05 Pánico | Destinatarios, canales, contacto telefónico, escalamiento y reintento tardío |
| D-06 Evidencias | Tipos, tamaño, retención, acceso y correcciones de archivos |
| D-07 Android | Dispositivos, versiones, cámara, biometría y comportamiento en segundo plano |
| D-08 Infraestructura | Proveedor de acceso, correo/push, mapas si se utilizan y estados técnicos disponibles |
| D-09 Continuidad | Mensajes de indisponibilidad, soporte y procedimientos de recuperación |
| D-10 Anomalías | Umbrales, explicación de alertas y reglas de revisión |

Validaciones adicionales de UX: calendario de jornadas esperadas; semántica operativa del estado reservado; permisos de acceso sin conexión; tratamiento de sesión vencida con registros locales; cierre de asignación con jornada abierta; y acceso de emergencia cuando falta asignación. Son detalles por resolver, no razones para detener el diseño de los flujos ya documentados.

## 14. Prompt reutilizable para diseñar una pantalla

> Diseña la pantalla [ID y nombre] de DERCAS · GACOR S.A. dentro del sistema visual y reglas de la especificación adjunta.
>
> Perfil: [rol y ámbito]. Objetivo: [tarea concreta]. Entrada: [pantalla anterior]. Salida: [siguiente pantalla]. Usa la ficha de pantalla que pego a continuación como contrato funcional: [pegar ficha].
>
> Entrega una propuesta de alta fidelidad con contenido realista en español y datos ficticios claramente identificados; especifica distribución, jerarquía, campos obligatorios/condicionales, acción principal, acciones secundarias y validaciones. Incluye estado normal, carga, vacío, error y sin permiso; añade offline, conflicto o confirmación física cuando sean pertinentes.
>
> Conecta todos los botones del flujo. No inventes datos del sensor, permisos, políticas, fórmulas ni funciones excluidas. Las decisiones pendientes deben quedar anotadas fuera de la interfaz del usuario final. Reutiliza componentes ya definidos; no cambies tipografía, colores o navegación sin necesidad.
>
> Para web, entrega variantes escritorio/tablet/ancho pequeño compatibles con Angular. Para móvil, entrega Android con navegación, teclado, permisos y áreas táctiles adecuados. Explica brevemente cómo el diseño reduce pasos y evita errores operativos.

## 15. Orden recomendado de diseño y revisión

**Primero, portal web:** sistema visual y navegación por roles; flota/pilotos/asignaciones; retiro/devolución y gabinete; jornadas/combustible/mantenimiento; emergencias; analítica; administración y estados excepcionales.

**Después, móvil:** inicio del piloto e inicio/cierre de jornada; cámara y evidencias; combustible e incidencias; pánico y transmisión fallida; préstamo/devolución administrativa; sincronización, conflictos y sesiones.

Revisar con personal de oficina y campo los flujos críticos antes de producir todas las variantes. Probar la app en dispositivos representativos y con conectividad intermitente; probar el gabinete con hardware real. El diseño de alta fidelidad y el prototipo deben conservar trazabilidad hacia F1/F2 y registrar cambios de alcance por separado.
