# Resultados comunicados de validación manual: PR #2 y PR #3

## Procedencia y alcance

Comunicación recibida del usuario el **25 de octubre de 2026**. El usuario
informa de pruebas manuales satisfactorias en **Chrome Invitado**, utilizando
exclusivamente datos ficticios. Son resultados comunicados por el usuario,
no ejecuciones de navegador realizadas por Codex.

No se aportaron versión exacta de Chrome, sistema operativo, fecha concreta
de ejecución, hashes de las copias usadas ni registros/capturas de cada paso.
No se supone que se hayan ejecutado todos los casos de las guías.

Referencias de código observadas al recibir el informe: PR #2, `f3528ef`;
PR #3, `05aeb6d`. Esto identifica el estado consultado de las PR, no certifica
qué hashes descargó el usuario. La actualización documental posterior no
modifica `index.html`, `backup.js` ni los archivos de pruebas.

## Satisfactorio según el usuario

| Área | Resultado comunicado |
| --- | --- |
| Importación y exportación JSON | Satisfactorio en los casos realizados |
| Persistencia después de recargar | Satisfactorio en Chrome Invitado |
| Cancelación de restauraciones | Satisfactorio |
| Restauración vacía y recuperación desde copia | Satisfactorio |
| Rechazo de archivos e importes inválidos | Satisfactorio en los casos realizados |
| Archivado y reactivación | Conservación del historial satisfactoria |
| Fondos eliminados | Recuperación desde copias originales satisfactoria |
| Resúmenes históricos que necesitan revisión | Recuperación bloqueada correctamente |
| Referencias huérfanas de la versión anterior | Detección satisfactoria |
| Emulación móvil y botones del diálogo | Visualización básica y uso satisfactorios |

Esta última comprobación no equivale a una auditoría completa de accesibilidad,
uso con lector de pantalla o cobertura de todos los recorridos de teclado.

## Pendiente o sin confirmación manual específica

- **iPhone físico**: no probado. Tampoco se declara compatibilidad comprobada
  con Safari/iOS, su selector de archivos o su teclado táctil.
- **Casos restantes de las guías**: el usuario confirma que no se han probado
  todos; no se asigna un resultado global de guía completada.
- No consta confirmación manual específica de todos los conflictos entre
  copias, fechas repetidas, importes extremos, valores desconocidos y estados
  incompatibles de archivado, ni de todos los escenarios de edición posterior.
- Fallos reales de cuota/permisos de almacenamiento, cambios entre pestañas
  durante una confirmación y lecturas canceladas: cubiertos por simulaciones,
  sin confirmación manual específica comunicada.
- Alternancia completa entre versiones y vuelta atrás: no se da por validada
  por haber detectado referencias huérfanas de la versión anterior.
- Persistencia después de cerrar y reabrir una sesión normal: no queda probada
  por una recarga en Invitado. Cerrar todas sus ventanas elimina sus datos.
- Publicación final en GitHub Pages y comprobación posterior: no realizadas
  con estas mejoras; no se ha modificado main ni provocado un despliegue.

Estas menciones no significan que los casos hayan fallado; indican límites
de la evidencia disponible. Los detalles adicionales pueden añadirse si el
usuario los comunica, sin solicitar archivos financieros personales.

## Evidencia automatizada y revisión técnica

El comando del proyecto es `node --test tests/backup.test.cjs`. La rama conjunta
incluye 113 pruebas con datos ficticios, funciones reales y APIs/almacenamiento
simulados. Se mantiene la distinción respecto a las comprobaciones manuales.

Al revisar las PR, GitHub indicó que ambas eran integrables sin conflictos con
sus bases actuales. No había resultados de checks/estados CI publicados en los
commits consultados; esto no se presenta como una aprobación de CI.

El orden de dependencia es `main → PR #2 → PR #3`. La rama de la PR #3 incluye
ambas mejoras. Las PR siguen abiertas y en borrador, sin fusión automática.

## Riesgos de transición y publicación

- La versión anterior y la PR #2 aislada no implementan el archivado y pueden
  permitir una eliminación destructiva. No editar datos archivados con ellas.
- Las claves antiguas y la clave consolidada no se sincronizan. Volver al código
  anterior no revierte los datos fielmente y su restauración vacía conserva el
  defecto documentado. Hace falta un plan de vuelta atrás, no solo un revert.
- Las referencias sin registro original o con conflictos siguen necesitando
  intervención; la aplicación no debe resolverlas inventando datos.
- **GitHub Pages publica desde la raíz de main**, según la configuración
  consultada. Dos fusiones separadas a main podrían exponer primero la PR #2
  sin el archivado. Se recomienda una única actualización pública con ambas
  mejoras, respetando el orden de revisión #2 y después #3.

El [plan de publicación](PUBLICACION-SEGURA.md) explica la integración propuesta.
No autoriza fusiones, cambios de configuración, uso de datos reales ni publicación.
