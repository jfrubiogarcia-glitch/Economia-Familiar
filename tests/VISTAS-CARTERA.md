# Vistas de cartera

- Fondos de la fotografía, fondos del desglose y columnas del histórico tienen preferencias independientes: visibilidad y orden con flechas arriba/abajo. Se guardan por navegador/dispositivo en `eco_portfolio_views_v1`, fuera del JSON financiero. Restablecer una vista no cambia fondos, fotografías ni balances.
- Ocultar un fondo no lo archiva, elimina ni excluye de los totales. Guardar una fotografía conserva todos los valores del estado, incluidos los de fondos ocultos. El archivado financiero existente mantiene sus condiciones.
- Los tres diagramas usan la misma fotografía detallada del año seleccionado, cuya fecha se muestra. Su denominador es fondos/planes más liquidez bancaria, contada una vez. Se incluyen todos los fondos con valor conocido aunque estén ocultos o archivados. Una valoración activa ausente, liquidez desconocida o importes negativos impiden mostrar porcentajes parciales como completos.
- Por instrucción del usuario, renta fija y mixta se presentan juntas como Renta fija (negro). Esta agrupación de presentación no altera los tipos originales ni calcula la exposición real de los mixtos. Los planes mantienen la agrupación histórica de la aplicación junto con RV.
- Se retira la revalorización de la tabla de posiciones. La ganancia/pérdida por intervalo sigue disponible en el histórico, como columna ocultable, con su fiabilidad.
- El gráfico de barras usa exclusivamente intervalos entre fotografías, a partir de junio de 2026. Es independiente del selector mensual/anual del histórico. Compara entradas externas netas a cartera con cambio de saldo total, incluida liquidez. Las entradas estimadas mantienen el criterio anterior de diferencias del capital registrado: su fiabilidad se consulta en el histórico. No se inventan fotografías para semanas sin registro.
- Gráfica de saldos: RF negro, liquidez gris, cartera y patrimonio azul (cartera discontinua), capital registrado naranja y RV morado oscuro. Los puntos y leyendas identifican la serie; los tramos ascendentes son verdes y los descendentes rojos. Tramos planos conservan el color de la serie; los huecos no se unen. El filtro temporal incluye todo el mes final.

Validación: 189 pruebas Node con datos ficticios y git diff --check. Chrome mediante sites-preview: tres repartos con euros y porcentajes, ocultación y orden independientes, guardado de fotografía con un fondo oculto sin pérdida de sus valores, persistencia tras recarga de orden/ocultación de fondos y columnas, ausencia de revalorización en posiciones, y renderizado de las seis series de saldos. Sin errores de la aplicación en consola. Safari/iPhone real no disponibles para esta comprobación.

## Ocultaciones persistentes y barras semanales

Las preferencias guardadas incluyen también `fundChart` y `managerChart`, independientes de `photo`, `positions` y `columns`. Una copia local anterior conserva sus preferencias y obtiene los dos nuevos grupos vacíos. Los fondos se identifican por su ID original y las gestoras por su nombre de agrupación; nombres repetidos de fondos no comparten accidentalmente selección.

Los elementos desmarcados no figuran en la tabla de la tarta ni como sectores individuales hasta volver a marcarlos. Para conservar el peso real sobre el patrimonio total y no recalcular porcentajes sobre una selección parcial, los importes ocultos positivos se agrupan visualmente en un único sector gris «Ocultos». No cambia ningún saldo ni denominador. Los colores de los elementos visibles se mantienen al ocultar otros.

Las entradas netas son naranjas. El cambio del saldo total es verde si es positivo y rojo si es negativo; cero o ausencia de valor usan gris neutro.

Validación posterior: 191 pruebas Node y git diff --check. Chrome con datos ficticios: ocultar fondo y gestora, recargar y comprobar persistencia sin afectar a las ocultaciones anteriores de fotografía/desglose, volver a marcar un fondo, y comprobación visual de barras positivas verdes, negativas rojas y entradas naranjas. Sin validación en un iPhone real.

## Periodos y sumas de subidas/bajadas

El selector de la sección de barras permite Semanal, Mensual, Anual y Total y es independiente del selector del histórico. Se agrupan los intervalos observados cuyo inicio y cierre son desde junio de 2026. Total suma esos intervalos, sin incorporar el capital inicial; las fechas reales del tramo se muestran encima de las gráficas. No se interpolan cierres naturales ni se generan semanas ausentes.

Una segunda gráfica de barras separa la suma de cambios positivos (verde) de la suma de cambios negativos (rojo). Se suman los intervalos originales antes de agrupar: un mes +500/−300 conserva ambas sumas y un neto +200. No se suman solo los netos mensuales para obtener los totales de subidas y bajadas. Un intervalo desconocido deja desconocido el acumulado correspondiente.

Validación ampliada: 192 pruebas Node; comprobados límites temporales, grupos por mes y año, acumulado total, subidas y bajadas separadas, ausencia de datos e inmutabilidad de fotografías. Chrome: selector mensual/anual/total y representación visual en Total con +60/−10 y cambio neto +50, usando datos ficticios. Publicación todavía pendiente por denegación anterior de la operación de GitHub.

## Ajuste de gestora y retirada de gráfica

Ábaco y Ábaco Capital se agrupan como «Ábaco» únicamente en el reparto por gestora, reconociendo mayúsculas, acentos y espacios. Se conservan las denominaciones de los registros originales. Las preferencias de orden/ocultación de ambas etiquetas se trasladan a la agrupación única; si alguna estaba oculta se conserva esa ocultación hasta volver a marcar Ábaco.

Por solicitud del usuario se retira la segunda gráfica «Suma de subidas y bajadas del saldo total». Permanece la gráfica principal de entradas netas y cambios de saldo y sus cuatro periodos. Los cálculos y registros históricos no se eliminan.

Validación: 194 pruebas Node y git diff --check. Chrome con datos ficticios: Ábaco y Ábaco Capital suman 850 € en una sola gestora; la gráfica duplicada no está y el selector principal sigue disponible. No probado en iPhone real.
