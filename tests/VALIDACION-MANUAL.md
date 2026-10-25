# Validación funcional de la PR #2, solo con datos ficticios

**Estado: procedimiento preparado, no ejecutado en un navegador real por Codex.**
Las pruebas automatizadas no comprueban las descargas reales, la presentación,
el foco ni el almacenamiento del navegador. Esta guía permite completar esas
comprobaciones sin utilizar el perfil ni los datos de la aplicación habitual.

## Preparación: una carpeta nueva y un navegador invitado

1. Crea una carpeta nueva llamada `Pruebas-Economia`. No uses la carpeta de
   tu aplicación habitual ni importes ninguna de tus copias personales.
2. Descarga y descomprime dentro de ella estas dos copias del código:
   - [Versión anterior fijada a la base de esta PR](https://github.com/jfrubiogarcia-glitch/Economia-Familiar/archive/1e37777f73a52aa2d640fa0699d66a23e46f9ec0.zip).
   - [Versión nueva de la PR #2](https://github.com/jfrubiogarcia-glitch/Economia-Familiar/archive/refs/heads/fix/safe-json-restore.zip).
   Renombra las carpetas extraídas a `anterior` y `nueva`.
3. Los seis archivos ficticios están en `nueva/tests/fixtures`. No necesitas
   escribir ni editar JSON. El nombre «Juan» es una etiqueta que ya utiliza
   la interfaz; los registros e importes de estos archivos son inventados.
4. Abre una ventana **Invitado** de Chrome o Edge, sin iniciar sesión. No uses
   tu ventana habitual ni sincronices el perfil. Mantén esa sesión abierta
   hasta terminar los bloques A y B: al cerrar todas las ventanas de invitado
   se borran los datos de prueba del navegador.
5. Abre una terminal dentro de `Pruebas-Economia` y ejecuta:

   ```sh
   python3 nueva/tests/serve-validation.py --previous anterior
   ```

   En Windows puedes usar `py nueva/tests/serve-validation.py --previous anterior`.
   Si Python no está instalado o el puerto está ocupado, detente y comunícalo;
   no abras el HTML como archivo ni cambies el puerto a mitad de la prueba.
6. En la ventana Invitado escribe `http://127.0.0.1:8765` y elige
   **Abrir versión anterior**.
   Es un servidor de tu ordenador, accesible solo desde él. Las bibliotecas
   externas continúan descargándose por HTTPS. Si aparece un aviso de
   certificado, **no lo ignores**: detén la prueba.

**Para cambiar de versión:** vuelve a esa página inicial y elige la otra
versión en la misma pestaña Invitado. También puedes escribir la ruta
`/anterior/` o `/nueva/` después de la dirección. El servidor queda abierto.
Las dos rutas comparten almacenamiento porque mantienen la misma dirección
y puerto. No cambies entre `localhost` y `127.0.0.1` ni abras otro servidor.

## A. Importar, exportar, cancelar y restaurar

1. **En la anterior**, importa `01-valida.json`.
   Selecciona el año 2026 y octubre donde corresponda. Debes ver:
   ingresos **100 €**, gastos **20 €**, cartera **120 €** y patrimonio
   **170 €**. En el cálculo de disponible de octubre: **80 €**.
   Si no aparece la aplicación, anota el fallo y no continúes a ciegas.
2. Cambia a la **nueva** y recarga. Deben mantenerse esos datos.
   Exporta y guarda el archivo como `copia-ficticia-100.json` en la carpeta
   de pruebas. Debe existir realmente en el disco.
3. Importa `02-vacia.json`. El diálogo debe anunciar cuatro bloques vacíos.
   Pulsa **Cancelar** y recarga: deben seguir los datos del paso 1.
4. Vuelve a importar `02-vacia.json`. Elige **Descargar copia de los datos
   actuales**, comprueba que el archivo está guardado y marca la casilla
   correspondiente. Pulsa **Restaurar datos**. No debe quedar ningún ingreso,
   gasto, fondo ni fotografía. Recarga: deben seguir vacíos.
5. Importa `copia-ficticia-100.json`. Tras la confirmación deben reaparecer
   los importes del paso 1, también después de recargar. Como ahora solo
   hay datos ficticios vacíos, puedes probar la opción explícita de continuar
   sin descargar otra copia.
6. Importa, uno a uno, `03-invalida-parcial.json`, `04-importe-invalido.json`
   y `05-fondo-eliminado.json`. Cada archivo debe rechazarse. **Nunca debe
   aparecer un ingreso de 999 €**. Recarga y comprueba que siguen los
   importes originales. La copia inválida no debe abrir una restauración
   confirmable ni sustituir parte de los datos.
7. Importa `06-fotografias-vacias.json` y confirma. Debe borrar solo las
   fotografías: conservar ingresos 100 €, gastos 20 € y el catálogo del fondo.
   No compruebes 120 € de cartera sin fotografías: aquí se está probando
   precisamente su eliminación. Recarga y comprueba que no reaparecen.
8. Para dejar una referencia conocida, importa otra vez `01-valida.json`
   y confirma. Deben volver los importes del paso 1.

## B. Alternar versiones: comprobar la separación, no esperar sincronización

Continúa en la misma sesión Invitado y dirección. **No hagas esto con datos
reales**: las versiones guardan sus cambios en lugares diferentes.

1. En la **nueva**, añade un ingreso ficticio de **7 €**, en octubre de 2026.
   Debe haber 107 € de ingresos; recarga y compruébalo. Exporta y conserva
   el archivo como `nueva-107.json`.
2. Cambia a la **anterior** y recarga: debe mostrar **100 €**, no 107 €.
   Esto demuestra que no lee los cambios de la nueva.
3. En la anterior, añade un ingreso ficticio de **9 €**: deben ser **109 €**.
   Exporta como `anterior-109.json` y recarga para comprobar esos 109 €.
4. Regresa a la **nueva**: seguirá mostrando **107 €**, no 109 €.
   Importa `anterior-109.json`, guarda primero una copia de los 107 € y
   confirma: deben ser 109 €, también tras recargar.
5. Si quieres comprobar el traslado inverso, vuelve a la anterior e importa
   `nueva-107.json`. Debe mostrar 107 € tras recargar. Al volver a la nueva
   seguirán sus 109 € hasta importar expresamente otra copia.

**Resultado esperado y riesgo:** no hay sincronización ni combinación
automática. Volver al código anterior no es una reversión de datos segura.
La copia JSON completa y validada es el mecanismo de traslado; compara
siempre sus resultados. La versión anterior conserva además el defecto de
no vaciar fotografías al importar una copia vacía: no la uses como medio
de verificar o recuperar una restauración vacía de la nueva.

## C. Referencias a fondos eliminados

Este bloque comprueba un defecto histórico que la PR **no corrige**.
Primero guarda los archivos ficticios que quieras conservar y cierra todas
las ventanas Invitado. Abre una sesión Invitado nueva y sirve la anterior.

1. En la **anterior**, importa `01-valida.json`.
2. En Cartera de Inversión, pulsa **Desplegar formulario de actualización**.
   En la tarjeta FONDO FICTICIO, pulsa **Editar Fondo** y después **Eliminar**.
   Confirma; si el cuadro sigue abierto, ciérralo con Cancelar.
   La fotografía conserva una referencia al identificador eliminado, aunque
   los totales pueden dejar de incluir su valor. Anota lo que ves.
3. Cambia a la **nueva** con la misma dirección y sesión. No debe inventar
   otro fondo, reclasificarlo ni reparar silenciosamente el histórico.
   Exporta. Debe advertir que existen inconsistencias y que la copia
   necesitará revisión antes de restaurarla.
4. Importa `05-fondo-eliminado.json`: debe rechazarlo completo; el ingreso
   de 999 € no debe sustituir los 100 € existentes, tampoco tras recargar.

**Advertencia importante:** el archivo exportado conserva el desglose
original de la fotografía, pero los resúmenes calculados pueden omitir el
fondo ausente. No es una copia validada para restauración automática.
No borres las fotografías ni recrees fondos con identificadores nuevos para
«hacer pasar» el archivo. Necesitamos decidir por separado cómo conservar
el catálogo histórico y sus referencias originales.

## D. Presentación básica de móvil (emulación, no teléfono físico)

En la nueva y con `01-valida.json` restaurado:

1. Haz clic derecho en la página, elige **Inspeccionar** y pulsa el icono
   de teléfono/tablet de las herramientas del navegador.
2. Elige un ancho aproximado de **390 píxeles**. Comprueba las tres pestañas,
   los botones de importación/exportación y el desplazamiento de las tablas.
3. Importa la copia vacía sin confirmar. El diálogo, sus casillas, Cancelar
   y Restaurar deben poder verse y usarse. Prueba cerrar con Escape.
4. Cancela, recarga y comprueba que siguen los datos ficticios. Comprueba
   también la orientación horizontal si el selector lo permite.

Esto valida el tamaño de pantalla en un navegador real. No valida un
teléfono físico, el selector de archivos de iOS/Android ni el teclado táctil.
No abras el servidor a tu red doméstica para esta prueba mínima.

## Qué comunicar para cerrar la validación

Puedes responder con esta lista, indicando «correcto», «falló» o «no probado»:

| Comprobación | Resultado |
| --- | --- |
| A: datos iniciales, exportación y descarga real | |
| A: cancelación y restauración vacía tras recargar | |
| A: recuperación de la copia exportada tras recargar | |
| A: tres copias inválidas rechazadas sin cambios | |
| A: vaciar solo fotografías conserva los otros bloques | |
| B: secuencia 100 → 107 / anterior 100 → 109 / nueva 107 | |
| B: traslado explícito mediante JSON y recarga | |
| C: aviso de histórico huérfano y rechazo sin cambios | |
| D: emulación móvil y controles del diálogo | |

Indica navegador, sistema operativo y fecha. Si hay un error, basta con el
paso y el mensaje. Comparte solo archivos/capturas de estas pruebas ficticias.

Al terminar, detén el servidor con Ctrl+C y cierra todas las ventanas Invitado.
No incorpores la PR por el mero hecho de terminar esta lista: deben revisarse
los resultados y acordarse el alcance de los riesgos de versiones e históricos.
