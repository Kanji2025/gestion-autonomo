# Gestión Kanji: contexto técnico e histórico

Este documento adapta el borrador histórico al repositorio inspeccionado el **17 de septiembre de 2026**. «Comprobado» significa visible en el código de esta copia, no verificado en producción, en Airtable ni en las cuentas de proveedores. «Histórico / no verificado» conserva decisiones, fechas o cifras del relato original sin presentarlas como estado actual.

**Jerarquía:** repositorio actual > `AGENTS.md` > instrucciones del proyecto > este contexto histórico. Los asuntos abiertos aquí registrados no son un roadmap ni autorizan cambios. Las decisiones cerradas no se reabren por aparecer en estas notas.

## Estado comprobado en el código

| Área | Evidencia en este repositorio |
| --- | --- |
| Estructura | React 18 y Vite 5 en `package.json`; interfaz modular en `src/components/`, estado y navegación en `src/App.jsx`, utilidades en `src/utils.js` y adaptación en `src/hooks/useResponsive.js`. |
| Servidor y datos | `api/airtable.js` hace de proxy para listar, crear, actualizar y borrar registros de Airtable. Las operaciones de lista recorren la paginación. `src/api.js` centraliza las llamadas del navegador. Las cuatro rutas de `api/` usan variables de entorno del servidor. |
| Autenticación | `api/auth.js` compara la contraseña con `bcryptjs` y devuelve `SESSION_SECRET` como token de sesión al navegador. `src/api.js` lo guarda en `localStorage` y lo envía como `x-session-token`; `api/airtable.js`, `api/ocr.js` y `api/parse-expense.js` comprueban ese encabezado. Es una descripción del mecanismo actual, no una auditoría de seguridad. |
| Carga de Airtable | `src/App.jsx` carga al inicio **Ingresos, Gastos, Alertas y Presupuestos**; Clientes, Gastos Fijos y Proyectos se cargan al entrar en las secciones que los requieren. Tramos de Cotización se cachea 30 días en `localStorage`. `fetchInto` usa `Promise.all()` para el conjunto solicitado. Hay actualización local en Facturas y Clientes; Gastos, Gastos Fijos, Presupuestos y Proyectos contienen operaciones que recargan tablas de su sección. |
| OCR | `src/components/NuevoForm.jsx` convierte la primera página de un PDF en imagen con `pdf.js` cargado desde CDN, o lee una imagen; `api/ocr.js` solicita texto a Google Vision. Para ingresos, `NuevoForm.jsx` interpreta el texto mediante reglas locales. Para gastos, `api/parse-expense.js` llama a OpenAI con `gpt-4o-mini` y un esquema JSON estricto de diez campos. Ambos resultados pasan al formulario y requieren pulsar guardar. |
| Módulos | Existen Dashboard, Facturas, Clientes, Gastos, Gastos Fijos, Presupuestos, Proyectos, Simulador, Cuota de Autónomos y Alertas, incluida campana y popup. |
| Interfaz | `src/utils.js` define `#fafafa`, negro, amarillo `#f0e991`, lavanda `#b1b8f4` y Work Sans. Los iconos generales vienen de `lucide-react`; quedan emojis puntuales en `NuevoForm.jsx` y `index.html`. |
| Comprobaciones | `package.json` solo define `dev`, `build` y `preview`. Esta copia no incluye scripts de lint o tests, archivo de bloqueo, `vercel.json` ni definición local del esquema de Airtable. |

### Cálculos y comportamientos comprobados

- `Dashboard.jsx` distingue base **facturada** de base **cobrada** según el estado de la factura. Calcula beneficio neto como base facturada − IRPF retenido por clientes − base de gastos.
- La **Hucha de Hacienda** en el Dashboard es IVA repercutido − IVA soportado + IRPF retenido en gastos. Cuando no se selecciona mes o trimestre, usa el trimestre en curso; no suma los cuatro trimestres de la vista anual. El bloque de salario mensual calcula el beneficio de un mes concreto.
- `CuotaAut.jsx` excluye de su cálculo los gastos enlazados a Gastos Fijos de `Tipo` «No deducible» y asigna rendimientos no positivos al primer tramo disponible. `Dashboard.jsx` tiene su propio cálculo de tramo; cualquier cambio debe revisar ambos.
- `src/api.js` implementa `findOrCreateClient`, usado desde el formulario de ingresos. La creación puede requerir una consulta y, si falta el cliente, otra escritura; por tanto no equivale siempre a una sola llamada.
- Presupuestos usa los estados `Contactado`, `Presupuestado`, `Ganado`, `Perdido` y `Sin respuesta`, con origen y canal y una gráfica por canal. Proyectos usa `Sin empezar`, `En proceso`, `Entregado` y `Facturado`; `Entregado` alimenta el indicador de pendiente de facturar.

### Interpretación actual de gastos

`/api/parse-expense` conserva las comprobaciones de método `POST`, sesión `x-session-token`, texto OCR de al menos diez caracteres y límite de 8.000 caracteres. Lee `OPENAI_API_KEY` únicamente en el servidor y llama a la API Responses con `store: false` y salida estructurada estricta. La respuesta al frontend mantiene `{ data, usage }`, donde `data` contiene `concepto`, `proveedor`, `cif`, `fecha`, `base`, `iva`, `irpf`, `total`, `tipo_sugerido` y `periodicidad_sugerida`; los campos inciertos pueden ser `null`. `NuevoForm.jsx` propone los datos en controles editables, deja vacía la fecha si no se extrajo y solo escribe el gasto cuando la usuaria pulsa guardar. El código ya no registra en la consola el texto OCR ni los datos extraídos en ese formulario.

## Decisiones y relato históricos, no verificados aquí

El borrador sitúa el comienzo en abril de 2026 con tablas de Clientes, Ingresos, Gastos y Resumen Trimestral ya creadas en Airtable. Cuenta que se consideraron Softr y Glide y se eligió una aplicación propia para reducir límites y mantenimiento. También atribuye el despliegue a Vercel y al subdominio `gestion.kanjiestudio.es`, con DNS en Hostinger. La estructura `api/` es compatible con funciones serverless, pero este repositorio no acredita por sí solo el despliegue, DNS, plan ni esquema real de Airtable.

La primera versión descrita incluía login, Dashboard, Clientes, Gastos, Simulador y Cuota de Autónomos; después se añadieron Tramos de Cotización, Gastos Fijos, alertas, Presupuestos y Proyectos. El relato explica que el objetivo era gestionar el trabajo diario sin entrar habitualmente en Airtable. Las correcciones históricas de Hucha, beneficio neto y tramos tienen equivalentes visibles en el código actual, detallados arriba.

El borrador relata una etapa inicial con credenciales en variables `VITE_*`, seguida por su traslado a las rutas `api/airtable.js`, `api/ocr.js`, `api/parse-expense.js` y `api/auth.js`. Esa evolución no se puede demostrar solo con esta copia. Sí se comprueba que las claves actuales de Airtable, Vision y OpenAI se leen en el servidor; la autenticación entrega un token de sesión al cliente. La prueba histórica de respuesta `401` sin token no se ha repetido contra un despliegue.

La interpretación de gastos usó históricamente **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) a través de Anthropic. El borrador registra la decisión de pasar de regex de proveedores a un modelo que devolviera JSON y dejara la revisión a la usuaria. En la implementación actual OpenAI ocupa esa capa; Claude permanece aquí como antecedente, no como dependencia activa.

También se describe un rediseño fallido que sustituyó `App.jsx` por un archivo antiguo y monolítico de 1.715 líneas y se recuperó desde GitHub. El incidente es una razón histórica para inspeccionar los archivos vigentes y preservar la modularidad; el número de líneas y la secuencia de recuperación no se verifican aquí. La guía visual histórica favorecía minimalismo cálido, iconos de línea y lenguaje contable claro, y descartaba kanban avanzado, probabilidad ponderada y correos automáticos en el CRM. La identidad principal coincide con los tokens actuales, pero la prohibición absoluta de emojis no describe todos los elementos presentes.

### Cifras históricas que requieren comprobación externa

| Afirmación del borrador | Estado |
| --- | --- |
| Plan de Airtable de unas 1.000 llamadas mensuales; aviso del 80 %, 66 llamadas restantes y seis días hasta el reinicio. | Histórico; no hay datos de cuenta ni telemetría en el repositorio. |
| Antes, una recarga pedía ocho tablas y una acción costaba 9–11 llamadas; consumo estimado de 1.500 llamadas al mes. Después, 250–350 al mes y aproximadamente una llamada por escritura. | Histórico; el código actual todavía tiene recargas por sección y listas paginadas, así que esas cifras no describen una garantía vigente. |
| Google Vision ofrecía 1.000 llamadas mensuales gratuitas; Anthropic costaba alrededor de 1–2 € al año o 0,15 € al mes; Vercel y Airtable costaban 0 €. | Estimaciones y condiciones históricas, sin validación de tarifas o facturación actuales. |
| El parser previo por reglas acertaba un 60–70 % en base e IVA, cerca del 80 % en fecha y alrededor del 50 % en CIF. | Estimaciones históricas sin conjunto de evaluación ni pruebas en esta copia. |

## Alcance de producto registrado

El borrador enumera como necesidades originales OCR, CRM, beneficio neto, IVA en tiempo real, prorrateo, tendencias, objetivo de salario, Simulador, Hucha y distinción entre flujo de caja y beneficio. Hay componentes o cálculos correspondientes en el repositorio; su exactitud con datos reales no se deduce de esta inspección. El ranking de morosidad figura como **retirado** del alcance histórico, no como tarea pendiente.

Quedaron anotados, sin autorización implícita para ejecutarlos: un posible filtro temporal de la gráfica por canal (y eventual campo `Fecha cierre`), un usuario de solo lectura, ingresos recurrentes y el citado ranking de morosidad. El CRM ligero y los cuatro estados de Proyectos son decisiones recogidas en el relato y reflejadas en el código. Cualquier cambio futuro parte de una solicitud concreta y de los archivos vigentes, sin convertir estas notas en un plan de trabajo.
