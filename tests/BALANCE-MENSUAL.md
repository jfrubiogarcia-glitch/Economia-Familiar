# Balance mensual familiar: criterios y validación

Rama: `feat/monthly-family-balance`, desde main `758fa87` (que ya incluye las PR #2 y #3).
No se modifica ni publica main. Se utilizan exclusivamente datos ficticios.

## Uso y significado

La nueva pestaña requiere dos cantidades por mes: ahorro neto nuevo en fondos/
planes y en liquidez. Admite negativos para retiradas netas destinadas a consumo.
Los campos vacíos no significan cero. No se obtienen estas cantidades de las
fotografías, de las revalorizaciones o del concepto Ahorro registrado en Gastos.

Se utiliza el mes de cobro/cargo ya asignado a los apuntes. Los cálculos son:

- Ahorro neto total = ahorro en fondos + ahorro en liquidez.
- Gasto total estimado = ingresos incluidos − ahorro neto total.
- No desglosado estimado = gasto estimado − gastos registrados incluidos.

Los totales monetarios nuevos se redondean a céntimos; no se modifican los
importes originales ni las fórmulas/clasificaciones de las pestañas existentes.
Los negativos inesperados se muestran con advertencias, sin recortarlos a cero.

### Movimientos y doble contabilización

Las decisiones se guardan solo en el balance. Nunca se cambia el concepto,
importe, persona o fecha del apunte original.

- Ingresos: ingreso real (incluir), transferencia interna (excluir) o retirada
  de ahorro (excluir de ingresos; ya debe estar contemplada una sola vez en
  los importes netos de ahorro).
- Gastos: gasto real (incluir), ahorro real (excluir) o transferencia interna
  (excluir). Un apunte llamado **Ahorro** comienza sin clasificar: su nombre
  no basta para excluirlo. Si realmente era gasto, debe mantenerse como gasto.
- Los demás apuntes conservan por defecto su tratamiento de ingreso/gasto.
  No se adivina que un «traspaso» o «retirada» lo sea por su nombre o importe.
- Trasladar ahorro ya existente de liquidez a fondos no es ahorro nuevo:
  esos movimientos se excluyen de los dos importes netos. No se genera una
  aportación ni una retirada adicional para compensarlos.
- La aplicación no puede comprobar el origen bancario del dinero. El usuario
  identifica los movimientos existentes y confirma que los importes netos
  están depurados. No se ajustan de nuevo esas cantidades automáticamente.

### Conciliación y anual

Todos los cálculos de gasto siguen siendo **estimaciones**, incluso en meses
revisados. «Registrado» no significa confirmado por el banco; «revisado» es
una declaración del usuario de que no quedan movimientos pendientes.

Los apuntes Ahorro sin clasificar, decisiones sobre apuntes modificados o
eliminados y los campos desconocidos impiden cerrar la revisión. Pueden
guardarse balances completos como pendientes. Las decisiones antiguas se
conservan como referencia, pero no se aplican a un apunte cambiado sin revisión.

Si cambia cualquier ingreso/gasto del mes, el ahorro o su tratamiento, la
revisión efectiva vuelve a pendiente. Los importes y notas guardados no se
reescriben; se compara la revisión contra sus datos de origen. Reordenar los
apuntes o modificar una nota no cambia por sí solo la revisión financiera.

La tabla y el gráfico contienen doce meses. No se inventan valores cero para
meses sin balance. El gasto pendiente se distingue gráficamente del revisado.
Los acumulados de los siete conceptos utilizan únicamente los mismos meses
revisados; la media de gasto divide por su número, no siempre entre doce.
Sin meses revisados, los acumulados y la media se muestran sin dato.

## Datos, copias y versiones

`monthlyBalances` es un bloque adicional opcional. Cada registro contiene un
mes único, dos importes finitos, decisiones sobre apuntes, referencia de revisión
y nota. Los resultados derivados se recalculan desde los apuntes actuales.

- Las copias anteriores sin el bloque conservan los balances ya existentes;
  si cambian sus ingresos/gastos, su revisión queda pendiente. El diálogo lo
  explica. Que una copia anterior vacíe los cuatro bloques antiguos no autoriza
  a borrar balances ausentes del archivo.
- Un bloque explícito `monthlyBalances: []` los vacía. Las nuevas exportaciones
  siempre incluyen el bloque y `backupVersion: 2`, por lo que una copia nueva
  vacía restaura los cinco bloques vacíos.
- Los datos locales versión 1 siguen cargándose sin migración ni escritura al
  abrir. Cuando hay balances se guarda el conjunto completo en versión 2,
  mediante la misma operación atómica; las cuatro claves antiguas no se borran.
- La versión anterior de la aplicación que solo admite almacenamiento versión 1
  rechazará el nuevo registro consolidado. No utilizar versiones anteriores para
  editar o volver a exportar estas copias: no conocen los balances.
- Un archivo inválido no importa parcialmente otros bloques. Se valida también
  el contenido completo de los balances y sus decisiones.
- Si el almacenamiento consolidado es ilegible y no se puede descartar que haya
  balances, la recuperación exige incluirlos expresamente. Una versión 1 legible
  que no los contiene aún puede recuperarse desde una copia anterior completa.
- Al guardar un balance se comprueba si otra ventana ha cambiado el almacenamiento.
  Si hay diferencia o falla el acceso/guardado, no se aplica el cambio ni se anuncia
  éxito. Conviene editar desde una sola ventana: no hay un servicio de sincronización.

## Implementación

- `monthly-balance.js`: cálculos puros, decisiones, revisión, validación y anual.
- `index.html`: formulario, siete conceptos, gráfico, tabla y conexión al guardado.
- `backup.js`: bloque opcional, formato/almacenamiento versión 2 y restauración segura.
- Se reutiliza Chart.js. No se añaden dependencias de producción ni herramientas
  de compilación. Se declara el runtime JSX clásico compatible con React global:
  Babel actual no debe generar importaciones de módulos sin resolver en este HTML.

Para desplegar en el futuro, incluir **index.html, backup.js y monthly-balance.js
de la misma versión**. Esta rama no publica la aplicación.

## Comprobaciones y límites

Ejecutar `node --test tests/backup.test.cjs`. El mismo punto de entrada incluye
las pruebas previas y `monthly-balance.cases.cjs`: fórmulas, negativos, ceros,
Ahorro, retiradas ya registradas, traspasos, revisión, media, versiones, errores,
copias y manejadores reales de la aplicación con APIs simuladas. Resultado de
esta preparación: **164 pruebas satisfactorias, ninguna fallida u omitida**.

Se comprueban también sintaxis, compilación JSX, renderizado de servidor con
React 18 real y entrega HTTP de los archivos. El renderizado de servidor no
prueba interacciones ni almacenamiento de un navegador real. Chromium sigue
bloqueado con su sandbox activado; no se desactivan sandbox ni HTTPS.
La validación manual anterior de otras pestañas no valida esta nueva función.

## Prueba manual pendiente, sin datos reales

1. En una ventana Invitado, descarga esta rama y sírvela desde su raíz:
   `python3 -m http.server 8766 --bind 127.0.0.1` (Windows: `py -m http.server ...`).
   Abre `http://127.0.0.1:8766`. No uses tu perfil habitual ni copias personales.
2. Importa `tests/fixtures/10-balance-mensual-base.json`. En Balance selecciona
   octubre de 2026. Los campos de ahorro vacíos deben mostrar cálculos sin dato.
3. Introduce 400 en fondos y 100 en liquidez. En Revisar apuntes, identifica la
   retirada de 200, los dos movimientos internos de 100 y el Ahorro de 400.
   La retirada se excluye de ingresos; los internos se excluyen; el Ahorro solo
   se excluye de gastos después de elegir ahorro real. Resultado: ingresos 3000,
   gastos incluidos 1800, ahorro 500, gasto estimado 2500 y no desglosado 700.
   Esos dos importes de ahorro ya son netos: no restes los 200 una segunda vez.
4. Prueba Ahorro como gasto real: debe incluir sus 400, sin cambiar el apunte
   de la pestaña Gastos. Después vuelve a ahorro real. Guarda pendiente y comprueba
   que no entra en el anual; revisa y guarda otra vez: un mes y media 2500.
5. Exporta, recarga y comprueba entradas/nota/revisión. La copia preparada
   `13-balance-mensual-ejemplo.json` ofrece el mismo ejemplo para comprobar restauración.
6. Importa `14-balance-mensual-copia-anterior.json`: no contiene balances y cambia
   el ingreso a 3100. Debe conservar ahorro 400/100 y nota, recalcular gasto a 2600
   y dejar pendiente la revisión. No debe contar ese mes en el anual hasta revisarlo.
7. Importa `12-balance-mensual-invalido.json`: rechazar sin sustituir ingresos
   por 999 ni alterar balances. Prueba cancelar una restauración y comprobar que
   nada cambia. Con `11-balance-mensual-vacio.json` y confirmación explícita deben
   quedar vacíos también los balances, incluso tras recargar.
8. En emulación móvil comprueba campos, revisión, tabla desplazable y gráfico.
   Las retiradas negativas pueden probarse con datos ficticios, identificando
   cualquier retirada ya registrada y contando su efecto una única vez.

Persistencia, interacción real y móvil/iPhone permanecen pendientes hasta
ejecutar esos pasos. No introducir ni enviar datos reales para validarlos.
