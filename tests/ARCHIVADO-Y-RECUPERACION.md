# Archivado y recuperación del catálogo financiero

Rama: `fix/preserve-fund-history`, basada en `f3528ef` de la PR #2.
Los criterios de último valor cero y recuperación confirmada desde registros
originales fueron aprobados por el usuario antes de implementarse.

## Significado y conservación

- Archivar cambia únicamente `archived` a `true` en el registro original.
  Conserva identificador, nombre, ISIN, fecha de inicio, clasificación,
  gestora y cualquier otro campo; no crea ni modifica fotografías.
- Solo se permite si existe una valoración explícita del fondo y la última
  es exactamente cero. Se consulta la última fecha con desglose de ese fondo,
  sin inferir saldos de un resumen agregado. Saldo positivo, negativo,
  desconocido o ausencia de fotografías bloquean la acción.
- Archivar no registra venta, retirada, transferencia ni pérdida. No deben
  añadirse fotografías ficticias de saldo cero para poder archivar un fondo.
- La reactivación cambia solo la marca administrativa y no registra movimientos.
- El formulario de activos excluye los archivados. Un apartado separado
  permite consultarlos y reactivarlos. El desglose del período puede mostrarlos
  con una etiqueta de «archivado actualmente»; no se presume que ya lo estaban
  en la fecha histórica que se está consultando.
- Los cálculos conservan el catálogo completo, incluidos los archivados.
  El filtro visual no modifica sumas, fórmulas, porcentajes ni clasificaciones.
- Los datos identificativos de un fondo referenciado quedan protegidos en el
  formulario: nombre y gestora también influyen en cálculos/clasificaciones
  existentes. Una restauración parcial del catálogo no puede cambiarlos
  dejando intactas las fotografías vinculadas.

## Fotografías posteriores y edición del histórico

Editar una fotografía conserva exactamente sus entradas de fondos archivados,
incluidos los campos adicionales. No se insertan entradas que no existían.
No se permite cambiar desde ese formulario la fecha de una fotografía con
entradas archivadas ni descartar/recalcular sus resúmenes guardados.

El formulario conserva la precarga existente de valores registrados, pero
para archivados los muestra por separado, de solo lectura y con fecha de origen.
Guardar una **nueva** fotografía exige revisarlos y confirmarlos expresamente.
No se guarda automáticamente una fotografía al archivar. Se bloquea si falta
información, el valor no es cero, se altera la aportación copiada o la fecha
propuesta es anterior a la de los valores de origen. No se completan ausencias
con cero para hacer pasar la operación. Reactivar permite introducir nuevos
datos explícitos cuando corresponda.

Tampoco se puede sobrescribir silenciosamente una fecha ya existente desde
el alta de fotografías, ni borrar la última observación de cero si eso deja
un fondo archivado con valor anterior no cero o desconocido.

## Referencias huérfanas

Se detectan identificadores de `fundsData` ausentes del catálogo. Al encontrarlos
en datos locales se conserva el contenido y se suspende la vista de cálculos
de inversión, en lugar de mostrar importes incompletos como si fueran totales.
La exportación conserva los cuatro bloques originales, incluidos los resúmenes
ya guardados dentro de fotografías, pero no genera la tabla derivada adicional
que podría omitir los fondos ausentes. Se advierte que esa copia necesita revisión.

La restauración normal sigue rechazando referencias inconsistentes. Una copia
con referencias huérfanas puede quedar en revisión, **sin modificar el estado
ni el almacenamiento**. La recuperación admite dos destinos: el conjunto local
ya guardado o ese archivo pendiente de restaurar.

### Recuperación confirmada

1. Se selecciona otra copia que conserve los registros originales completos.
2. Se valida todo el archivo de origen, no solo los fondos candidatos.
3. Debe contener todos los identificadores ausentes. No se empareja por nombre
   ni se generan identificadores. Los registros existentes no se sustituyen.
4. Se rechazan discrepancias de identidad/clasificación entre catálogos,
   metadatos identificativos guardados en las fotografías y valores distintos
   de fotografías de la misma fecha que contengan el fondo recuperado.
5. Se muestran los registros propuestos. El usuario debe confirmar que la
   copia seleccionada es la original correcta; la aplicación puede comprobar
   coherencia, pero no autenticar por sí sola la procedencia de un JSON.
6. Se ofrece descargar el estado actual y comprobar la descarga, o elegir
   expresamente continuar sin otra copia. Una descarga solicitada no prueba
   que el archivo se haya guardado.
7. Se valida el destino completo y se guarda en una única operación, siguiendo
   el almacenamiento de la PR #2. Si cambió el almacenamiento mientras se
   revisaba, falla el guardado o se cancela, no se aplica la recuperación.

Solo se añaden los registros originales ausentes del catálogo. Las fotografías,
fechas, importes, identificadores y demás bloques proceden íntegramente del
destino revisado, no se reemplazan por los de la copia de origen. Para un archivo
pendiente, el diálogo explica además qué bloques se restaurarán del archivo.

### Necesitan intervención

- No existe una copia con el registro original completo o faltan identificadores.
- Las fuentes discrepan en identidad, clasificación o valores de una misma fecha.
- Una fotografía huérfana conserva `table2` o `summary`: la recuperación automática
  se bloquea de forma conservadora para no decidir qué representación histórica
  es correcta. No se recalculan ni eliminan esos resúmenes.
- El estado archivado del registro recuperado no concuerda con una valoración
  cero del destino. No se reactiva ni se pone a cero silenciosamente.

Una fotografía que solo conserva un resumen agregado válido puede mantenerse
como resumen; no implica que sea posible reconstruir fondos o movimientos.

## Compatibilidad

Los JSON anteriores sin `archived` se mantienen activos y conservan sus campos.
Las copias nuevas guardan la marca booleana y se validan con el mismo motor de
restauración íntegra. La lectura inicial no migra ni repara automáticamente.

La versión anterior y la PR #2 aislada **no implementan el archivado**: pueden
mostrar esos fondos como activos e incluso permitir eliminarlos. No se deben
editar datos archivados con esas versiones. Se mantiene el riesgo ya documentado
de separación entre las cuatro claves antiguas y la clave consolidada nueva.

## Validación y límites

Se ejecutó `node --test tests/backup.test.cjs`: 113 pruebas superadas, sin fallos
ni omisiones. Ese punto de entrada incluye `fund-history.cases.cjs`. Las pruebas
usan datos ficticios, las funciones reales y APIs/almacenamiento simulados.
Reproducen el defecto de eliminación y comprueban archivado, recuperación,
compatibilidad, confirmaciones, cancelación, errores y conservación de datos.
También comprueban que los ceros explícitos de fotografías archivadas no se
reemplacen por resúmenes sintetizados y que un resumen contradictorio se rechace.

También se comprueban la sintaxis de JavaScript, la compilación completa del JSX
y la identidad de los bloques de fórmulas frente a la base de la PR #2.
El usuario ha comunicado resultados satisfactorios de validación parcial en
Chrome Invitado, incluyendo archivado, reactivación, recuperación y recarga.
Los [resultados y límites comunicados](VALIDACION-CHROME-INVITADO.md) distinguen
esa evidencia de las pruebas automatizadas. Codex no ejecutó el navegador:
el sandbox de Chromium continúa bloqueado y no se han desactivado protecciones
ni cambiado el entorno. iPhone físico y los casos no confirmados siguen pendientes.

La [validación conjunta](VALIDACION-CONJUNTA.md) utiliza esta rama que contiene
ambas mejoras. Las dos PR siguen en borrador por instrucción del usuario.
GitHub Pages publica desde main, por lo que se propone revisar #2 y después #3,
pero llevar ambas mejoras a main en una única actualización pública. El
[plan de publicación](PUBLICACION-SEGURA.md) detalla las alternativas y las
autorizaciones pendientes. No desplegar #2 aislada para editar datos archivados.
