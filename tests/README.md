# Pruebas de restauración JSON

Desde la raíz, con Node.js 18 o posterior y sin instalar dependencias:

```sh
node --test tests/backup.test.cjs
```

La suite usa exclusivamente datos ficticios. Ejecuta la validación y la
persistencia reales de `backup.js`, además de los manejadores de importación,
confirmación, descarga y guardado de `index.html`. Para estos últimos sustituye
los hooks de React, FileReader y localStorage por objetos de prueba controlados.
No es una prueba de navegador ni comprueba la apariencia de la aplicación.

Se comprueban copias vacías y parciales, formatos anteriores con fotografías o
resúmenes patrimoniales, registros incompletos, números inválidos, fechas,
duplicados, referencias a fondos inexistentes, fallos de lectura y guardado,
cambios concurrentes durante la confirmación y descarga de la copia previa.

## Compatibilidad y almacenamiento

- Los JSON exportados mantienen los cuatro bloques anteriores y el bloque
  `tabla2EvolucionPatrimonial`. No se cambian fórmulas ni clasificaciones.
- Un bloque ausente se conserva; uno presente vacío se sustituye por `[]`.
  La tabla patrimonial explícita sustituye el conjunto de fotografías, como
  antes, pero ahora también cuando está vacía.
- Se admiten fotografías detalladas, `table2`, `summary` y el alias `summary.ing`.
  No se recalculan ni corrigen cifras manuales o históricas al validar.
- Si una copia contiene referencias rotas u otros registros inválidos se
  rechaza completa, sin reparar ni eliminar datos silenciosamente.
  Si el historial ya guardado contiene referencias huérfanas por el antiguo
  borrado de fondos, la exportación conserva los registros originales y avisa
  de que necesitarán revisión antes de restaurarlos. Esta fase no repara fondos
  ni reclasifica el historial.
- La lectura de los datos antiguos no escribe ni migra nada automáticamente.
  El primer guardado correcto escribe todo el conjunto en una sola clave:
  `eco_public_blank_v4_dataset`, con `storageVersion: 1`.
- El guardado de una única clave utiliza la garantía de atomicidad de
  `localStorage.setItem`: si falla, su valor anterior permanece intacto.
  Las cuatro claves antiguas se conservan sin cambios y no se sincronizan.
  No vuelvas a una versión antigua esperando que lea los cambios nuevos:
  exporta una copia JSON desde la versión nueva para trasladarlos.
- Si el almacenamiento no puede leerse, no se sobrescribe con listas vacías.
  Se ofrece una descarga de los valores originales para recuperación. Ese
  archivo conserva el contenido bruto y necesita revisión si está dañado;
  no se presenta como una copia lista para importar. En ese modo solo se
  aceptan restauraciones completas, para no perder bloques desconocidos.
- Solicitar una descarga no demuestra que el navegador la haya guardado.
  La interfaz pide comprobarlo o elegir expresamente continuar sin copia.

## Comprobación manual pendiente en un navegador seguro

La [guía mínima con archivos preparados](VALIDACION-MANUAL.md) explica cómo
usar un perfil Invitado y dos copias locales sin tocar datos reales. Incluye
la alternancia entre versiones, el historial con fondos eliminados y la
presentación móvil mediante emulación. Los archivos están en `fixtures/`.
Esa guía todavía no se ha ejecutado en un navegador real por Codex.

Usa un perfil nuevo, sin datos personales, y sirve el repositorio con:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

1. Introduce registros ficticios y expórtalos. Comprueba que el JSON puede
   restaurarse después de recargar la página.
2. Importa una copia vacía, cancela y comprueba que no cambia ningún dato.
   Repite, descarga la copia previa, confirma que está guardada y restaura.
   Comprueba que las cuatro listas quedan vacías también después de recargar.
3. Importa un archivo con un ingreso correcto y una fila patrimonial nula.
   Debe rechazarse completo, sin cambiar los registros anteriores.
4. Comprueba fechas inválidas, importes entre comillas y referencias rotas.
5. Con datos ficticios, provoca un fallo de almacenamiento y comprueba el
   aviso persistente, la conservación de los datos y el reintento posterior.
6. Comprueba el foco del diálogo, su cancelación con Escape y la presentación
   en escritorio y móvil.

No desactives HTTPS ni el aislamiento del navegador para ejecutar estas pruebas.
Documenta cualquier bloqueo del entorno y no presentes esta lista como ejecutada
si no se ha podido comprobar.
