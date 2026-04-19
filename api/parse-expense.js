// /api/parse-expense.js
// Usa Claude Haiku para extraer datos estructurados del texto OCR de un gasto.

const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `Eres un asistente experto en contabilidad española para autónomos. Tu tarea es extraer datos estructurados del texto OCR de un ticket o factura de gasto.

REGLAS:
1. Devuelve SIEMPRE un JSON válido, sin texto adicional, sin markdown, sin backticks. Solo el JSON puro.
2. Si un campo no está presente o no puedes determinarlo con seguridad, usa null para ese campo.
3. Los importes deben ser números (no strings), usando punto como separador decimal.
4. La fecha debe estar en formato ISO YYYY-MM-DD. Si solo ves DD/MM/YYYY, conviértela. Si el año tiene 2 dígitos, asume 20XX.
5. Para "concepto" extrae una descripción breve (máx 60 caracteres) de QUÉ es el gasto: nombre del producto/servicio o del proveedor (ej: "Adobe Creative Cloud", "Repostaje gasolina Repsol", "Material oficina").
6. "proveedor" es el nombre de la empresa que emite la factura.
7. "cif" es el CIF/NIF del proveedor (formato español: letra+8 números, 8 números+letra, o similar).
8. "base" es la base imponible SIN IVA. Si solo ves el total con IVA y conoces el IVA, calcula la base.
9. "iva" es el importe del IVA en euros (no el porcentaje).
10. "irpf" es el importe de IRPF retenido (solo si el proveedor es autónomo y aplica retención). Normalmente null.
11. "total" es el importe final pagado.
12. Si hay incongruencia entre base+IVA y total, prioriza los valores explícitamente etiquetados en el texto.

ESTRUCTURA EXACTA del JSON a devolver:
{
  "concepto": string|null,
  "proveedor": string|null,
  "cif": string|null,
  "fecha": string|null,
  "base": number|null,
  "iva": number|null,
  "irpf": number|null,
  "total": number|null,
  "tipo_sugerido": "Fijo"|"Variable"|"Impuesto"|null,
  "periodicidad_sugerida": "Mensual"|"Trimestral"|"Anual"|"Puntual"|null
}

EJEMPLOS DE TIPO_SUGERIDO:
- "Fijo" → suscripciones SaaS recurrentes (Adobe, Notion, hosting), seguros, alquiler
- "Variable" → tickets de gasolina, material puntual, comidas de trabajo
- "Impuesto" → modelo 130, modelo 303, cuota autónomos, IRPF

EJEMPLOS DE PERIODICIDAD_SUGERIDA:
- "Mensual" → suscripciones SaaS típicas
- "Anual" → seguros, dominios
- "Trimestral" → impuestos trimestrales
- "Puntual" → todo lo demás (gasolina, comida, material)`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Solo POST permitido" });
  }

  if (!ANTHROPIC_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_KEY no configurada" });
  }

  // Auth interna
  const sessionToken = req.headers["x-session-token"];
  if (!sessionToken || sessionToken !== process.env.SESSION_SECRET) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const { ocrText } = req.body || {};

  if (!ocrText || typeof ocrText !== "string" || ocrText.trim().length < 10) {
    return res.status(400).json({ error: "Falta ocrText o es demasiado corto" });
  }

  // Limitamos el texto a 8000 caracteres por seguridad (más que suficiente para un ticket)
  const text = ocrText.slice(0, 8000);

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: `Extrae los datos del siguiente texto OCR de un gasto. Devuelve SOLO el JSON, sin nada más:\n\n${text}`
        }]
      })
    });

    const data = await r.json();

    if (data.error || !data.content) {
      console.error("Error Anthropic:", data);
      return res.status(500).json({ error: data.error?.message || "Error en Anthropic" });
    }

    // Extraer texto de la respuesta
    const responseText = data.content
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("")
      .trim();

    // Limpiar posibles backticks o markdown que el modelo pudiera incluir
    const cleaned = responseText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("JSON inválido devuelto por Claude:", cleaned);
      return res.status(500).json({
        error: "La IA no devolvió un JSON válido",
        raw: cleaned.slice(0, 300)
      });
    }

    return res.status(200).json({
      data: parsed,
      usage: data.usage  // Para que puedas monitorizar el coste si quieres
    });
  } catch (err) {
    console.error("Error en /api/parse-expense:", err);
    return res.status(500).json({ error: err.message || "Error interno" });
  }
}
