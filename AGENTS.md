# Gestión Kanji: guía para trabajar en este repositorio

## Autoridad y alcance

Para interpretar este proyecto, usa este orden: **repositorio actual > `AGENTS.md` > instrucciones del proyecto > contexto histórico**. La documentación antigua explica decisiones, pero no describe necesariamente el estado presente ni autoriza a restaurar código anterior. Los asuntos abiertos del contexto son solo contexto, no un roadmap; no reabras decisiones cerradas sin una petición concreta.

Antes de cambiar algo, inspecciona los archivos actuales y sus dependencias. Reutiliza componentes, `src/api.js`, `src/utils.js` y `src/hooks/useResponsive.js` cuando corresponda. Haz cambios pequeños y localizados; no sustituyas archivos enteros con versiones antiguas o reconstruidas ni amplíes el alcance por iniciativa propia. Prioriza fiabilidad, simplicidad, mantenimiento, consumo de API y claridad visual.

## Arquitectura y datos

El frontend es React con Vite (`src/`); las rutas de servidor están en `api/` y consultan Airtable, Google Vision y OpenAI. Conserva las credenciales de esos servicios y el hash de contraseña en variables privadas del servidor. La clave de OpenAI se llama `OPENAI_API_KEY` y se usa solo en `/api/parse-expense`. No pongas secretos en variables `VITE_*`, código cliente, logs o respuestas. Las rutas privadas actuales comprueban `x-session-token`; revisa esa comprobación al tocar autenticación o endpoints. No cambies el esquema de Airtable sin una petición explícita.

El número de llamadas a Airtable importa. `src/App.jsx` carga inicialmente **Ingresos, Gastos, Alertas y Presupuestos**, carga otras tablas al entrar en su sección y guarda Tramos de Cotización en `localStorage` durante 30 días. `fetchInto` usa `Promise.all()` solo para las tablas solicitadas. Algunas pantallas actualizan el estado local con la respuesta de una escritura y otras vuelven a consultar su sección. Antes de añadir peticiones o refrescos, comprueba los datos ya disponibles y el flujo real de la pantalla; evita recargas globales innecesarias. Una lista paginada puede requerir varias llamadas a Airtable.

## Flujos y reglas de negocio

- Conserva la revisión humana antes del guardado de datos extraídos de documentos. Google Vision extrae texto; el OCR de **ingresos** se interpreta con reglas locales y el de **gastos** con `gpt-4o-mini` mediante salidas estructuradas en `/api/parse-expense`. El endpoint devuelve los diez campos existentes, con `null` para datos inciertos. La IA no guarda gastos automáticamente.
- En el Dashboard, la Hucha de Hacienda se calcula como IVA repercutido − IVA soportado + IRPF retenido a proveedores. La vista anual usa el trimestre en curso para la Hucha. El beneficio neto mostrado es base imponible facturada − IRPF retenido por clientes − base de gastos.
- Mantén separados FACTURADO y COBRADO. Verifica los cálculos en `Dashboard.jsx` y `CuotaAut.jsx` antes de alterarlos; los rendimientos no positivos se asignan al tramo inferior disponible.
- Reutiliza `findOrCreateClient` al crear facturas con clientes nuevos. La clasificación de gastos deducibles/no deducibles se deriva del `Tipo` del Gasto Fijo vinculado. En Proyectos, `Entregado` identifica trabajo terminado pendiente de facturar.

## Interfaz y comprobación

Respeta los tokens y patrones vigentes: fondo `#fafafa`, negro, amarillo `#f0e991`, lavanda `#b1b8f4`, Work Sans e iconos de `lucide-react`. Usa terminología contable clara y el sistema adaptable existente. Revisa la interfaz real antes de imponer una regla visual absoluta: aún hay emojis puntuales en el formulario de carga y el favicon.

Al terminar un cambio, ejecuta las comprobaciones **disponibles** y comunica qué verificaste y qué límites quedan. `package.json` ofrece `dev`, `build` y `preview`; actualmente no declara scripts de lint ni tests.
