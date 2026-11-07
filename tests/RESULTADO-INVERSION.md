# Resultado de inversión por intervalo

La cartera comprende fondos y planes, sin liquidez. Resultado EUR = valor final − valor inicial − entradas externas + salidas externas. No se anualiza ni se presenta este resultado como rentabilidad porcentual. Los porcentajes de saldo existentes se identifican expresamente como variación del saldo.

Las diferencias del capital acumulado son estimaciones, no operaciones conciliadas. Los traspasos internos, cambios de coste fiscal y correcciones pueden invalidarlas. Se conserva el histórico original; no se convierten retrospectivamente en movimientos ni se añaden abonos periódicos supuestos.

Cada fotografía puede guardar `investmentFlow: {fromDate, contributions, withdrawals}`. Los importes son EUR no negativos, con hasta dos decimales y cero explícito. La confirmación corresponde al intervalo (inicio excluido, cierre incluido). Si cambia la fotografía anterior, se deja de usar la confirmación y se requiere revisar. Los flujos se guardan en snapshots y viajan en las copias JSON. No se necesita un bloque nuevo. Versiones anteriores no son editores seguros de estas confirmaciones.

Mensual/anual agregan todos los intervalos de sus fotografías, con fechas reales visibles. Un intervalo sin información hace desconocido el resultado agregado. No se asumen cierres de calendario. Un periodo sin fotografía no se interpola. El periodo actual puede estar incompleto.

El balance familiar mantiene sus fórmulas y sus importes manuales. Entrada en cartera no implica ahorro nuevo: puede proceder de liquidez preexistente. No se suman los importes de estas dos vistas ni se sobrescribe el balance a partir del histórico. No se modifica `monthly-balance.js`. La corrección independiente del formulario del balance sigue en PR #5.

Validación: 180 pruebas Node (restauración, histórico, balance y resultado); compilación JSX con Babel y git diff --check. Datos de pruebas exclusivamente ficticios. El JSON personal solo se analizó en lectura fuera del repositorio y no se incluye en cambios ni fixtures. Pendiente verificación visual y persistencia real tras recarga: Chromium no arranca por restricciones del entorno. Mantener la propuesta en borrador, sin desplegar.
