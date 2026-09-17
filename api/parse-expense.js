// /api/parse-expense.js
// Interpreta el texto OCR de un gasto con OpenAI; el guardado requiere revisión en el formulario.

const MODEL = "gpt-4o-mini";

const EXPENSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    concepto: { type: ["string", "null"] },
    proveedor: { type: ["string", "null"] },
    cif: { type: ["string", "null"] },
    fecha: { type: ["string", "null"] },
    base: { type: ["number", "null"] },
    iva: { type: ["number", "null"] },
    irpf: { type: ["number", "null"] },
    total: { type: ["number", "null"] },
    tipo_sugerido: { type: ["string", "null"], enum: ["Fijo", "Variable", "Impuesto", null] },
    periodicidad_sugerida: { type: ["string", "null"], enum: ["Mensual", "Trimestral", "Anual", "Puntual", null] }
  },
  required: ["concepto", "proveedor", "cif", "fecha", "base", "iva", "irpf", "total", "tipo_sugerido", "periodicidad_sugerida"]
};

const SYSTEM_PROMPT = `Eres un asistente experto en contabilidad española para autónomos. Tu tarea es extraer datos estructurados del texto OCR de un ticket o factura de gasto.

REGLAS:
1. Si un campo no está presente o no puedes determinarlo con seguridad, usa null. No inventes datos.
2. Los importes deben ser números (no strings), usando punto como separador decimal.
3. La fecha debe estar en formato ISO YYYY-MM-DD. Si solo ves DD/MM/YYYY, conviértela. Si el año tiene 2 dígitos, asume 20XX.
4. Para "concepto" extrae una descripción breve (máx 60 caracteres) de QUÉ es el gasto: nombre del producto/servicio o del proveedor (ej: "Adobe Creative Cloud", "Repostaje gasolina Repsol", "Material oficina").
5. "proveedor" es el nombre de la empresa que emite la factura.
6. "cif" es el CIF/NIF del proveedor (formato español: letra+8 números, 8 números+letra, o similar).
7. "base" es la base imponible SIN IVA. Si solo ves el total con IVA y conoces el IVA, calcula la base.
8. "iva" es el importe del IVA en euros (no el porcentaje).
9. "irpf" es el importe de IRPF retenido (solo si el proveedor es autónomo y aplica retención). Normalmente null.
10. "total" es el importe final pagado.
11. Si hay incongruencia entre base+IVA y total, prioriza los valores explícitamente etiquetados en el texto.

EJEMPLOS DE TIPO_SUGERIDO:
- "Fijo" → suscripciones SaaS recurrentes (Adobe, Notion, hosting), seguros, alquiler
- "Variable" → tickets de gasolina, material puntual, comidas de trabajo
- "Impuesto" → modelo 130, modelo 303, cuota autónomos, IRPF

EJEMPLOS DE PERIODICIDAD_SUGERIDA:
- "Mensual" → suscripciones SaaS típicas
- "Anual" → seguros, dominios
- "Trimestral" → impuestos trimestrales
- "Puntual" → todo lo demás (gasolina, comida, material)`;

function isValidExpense(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (Object.keys(value).length !== EXPENSE_SCHEMA.required.length) return false;

  const textFields = ["concepto", "proveedor", "cif", "fecha"];
  const amountFields = ["base", "iva", "irpf", "total"];
  return textFields.every(key => value[key] === null || typeof value[key] === "string")
    && amountFields.every(key => value[key] === null || (typeof value[key] === "number" && Number.isFinite(value[key])))
    && EXPENSE_SCHEMA.properties.tipo_sugerido.enum.includes(value.tipo_sugerido)
    && EXPENSE_SCHEMA.properties.periodicidad_sugerida.enum.includes(value.periodicidad_sugerida);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Solo POST permitido" });
  }

  // Auth interna
  const sessionToken = req.headers["x-session-token"];
  if (!sessionToken || sessionToken !== process.env.SESSION_SECRET) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY no configurada" });
  }

  const { ocrText } = req.body || {};

  if (!ocrText || typeof ocrText !== "string" || ocrText.trim().length < 10) {
    return res.status(400).json({ error: "Falta ocrText o es demasiado corto" });
  }

  // Limitamos el texto a 8000 caracteres por seguridad (más que suficiente para un ticket)
  const text = ocrText.slice(0, 8000);

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        max_output_tokens: 500,
        store: false,
        instructions: SYSTEM_PROMPT,
        input: [{
          role: "user",
          content: `Extrae los datos del siguiente texto OCR de un gasto. Devuelve SOLO el JSON, sin nada más:\n\n${text}`
        }],
        text: {
          format: {
            type: "json_schema",
            name: "expense_extraction",
            strict: true,
            schema: EXPENSE_SCHEMA
          }
        }
      })
    });

    const data = await r.json();

    if (!r.ok || data.error) {
      console.error("Error OpenAI:", r.status, data.error?.code || data.error?.type || "sin detalle");
      return res.status(502).json({ error: "Error al interpretar el gasto" });
    }

    const responseText = data.output
      ?.filter(item => item.type === "message")
      .flatMap(item => item.content || [])
      .filter(item => item.type === "output_text")
      .map(item => item.text)
      .join("");

    if (data.status !== "completed" || !responseText) {
      return res.status(502).json({ error: "No se pudo interpretar el gasto" });
    }

    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      return res.status(502).json({ error: "La IA no devolvió un JSON válido" });
    }
    if (!isValidExpense(parsed)) {
      return res.status(502).json({ error: "La IA devolvió datos inválidos" });
    }
    return res.status(200).json({ data: parsed, usage: data.usage });
  } catch (err) {
    console.error("Error en /api/parse-expense:", err);
    return res.status(502).json({ error: "Error al interpretar el gasto" });
  }
}
