# Estado de validación funcional de la PR #2

Fecha de comprobación: 25 de octubre de 2026.

**La PR sigue en borrador. No se ha incorporado a main.** No se han usado datos
reales, cambiado fórmulas o clasificaciones, ni modificado la configuración del
entorno. Esta actualización añade documentación, archivos ficticios, pruebas,
un servidor local auxiliar y la actualización autorizada de AGENTS.md.

## Comprobado por Codex

- `node --test tests/backup.test.cjs`: 69 pruebas superadas, ninguna fallida,
  omitida o marcada como pendiente. Son pruebas de lógica y manejadores con
  almacenamiento y APIs simulados; no son pruebas de navegador.
- Los seis archivos de `tests/fixtures` producen los resultados indicados
  en la guía: la copia válida se acepta; las copias inválidas no cambian datos;
  las copias vacías borran los bloques correspondientes.
- Se ejecutaron adicionalmente las funciones originales de lectura,
  escritura e importación de la versión anterior fijada al commit
  `1e37777f73a52aa2d640fa0699d66a23e46f9ec0`, junto con las funciones nuevas,
  utilizando almacenamiento y FileReader simulados. Se comprobó la
  transferencia explícita de un JSON no vacío generado por la nueva versión
  a la importación anterior. Esto tampoco equivale a ejecutar su interfaz.
- El servidor auxiliar responde con el HTML anterior y el nuevo sin
  reescribirlos, sirve `backup.js` y el JSON ficticio y mantiene ambas rutas
  en el mismo origen local. Rechaza rutas y enlaces simbólicos que salgan
  de las carpetas previstas. Se comprobó el rechazo de carpetas inexistentes
  y del uso de la misma carpeta como ambas versiones.
- `git diff --check` sin errores.

## Alternar versiones: resultado reproducido con funciones originales

| Acción sobre datos ficticios | Resultado |
| --- | --- |
| Cargar la anterior con ingresos de 100 € | Anterior y nueva leen 100 € |
| Guardar 7 € más en la nueva | Nueva: 107 €; anterior: 100 € |
| Guardar 9 € más en la anterior | Anterior: 109 €; nueva: sigue en 107 € |
| Importar expresamente en la nueva la copia de la anterior | Nueva: 109 € |

La nueva utiliza una clave consolidada; la anterior solo utiliza las cuatro
claves originales. Conservar estas claves protege el contenido inicial, pero
no sincroniza las dos versiones. Cambiar de código puede hacer que parezca
que han desaparecido cambios, cuando están guardados en el otro formato.

También se reprodujo el defecto de la **versión anterior** al recibir una
exportación vacía de la nueva: conserva una fotografía antigua. Por tanto,
una exportación vacía no permite garantizar una vuelta fiel a la anterior.
No se presenta la compatibilidad como bidireccional para todos los casos.

Antes de usar datos reales hay que acordar una transición de versión única,
con copia verificada, y un procedimiento explícito para cualquier vuelta atrás.
No se han sincronizado claves ni cambiado ese comportamiento en esta tarea.

## Fondos eliminados: resultado reproducido

Con una fotografía ficticia que conserva un fondo de valor 120 € y liquidez
50 €, al faltar el fondo en el catálogo:

- El desglose original exportado sigue conteniendo 120 €.
- El resumen calculado exportado muestra cartera 0 € y patrimonio 50 €.
- La interfaz nueva advierte de las inconsistencias al exportar.
- Reimportar ese archivo en la nueva se rechaza por la referencia rota,
  sin modificar el contenido existente.
- Crear otro fondo con el mismo nombre y distinto identificador no repara
  la referencia ni permite importar silenciosamente la copia.

Se mantienen las fórmulas anteriores; no se ha reconstruido el catálogo ni
reinterpretado el histórico. El archivo conserva material para recuperación,
pero **no es una copia validada para restauración automática**.

Se necesita una decisión separada sobre conservación del catálogo histórico:
por ejemplo, archivar fondos en lugar de borrarlos y recuperar sus referencias
originales desde una copia fiable cuando existan. No deben inventarse fondos,
identificadores, categorías ni importes. No se recomienda cerrar este riesgo
como resuelto por la validación JSON.

## No comprobado en un navegador real

No hay Firefox ni WebKit instalados ni una herramienta de navegador remoto
disponible. Chromium aborta con su sandbox activado por la configuración del
ejecutable `chrome-sandbox`. El mecanismo alternativo de espacios de usuario
tampoco está disponible en esta máquina. No se han desactivado protecciones,
instalado certificados ni pedido nuevos permisos de red.

Siguen pendientes:

- Importación/exportación mediante el selector y las descargas reales.
- Confirmación, cancelación, foco y cierre del diálogo.
- Persistencia real después de recargar y alternar versiones.
- Presentación y controles en emulación móvil; pruebas en teléfono físico
  si se quieren validar también sus selectores y teclado.
- Fallos reales de almacenamiento: hasta ahora solo se han simulado.

La alternativa mínima es usar un perfil Invitado en el navegador del usuario,
dos archivos ZIP del código y el servidor local de la guía. No necesita
cuentas, alojar una web pública ni enviar datos a servicios de pruebas externos.

## Para cerrar la fase

1. Ejecutar la [guía manual](VALIDACION-MANUAL.md) con los archivos ficticios.
2. Revisar los resultados e investigar los fallos que aparezcan. Un resultado
   esperado de separación entre versiones no significa sincronización correcta.
3. Acordar el procedimiento de transición y vuelta atrás entre versiones,
   y el tratamiento de catálogos históricos incompletos. Estas decisiones
   siguen pendientes; no se han cambiado criterios financieros.
4. Decidir expresamente si los riesgos históricos quedan como requisito previo
   o como una fase posterior delimitada. Ninguno debe declararse corregido.
5. Solo después de esa revisión, decidir si la PR deja de ser borrador.
   Su incorporación a main sigue requiriendo aprobación del usuario.
