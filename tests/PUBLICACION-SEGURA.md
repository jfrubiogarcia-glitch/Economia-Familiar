# Preparación de integración y publicación

**Integración conjunta preparada, sin ejecutar la publicación.** Con autorización
del usuario se ha cambiado la base de #3 a main para que incluya ambas mejoras.
Las dos PR siguen en borrador. No se ha fusionado ninguna ni modificado main.
El [informe de la candidata](CANDIDATA-PUBLICACION.md) recoge pruebas, archivos
y explicación de la conservación de datos.

## Dependencias comprobadas

| PR | Rama | Base actual | Papel |
| --- | --- | --- | --- |
| #2 | `fix/safe-json-restore` | `main` | Restauración y almacenamiento íntegros |
| #3 | `fix/preserve-fund-history` | `main` | Paquete conjunto: restauración, archivado y recuperación; incluye #2 |

GitHub informa de ausencia de conflictos con las bases actuales. La revisión
de ascendencia confirma que el código de #2 está incluido en #3. Esto permite
validar la versión conjunta. No implica aprobación ni cobertura de todos los
casos funcionales. No hay checks CI publicados en las referencias consultadas.

## Punto importante: main también es el origen de publicación

La configuración consultada de GitHub Pages es `build_type: legacy`, con
origen en `main`, ruta `/`, y estado `built`. No se ha cambiado esa configuración
ni solicitado un nuevo build. Actualizar main puede activar la publicación.

Por tanto, **no se recomienda fusionar #2 a main y dejar #3 para otro momento**:
podría publicarse una versión intermedia que aún permite eliminar fondos.

## Secuencia recomendada tras recibir autorización

1. Revisar y aprobar primero el alcance de #2 y después el cambio adicional
   de #3. Conservar ambas en borrador mientras se decide qué pruebas pendientes
   son necesarias antes de publicar. Si se anuncia soporte de iPhone, probar
   un dispositivo físico antes de darlo por compatible.
2. Identificar la versión conjunta candidata y conservar sus referencias.
   Ejecutar las pruebas automatizadas contra esa referencia. Si solo cambió
   documentación, no presentar eso como una nueva validación funcional.
3. **Preparación realizada:** #3 apunta ahora a main y contiene #2. El diff
   ampliado incluye ambos cambios ya revisados. Esto solo prepara la PR;
   no fusiona código ni activa Pages. La integración sigue pendiente de autorización.
4. Se vuelven a comprobar conflictos, archivos incluidos, dependencias y pruebas
   tras ese cambio de base. Si main o la candidata cambian antes de aprobar,
   revisar otra vez esos resultados. No incorporar cambios ajenos a ambas mejoras.
5. Tras autorización final, integrar ese paquete una sola vez a main. Un commit
   de fusión conserva la ascendencia y facilita comprobar que los commits de
   #2 también quedaron incluidos. Comprobar el estado de #2 después; no asumir
   de antemano que GitHub la marcará como incorporada indirectamente. Si necesita
   cerrarse por integración mediante #3, dejar trazabilidad y hacerlo solo con
   autorización. No fusionar de nuevo #2 por duplicado.

Si se exige fusionar cada PR individualmente, otra opción es hacerlo en ese
orden en una rama de preparación que no publique Pages, y llevar después el
resultado conjunto a main mediante una PR final. Eso también requiere aprobación;
no se crean ramas o PR adicionales de publicación en este trabajo.

## Precauciones para la puesta en uso

- Antes de una transición con datos reales, su titular debe conservar una copia
  local privada y recuperable y revisar cualquier inconsistencia. Este trabajo
  no lee, importa ni modifica esos datos, ni autoriza enviarlos al chat o GitHub.
- Detener la edición en pestañas/versiones anteriores durante la transición.
  Elegir una única versión de uso; las dos formas de almacenamiento no se
  sincronizan automáticamente.
- Publicar **index.html y backup.js de la misma versión**, conservando su ruta
  relativa. Actualizar solo el HTML deja incompleta la aplicación. Verificar
  también que las bibliotecas externas cargan por HTTPS sin ignorar certificados.
- Una vez completado el build de Pages, realizar una comprobación breve en
  Chrome Invitado sobre la dirección publicada, solo con datos ficticios:
  carga, importación, exportación, archivado, recuperación y recarga. Esto no
  modifica los datos de los perfiles habituales.
- Cerrar Invitado elimina sus datos: guardar las descargas ficticias necesarias
  antes de cerrarlo. No usar esa sesión como almacén de datos personales.

## Vuelta atrás

Conservar una copia del código y copias de datos verificadas antes de publicar.
Un retroceso del código no restaura automáticamente los datos: las versiones
antiguas ignoran `archived` y pueden leer claves desactualizadas. Antes de
cualquier vuelta atrás hay que detener la edición y revisar cómo recuperar
los datos sin perder históricos. No usar la versión anterior para eliminar
fondos ni asumir que su importación vacía reproduce el estado de la nueva.

## Condición de cierre

Registrar los [resultados manuales comunicados](VALIDACION-CHROME-INVITADO.md),
resolver o aceptar expresamente los límites pendientes, aprobar el paquete y
su publicación y comprobar el resultado publicado con datos ficticios. Hasta
entonces: ninguna fusión, ninguna modificación de main y ninguna declaración
de validación completa de iPhone o de toda la guía.
