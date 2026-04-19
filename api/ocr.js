// /api/ocr.js
// Proxy seguro a Google Vision OCR. Mantiene la API key en el servidor.

const VISION_KEY = process.env.GOOGLE_VISION_KEY;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb"  // Para imágenes/PDFs grandes en base64
    }
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Solo POST permitido" });
  }

  if (!VISION_KEY) {
    return res.status(500).json({ error: "GOOGLE_VISION_KEY no configurada" });
  }

  // Auth interna: solo aceptamos peticiones de usuarios logueados
  const sessionToken = req.headers["x-session-token"];
  if (!sessionToken || sessionToken !== process.env.SESSION_SECRET) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const { imageBase64 } = req.body || {};

  if (!imageBase64 || typeof imageBase64 !== "string") {
    return res.status(400).json({ error: "Falta imageBase64 (string)" });
  }

  try {
    const r = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${VISION_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{
            image: { content: imageBase64 },
            features: [{ type: "TEXT_DETECTION", maxResults: 1 }]
          }]
        })
      }
    );

    const data = await r.json();

    if (data.error) {
      console.error("Error Google Vision:", data.error);
      return res.status(500).json({ error: data.error.message || "Error en Google Vision" });
    }

    const text = data.responses?.[0]?.fullTextAnnotation?.text || "";

    return res.status(200).json({ text });
  } catch (err) {
    console.error("Error en /api/ocr:", err);
    return res.status(500).json({ error: err.message || "Error interno" });
  }
}
