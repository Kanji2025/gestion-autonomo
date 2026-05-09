// src/api.js
// Cliente que habla con nuestra trastienda serverless.
// Todas las claves API están ocultas en el servidor.

// ============================================================
// SESSION TOKEN
// ============================================================
const TOKEN_KEY = "ga_session_token";

export function getSessionToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setSessionToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
}

export function clearSessionToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

// ============================================================
// HELPER INTERNO
// ============================================================
async function callApi(endpoint, body, method = "POST") {
  const token = getSessionToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["x-session-token"] = token;

  const res = await fetch(endpoint, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401) clearSessionToken();
    throw new Error(data.error || `Error ${res.status}`);
  }

  return data;
}

// ============================================================
// AUTENTICACIÓN
// ============================================================
export async function login(user, password) {
  const data = await callApi("/api/auth", { user, password });
  if (data.success && data.sessionToken) {
    setSessionToken(data.sessionToken);
    return { success: true, user: data.user };
  }
  throw new Error("Login fallido");
}

export function logout() {
  clearSessionToken();
}

export function isLoggedIn() {
  return !!getSessionToken();
}

// ============================================================
// AIRTABLE
// ============================================================
export async function fetchTable(table, filterByFormula = null) {
  const data = await callApi("/api/airtable", { action: "list", table, filterByFormula });
  return data.records || [];
}

export async function createRecord(table, fields) {
  const data = await callApi("/api/airtable", { action: "create", table, fields });
  return data;
}

export async function updateRecord(table, recordId, fields) {
  const data = await callApi("/api/airtable", { action: "update", table, recordId, fields });
  return data;
}

export async function deleteRecord(table, recordId) {
  const data = await callApi("/api/airtable", { action: "delete", table, recordId });
  return data;
}

// ============================================================
// FIND OR CREATE CLIENT
// ============================================================
export async function findOrCreateClient(nombre, cif = null) {
  if (!nombre || !nombre.trim()) return null;
  const clean = nombre.trim();
  const safe = clean.replace(/"/g, '\\"');
  const formula = `{Nombre}="${safe}"`;

  const records = await fetchTable("Clientes", formula);

  if (records.length > 0) {
    const existing = records[0];
    if (cif && cif.trim() && !existing.fields["CIF/NIF"]) {
      try {
        await updateRecord("Clientes", existing.id, { "CIF/NIF": cif.trim() });
      } catch (e) {
        console.warn("No se pudo actualizar CIF del cliente existente:", e);
      }
    }
    return existing.id;
  }

  const fields = { "Nombre": clean, "Estatus": "Activo" };
  if (cif && cif.trim()) fields["CIF/NIF"] = cif.trim();

  const created = await createRecord("Clientes", fields);
  if (created.records && created.records[0]) return created.records[0].id;
  return null;
}

// ============================================================
// BUSCAR GASTO FIJO POR PROVEEDOR
// Devuelve el registro si existe (activo o no), o null si no existe.
// Se usa para detectar duplicados al dar de alta una suscripción.
// ============================================================
export async function findGastoFijoByProveedor(proveedor) {
  if (!proveedor || !proveedor.trim()) return null;
  // Normalizar: quitar espacios extra y pasar a minúsculas para comparación flexible
  const clean = proveedor.trim().toLowerCase().replace(/\s+/g, " ");
  // Traemos todos los Gastos Fijos y comparamos en local (son pocos registros)
  const records = await fetchTable("Gastos Fijos");
  const found = records.find(r => {
    const prov = (r.fields["Proveedor"] || "").trim().toLowerCase().replace(/\s+/g, " ");
    return prov === clean;
  });
  return found || null;
}
// ============================================================
// CREAR GASTO FIJO (suscripción)
// Crea una nueva ficha en Gastos Fijos con estado Activa=Sí.
// Devuelve el ID del registro creado.
// ============================================================
export async function createGastoFijo({
  nombre,
  proveedor,
  cifProveedor,
  periodicidad,
  importe,
  moneda = "EUR",
  fechaAlta,
  notas
}) {
  const fields = {
    "Nombre": (nombre || proveedor || "Sin nombre").trim(),
    "Activa": "Sí"
  };

  if (proveedor && proveedor.trim()) fields["Proveedor"] = proveedor.trim();
  if (cifProveedor && cifProveedor.trim()) fields["CIF Proveedor"] = cifProveedor.trim();
  if (periodicidad) fields["Periodicidad"] = periodicidad;
  if (importe != null && !isNaN(importe)) fields["Importe Medio"] = Number(importe);
  if (moneda) fields["Moneda"] = moneda;
  if (fechaAlta) fields["Fecha Alta"] = fechaAlta;
  if (notas) fields["Notas"] = notas;

  const created = await createRecord("Gastos Fijos", fields);
  if (created.records && created.records[0]) return created.records[0].id;
  return null;
}

// ============================================================
// ENLAZAR UN GASTO INDIVIDUAL A UN GASTO FIJO
// Actualiza el campo `Gasto Fijo` del registro de Gastos.
// ============================================================
export async function linkGastoToGastoFijo(gastoId, gastoFijoId) {
  if (!gastoId || !gastoFijoId) return null;
  return updateRecord("Gastos", gastoId, { "Gasto Fijo": [gastoFijoId] });
}

// ============================================================
// OCR (Google Vision via /api/ocr)
// ============================================================
export async function runOCR(imageBase64) {
  const data = await callApi("/api/ocr", { imageBase64 });
  return data.text || "";
}

// ============================================================
// PARSE EXPENSE (Claude Haiku via /api/parse-expense)
// ============================================================
export async function parseExpense(ocrText) {
  const data = await callApi("/api/parse-expense", { ocrText });
  return data.data || {};
}
