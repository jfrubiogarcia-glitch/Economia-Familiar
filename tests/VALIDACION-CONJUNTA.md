# Una validación funcional para restauración segura y archivado

**Pendiente de ejecutar en un navegador real.** Esta rama contiene la PR #2
y el archivado/recuperación aprobados. No es necesario probar dos mejoras en
instalaciones distintas. Ninguna PR debe incorporarse a main por seguir esta guía.

## Preparación aislada

1. Crea una carpeta nueva `Pruebas-Economia`. No utilices tu aplicación habitual,
   su perfil de navegador ni ninguna copia personal.
2. Descarga estos ZIP y extrae sus carpetas como `anterior` y `nueva`:
   - [Anterior, versión de referencia](https://github.com/jfrubiogarcia-glitch/Economia-Familiar/archive/1e37777f73a52aa2d640fa0699d66a23e46f9ec0.zip).
   - [Nueva, las dos mejoras juntas](https://github.com/jfrubiogarcia-glitch/Economia-Familiar/archive/refs/heads/fix/preserve-fund-history.zip).
3. Abre una ventana **Invitado** de Chrome o Edge, sin iniciar sesión. Guarda
   cualquier descarga de esta prueba en la carpeta de pruebas: todo será ficticio.
4. En una terminal dentro de `Pruebas-Economia`, ejecuta:

   ```sh
   python3 nueva/tests/serve-validation.py --previous anterior
   ```

   En Windows: `py nueva/tests/serve-validation.py --previous anterior`.
   Si Python no está instalado o aparece un error, detente y comunícalo.
5. En Invitado abre `http://127.0.0.1:8765` y elige **versión nueva**.
   Mantén la terminal abierta. No ignores avisos HTTPS de las bibliotecas.
   Los JSON de prueba están en `nueva/tests/fixtures`.

El servidor solo escucha en tu ordenador. No necesita publicarse ni abrirse
a la red doméstica. Para cambiar de versión vuelve a su página inicial en
la misma pestaña; ambas rutas comparten el mismo origen y almacenamiento.

## 1. Restauración y copia previa

- Importa `01-valida.json`. Confirma y, donde corresponda, elige 2026 y octubre.
  Debes ver ingresos 100 €, gastos 20 €, cartera 120 € y patrimonio 170 €.
- Exporta como `copia-ficticia.json`. Comprueba que existe el archivo.
- Importa `02-vacia.json` y pulsa Cancelar. Recarga: los datos siguen iguales.
- Vuelve a importar la copia vacía. Descarga la copia previa, comprueba que
  está guardada, marca la confirmación y restaura. Recarga: no quedan ingresos,
  gastos, fondos ni fotografías. Importa tu `copia-ficticia.json` y comprueba
  que vuelven los datos tras recargar.
- Prueba `03-invalida-parcial.json` y `04-importe-invalido.json`: deben rechazarse
  sin cambios. No debe aparecer 999 € ni antes ni después de recargar.

## 2. Archivado sin cambiar fotografías

- Con `01-valida.json` cargado, abre Cartera de Inversión y despliega el
  formulario de actualización. En FONDO FICTICIO, pulsa Editar Fondo y Archivar.
  Debe bloquearse: su último valor es 120 €. No lo pongas a cero para probarlo.
- Importa `07-valor-cero.json`, que **ya contiene dos fotografías ficticias**:
  el 1 de octubre, valor 120 y patrimonio 170; el 8, valor 0 y patrimonio 50.
  Esos son datos de prueba explícitos, no una venta que haya calculado la aplicación.
- Archiva ahora el fondo. Debe conservarse en Fondos archivados actualmente y
  desaparecer de los activos. En la tabla histórica, activa Mostrar fondos
  archivados si quieres ver su fila. La etiqueta indica su estado actual.
- Las dos fotografías deben conservar sus fechas y valores. Recarga y vuelve
  a comprobarlo. Exporta como `archivado-ficticio.json`, restaura la copia vacía
  y después esa exportación: deben volver las fotografías y el estado archivado.
- Edita la fotografía del 1 de octubre y guárdala **sin cambiar sus campos**.
  Su entrada del fondo archivado debe seguir en 120, no en cero ni ausente.
- Prepara una fotografía nueva con fecha 15 de octubre de 2026. El apartado
  de archivados muestra sus valores registrados y fecha de origen. No debe
  guardar hasta confirmar que los has revisado; tras confirmar, guarda y recarga.
  La nueva fotografía tendrá los valores explícitamente revisados. Las dos
  antiguas deben seguir intactas. Cancelar ese formulario no crea ninguna foto.
- Comprueba Reactivar: vuelve a los activos sin cambiar fotografías. Archívalo
  otra vez si su último valor sigue siendo cero. Un fondo sin ninguna valoración
  no debe poder archivarse inventándole una cifra.

## 3. Recuperación confirmada de una copia con referencias huérfanas

Los datos del bloque anterior deben mantenerse hasta confirmar esta operación.

- Importa `05-fondo-eliminado.json`. Debe abrir una revisión de recuperación,
  **sin restaurar todavía**. No debe aparecer el ingreso de 999 €.
- Selecciona `02-vacia.json` como copia de origen: no contiene el registro y
  debe bloquear la recuperación.
- Selecciona `08-origen-conflictivo.json`: discrepa en el valor de una foto
  de la misma fecha. Debe bloquearse, sin reemplazar la cifra por 121.
- Selecciona `01-valida.json` como copia original. Debe proponer exclusivamente
  el registro de FONDO FICTICIO con su identificador, categoría y fecha originales.
- Cancela y recarga: los datos anteriores siguen iguales. Repite el proceso
  con `05-fondo-eliminado.json` y origen `01-valida.json`.
- Descarga el estado previo o elige expresamente continuar sin otra copia.
  Confirma que el registro procede de la copia original correcta y ejecuta
  Recuperar registros y restaurar la copia.
- **Solo ahora** debe aparecer el ingreso de 999 € que el archivo seleccionado
  quería restaurar. No se importa el ingreso 100 de la copia de origen: de ella
  se recupera solo el catálogo. La foto conserva fecha 1 de octubre, aportación
  100, valor 120, liquidez 50 y patrimonio 170. Recarga para comprobarlo.
- Prueba `09-huerfana-con-resumen.json` con origen `01-valida.json`. Debe pedir
  intervención y no permitir la recuperación automática del resumen guardado.
  Cancela: ningún importe actual debe cambiar.

Restaurar una copia antigua sin marca de archivado devuelve el estado activo
que contiene esa copia. La aplicación no debe añadirle un archivado inexistente.

## 4. Recuperación del catálogo de datos que ya estaban guardados

Guarda las descargas ficticias que quieras conservar y cierra **todas** las
ventanas Invitado para empezar este escenario sin una clave consolidada previa.
Abre otra sesión Invitado y entra en la **versión anterior** desde la portada.

- Importa `01-valida.json` en la anterior. Despliega el formulario de inversiones,
  pulsa Editar Fondo en FONDO FICTICIO y Eliminar. Si el cuadro sigue abierto,
  ciérralo con Cancelar. Esta acción solo debe hacerse con este ejemplo ficticio.
- Cambia a la nueva desde la portada. Debe advertir que falta el identificador
  del fondo y no presentar cálculos de inversión como completos.
- Exporta: conserva los bloques originales sin generar la tabla derivada
  adicional que podría omitir el fondo. Debe advertir que la copia necesita revisión.
- Pulsa Revisar recuperación desde una copia original, selecciona `01-valida.json`,
  revisa y confirma con la copia previa correspondiente. Se añade el registro
  ausente, sin sustituir las fotografías ni importar otros bloques del origen.
- Deben volver los cálculos de cartera 120 y patrimonio 170, con ingresos
  100 y gastos 20. Recarga y comprueba que se mantienen.

## 5. Móvil y controles reales

En la versión conjunta, haz clic derecho → Inspeccionar → icono de móvil/tablet.
Elige unos 390 píxeles de ancho. Comprueba las tres pestañas, desplazamiento de
tablas, apartado de archivados, diálogo de restauración y diálogo de recuperación.
Sus casillas, botones y selectores deben poder usarse; Escape debe cancelar sin
guardar. Restaura una copia ficticia y comprueba su persistencia tras recargar.

Esto es emulación en un navegador real, no un teléfono físico. No comprueba
el selector ni el teclado de iOS/Android. Los errores de almacenamiento se han
comprobado con simulaciones; no se afirma haber provocado una cuota real.

## Qué falta para cerrar e integrar

Comunica navegador, sistema y «correcto / falló / no probado» para los cinco
bloques. Si falla algo, indica el paso y el mensaje, solo con archivos ficticios.
Detén el servidor con Ctrl+C y cierra Invitado al terminar.

No vuelvas a editar datos archivados desde la anterior ni desde la PR #2 aislada:
ignoran el significado de la marca y permiten eliminación. Tampoco hay sincronización
entre las claves antiguas y la nueva; cambiar de código no revierte datos fielmente.

Tras revisar pruebas y riesgos, se propone aprobar la PR #2 y después esta PR,
cambiando su base a main cuando corresponda, sin utilizar la versión intermedia
para editar datos archivados. Hasta recibir aprobación explícita, ambas deben
seguir en borrador y sin incorporar cambios a main.
