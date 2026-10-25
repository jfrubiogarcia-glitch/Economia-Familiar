# Instrucciones específicas de Economía Familiar

Estas instrucciones complementan las instrucciones generales de Codex.
Si existe un conflicto entre instrucciones aplicables, indícalo antes de realizar una acción que pueda afectar a datos o históricos financieros.

## Contexto del proyecto

- La interfaz y los cálculos financieros están en `index.html`; la validación y persistencia de las copias JSON están en `backup.js`.
- Utiliza localStorage e importación/exportación JSON. No dispone de backend, autenticación ni sincronización remota.
- Las bibliotecas se cargan desde CDN. Actualmente no hay manifiesto de dependencias ni proceso de compilación. Las pruebas de restauración utilizan Node.js sin dependencias adicionales.
- Comprueba estas características antes de apoyarte en ellas: actualiza estas instrucciones cuando cambie la arquitectura.

## Prioridades de trabajo

1. Conservar los datos, las copias de seguridad y los históricos.
2. Garantizar la coherencia de las restauraciones y los cálculos.
3. Mantener las funciones existentes y su facilidad de uso.
4. Preferir soluciones sencillas, funcionales y fáciles de mantener.

Evita refactorizaciones amplias y nuevas dependencias cuando una solución pequeña y clara resuelva el problema. Limita cada cambio a su objetivo.

## Datos y privacidad

- Desarrolla y prueba exclusivamente con datos ficticios y perfiles de navegador aislados.
- No utilices, modifiques, borres ni sobrescribas datos financieros reales. Si una tarea exige tratarlos, detente y solicita autorización específica.
- No publiques información financiera personal ni la incluyas en código, commits, pruebas, registros, capturas o informes compartidos.
- No añadas copias JSON personales al repositorio.
- No alteres copias originales. Las pruebas de recuperación deben usar copias ficticias y conservar intacto el material de partida.
- No muestres mensajes de guardado o restauración correctos si la persistencia no se ha confirmado.

## Importación y restauración JSON

- Valida íntegramente el archivo antes de modificar el estado de la aplicación o el almacenamiento persistente.
- Comprueba estructura, tipos, campos obligatorios, fechas, números finitos, identificadores únicos y referencias entre registros.
- Comprueba las relaciones financieras que correspondan al modelo. No conviertas silenciosamente valores inválidos en cero.
- Distingue entre un campo ausente, una lista vacía y un dato inválido.
- Define explícitamente si la operación sustituye o combina datos. No cambies esa semántica sin explicarlo y probar su compatibilidad.
- Una importación rechazada debe dejar los datos anteriores intactos. Evita actualizaciones parciales y contempla fallos al persistir.
- Antes de sustituir datos, el flujo debe permitir conservar una copia recuperable y explicar qué información se reemplazará.
- No prometas compatibilidad con copias antiguas sin probarla. Documenta las versiones de formato y sus migraciones cuando existan.

## Históricos y cálculos financieros

- Eliminar, archivar o editar un fondo no debe cambiar silenciosamente los importes ni la clasificación de períodos anteriores.
- Conserva las referencias necesarias para interpretar las fotografías históricas, incluso cuando un fondo deje de estar activo.
- Distingue aportaciones, retiradas, variaciones de valor y rentabilidad. No presentes variación patrimonial como ganancia de inversión.
- Documenta las fórmulas, sus supuestos y las reglas de redondeo.
- Distingue cero de dato desconocido y de ausencia de referencia.
- Mantén coherencia entre pantalla, gráficas, almacenamiento y exportación. Evita mantener fórmulas equivalentes en varios lugares.
- Si el significado financiero de un cambio no está claro, acláralo antes de modificar fórmulas o reinterpretar históricos.
- No modifiques unilateralmente las categorías de activos, los criterios de clasificación, las fórmulas de rentabilidad ni la interpretación de los indicadores financieros. Cuando detectes una posible mejora, explica el problema, propone alternativas y solicita mi aprobación antes de cambiar el criterio.

## Pruebas y entrega

- Ejecuta pruebas pertinentes antes de entregar cualquier cambio. No basta con comprobar sintaxis cuando cambia el comportamiento.
- Para cada defecto corregido, incorpora o ejecuta una prueba que reproduzca el fallo anterior y compruebe el resultado esperado.
- Si cambia la restauración, comprueba al menos: copia válida, copia vacía, campos ausentes, datos inválidos, referencias rotas y ausencia de cambios parciales tras un fallo.
- Si cambia el modelo financiero, comprueba también la conservación del historial y la coherencia de totales y exportaciones.
- Cuando afecte a la interfaz o al almacenamiento, verifica el flujo en un navegador y la persistencia tras recargar.
- Ejecuta `node --test tests/backup.test.cjs` desde la raíz para comprobar la validación, restauración y persistencia JSON. Las instrucciones están en `tests/README.md`. Estas pruebas utilizan almacenamiento y APIs de navegador simulados; no sustituyen la validación en un navegador real.
- Si un bloqueo del entorno impide una comprobación, informa de ello y distingue lo ejecutado de lo pendiente. No declares validado el comportamiento que no hayas podido comprobar.

Para servir la aplicación actual desde la raíz:

    python3 -m http.server 8000 --bind 127.0.0.1

Las dependencias actuales requieren acceso a:
`cdn.tailwindcss.com`, `unpkg.com` y `cdn.jsdelivr.net`.

No omitas verificaciones HTTPS ni desactives el aislamiento de seguridad del navegador para conseguir que una prueba pase. Utiliza únicamente autoridades certificadoras legítimas y de procedencia comprobada.
Si pruebas una copia con dependencias locales, identifica esa diferencia respecto a la aplicación original.

## Mantenimiento de las instrucciones

Avisa proactivamente cuando nuestras interacciones revelen una nueva regla estable, una decisión financiera, un cambio de arquitectura o una corrección de estas instrucciones.

Propón actualizar:
- `AGENTS.md` si la instrucción es específica de Economía Familiar.
- Las instrucciones generales si debe aplicarse a otros proyectos.

Explica brevemente el motivo y el texto recomendado. No modifiques ninguna de esas instrucciones sin autorización.
