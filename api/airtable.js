// /api/airtable.js
// Proxy seguro a Airtable. Mantiene el token en el servidor, fuera del navegador.

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE;

export default async function handler(req, res) {
  // Comprobación básica de configuración
  if (!TOKEN || !BASE_ID) {
    return res.status(500).json({ error: "Variables de entorno AIRTABLE_TOKEN o AIRTABLE_BASE no configuradas" });
  }

  // Auth interna: solo aceptamos peticiones de usuarios logueados
  // (el frontend manda el flag tras login con bcrypt)
  const sessionToken = req.headers["x-session-token"];
  if (!sessionToken || sessionToken !== process.env.SESSION_SECRET) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const { action, table, recordId, fields, filterByFormula } = req.body || {};

  if (!action || !table) {
    return res.status(400).json({ error: "Falta action o table" });
  }

  const baseUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}`;
  const headers = {
    "Authorization": `Bearer ${TOKEN}`,
    "Content-Type": "application/json"
  };

  try {
    let result;

    switch (action) {
      case "list": {
        // Lista todos los registros (con paginación)
        let all = [];
        let offset = null;
        do {
          const params = new URLSearchParams();
          if (offset) params.set("offset", offset);
          if (filterByFormula) params.set("filterByFormula", filterByFormula);
          const url = `${baseUrl}${params.toString() ? "?" + params.toString() : ""}`;
          const r = await fetch(url, { headers });
          const d = await r.json();
          if (d.error) {
            return res.status(500).json({ error: d.error.message || "Error Airtable", details: d.error });
          }
          all = all.concat(d.records || []);
          offset = d.offset;
        } while (offset);
        result = { records: all };
        break;
      }

      case "create": {
        const r = await fetch(baseUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ records: [{ fields }] })
        });
        result = await r.json();
        if (result.error) {
          return res.status(500).json({ error: result.error.message || "Error creando", details: result.error });
        }
        break;
      }

      case "update": {
        if (!recordId) return res.status(400).json({ error: "Falta recordId para update" });
        const r = await fetch(baseUrl, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ records: [{ id: recordId, fields }] })
        });
        result = await r.json();
        if (result.error) {
          return res.status(500).json({ error: result.error.message || "Error actualizando", details: result.error });
        }
        break;
      }

      case "delete": {
        if (!recordId) return res.status(400).json({ error: "Falta recordId para delete" });
        const r = await fetch(`${baseUrl}?records[]=${recordId}`, {
          method: "DELETE",
          headers
        });
        result = await r.json();
        if (result.error) {
          return res.status(500).json({ error: result.error.message || "Error borrando", details: result.error });
        }
        break;
      }

      default:
        return res.status(400).json({ error: `Acción desconocida: ${action}` });
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error("Error en /api/airtable:", err);
    return res.status(500).json({ error: err.message || "Error interno" });
  }
}
