# Integración conjunta preparada, sin publicar

Preparación: 25 de octubre de 2026. La PR #3 tiene ahora como base `main` y
contiene las mejoras de las PR #2 y #3. Ambas permanecen abiertas y en borrador.
No se ha fusionado ninguna PR, modificado main ni solicitado un build de Pages.

## Alcance y referencias

- Main consultada: `1e37777f73a52aa2d640fa0699d66a23e46f9ec0`.
- Restauración segura incluida: `f3528efeb77e4e52c5076ea21b91df51c50e3ef1`.
- Código conjunto de archivado y recuperación: `05aeb6d725658d7e6b742097e29bf6c414a1f3a2`.
- Actualizaciones posteriores a ese código: documentación e instrucciones.
  Esta preparación tampoco modifica el código ni las pruebas.
- La referencia final exacta del paquete es el commit de cabecera de la PR #3,
  identificado en su descripción después de guardar esta documentación.

El diff conjunto respecto a main incluye `index.html`, el módulo `backup.js`,
AGENTS.md, pruebas, archivos JSON ficticios y documentación. README.md permanece
intacto. No se incluyen copias reales, credenciales ni dependencias nuevas.
La PR #2 queda como revisión previa incluida, no como un despliegue intermedio.

## Comprobaciones de preparación

- `node --test tests/backup.test.cjs`: **113 pruebas superadas**, sin fallos,
  omisiones ni pruebas pendientes dentro de la suite. Solo datos ficticios y
  APIs/almacenamiento simulados.
- `node --check backup.js` y compilación completa del JSX mediante Babel correctos.
- Comparación exacta con main de **14 bloques financieros** y de las opciones
  de clasificación. Se comprobaron formatos/parseo, conceptos, totales y gráficas
  de ingresos y gastos, disponible mensual, revalorizaciones, pesos, históricos,
  comparaciones temporales y cálculos exportados. No se cambiaron sus fórmulas
  ni categorías; el estado de archivado es administrativo.
- Revisión de archivos y dependencias e integración simulada sin actualizar
  ninguna rama: el resultado debe coincidir con el árbol completo de la candidata.
- La validación en Chrome Invitado es la comunicada por el usuario en el
  [informe manual](VALIDACION-CHROME-INVITADO.md), no una ejecución de Codex.

Huellas SHA-256 de los archivos de ejecución, sin cambios en esta preparación:

| Archivo | SHA-256 |
| --- | --- |
| index.html | `72480666a28f10fa77fd1ac71f7886788092f6f1b9bfe796aa5c4fc0a10fb49c` |
| backup.js | `30c59b84e4da6f388c426629722a3fe3a799cc4f6009aab06dc0460298909b5a` |

## Cómo se cargarán los datos actuales

Los datos no están en el repositorio ni en el servidor de Pages: se leen del
almacenamiento local del navegador. La nueva versión debe abrirse en el mismo
dispositivo, navegador, perfil y origen que la aplicación usada hasta ahora.
Cambiar de ordenador, perfil, navegador, protocolo, dominio o puerto cambia
el almacenamiento disponible. Dos rutas del mismo origen no lo aíslan.

| Situación al abrir | Comportamiento del código |
| --- | --- |
| Solo existen las cuatro claves antiguas | Lee ingresos, gastos, fondos y fotografías de `eco_public_blank_v4_*` |
| Existe `eco_public_blank_v4_dataset` | Da prioridad a ese registro consolidado; no lo combina con claves antiguas aunque estas se hayan editado después |
| No existen esas claves en ese perfil/origen | Presenta un conjunto vacío; no busca automáticamente archivos del disco |
| El almacenamiento no puede leerse o tiene estructura inválida | Muestra un error y un modo de recuperación; no lo sobrescribe con listas vacías |
| Hay fotografías con referencias huérfanas | Conserva el contenido, avisa y suspende cálculos de inversión incompletos; la recuperación exige revisión y confirmación |

**Abrir la aplicación no borra ni migra automáticamente los datos.** El primer
guardado correcto escribe el conjunto completo en la clave consolidada mediante
una sola operación. Las cuatro claves antiguas permanecen intactas y dejan de
ser la fuente principal. Los fallos de esa escritura no deben cambiar el valor
anterior; la interfaz informa del error sin anunciar un guardado correcto.

Conservar también las claves anteriores ocupa más espacio. Una cuota insuficiente
puede impedir guardar: no borres almacenamiento a ciegas para resolverlo.
La conservación de datos sigue dependiendo del perfil del navegador; no hay
sincronización entre dispositivos ni copia automática en la nube.

## Uso de la copia privada que ya ha guardado el usuario

El usuario ha comunicado que dispone de una copia JSON real actualizada en un
lugar privado. Codex no la ha abierto, validado ni añadido al repositorio; esta
afirmación no equivale a demostrar que todos sus registros serán aceptados.

Ese archivo **no se importa solo al publicar o abrir la nueva versión**.
Si los datos locales se cargan correctamente, no hay que restaurarlo por rutina.
Si no aparecen, primero revisar dirección y perfil; no asumir que se borraron ni
introducir datos nuevos sobre un estado inesperado. Restaurar la copia privada
debe ser una decisión consciente, revisando los bloques que se sustituirán.

La lectura del archivo JSON se realiza en el navegador; el código de restauración
no lo envía a GitHub ni lo añade al repositorio. Si detecta importes inválidos,
referencias ausentes o resúmenes conflictivos, detenerse y conservar las copias:
no forzar la importación, fabricar fondos ni corregir cifras por suposición.

## Precauciones al pasar a la nueva versión, después de autorizar la publicación

1. Conservar la copia privada original y otra copia posterior si la transición
   se verifica; no sobrescribir la única copia disponible.
2. Cerrar las pestañas antiguas y no volver a editar con la versión anterior
   o la PR #2 aislada. Las claves antiguas no se sincronizan con la nueva y esas
   versiones ignoran el archivado.
3. Comprobar la publicación primero en Invitado con datos ficticios. No borrar
   los datos del sitio del perfil habitual ni seleccionar «restauración vacía»
   como forma de actualizar el código.
4. En el perfil habitual, abrir la dirección de siempre y comprobar ingresos,
   gastos, número de fotografías y algunas fechas/valores conocidos antes de
   editar. Una recarga fuerte del código no requiere borrar el almacenamiento.
5. Si aparecen datos de pruebas, antiguos o incompletos, no guardar cambios:
   puede haberse cargado otra clave/origen/perfil. Revisar antes de restaurar.
6. Usar un perfil normal para datos personales. Invitado sirve para pruebas,
   pero elimina su almacenamiento al cerrar todas sus ventanas.

## Recomendación y límites pendientes

Se recomienda autorizar una **publicación conjunta para el alcance probado en
Chrome**, con la comprobación posterior prevista en el plan y sin anunciar una
validación completa de iPhone. Si iPhone es el dispositivo de uso previsto, probar
primero su selector de archivos, exportación y recarga en un dispositivo físico.

Siguen pendientes los casos no confirmados de la guía, fallos reales de cuota/
permisos y persistencia entre sesiones normales. Las pruebas simuladas cubren
esos mecanismos, pero no sustituyen su comprobación en cada dispositivo.
Las copias sin originales suficientes o con conflictos necesitan intervención.
La vuelta al código anterior no es una reversión segura de datos.

La recomendación no es una autorización: no se ha fusionado ni publicado nada.
El [plan seguro](PUBLICACION-SEGURA.md) establece una sola integración a main,
seguida de la comprobación de Pages con datos ficticios. Nunca desplegar solo
`index.html` sin el `backup.js` de la misma candidata.
