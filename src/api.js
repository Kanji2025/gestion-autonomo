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

// Busca un cliente por nombre, lo crea si no existe (Estatus: Activo), devuelve el ID
export async function findOrCreateClient(nombre) {
  if (!nombre || !nombre.trim()) return null;
  const clean = nombre.trim();
  const safe = clean.replace(/"/g, '\\"');
  const formula = `{Nombre}="${safe}"`;

  const records = await fetchTable("Clientes", formula);
  if (records.length > 0) return records[0].id;

  // Crear nuevo cliente, marcado como Activo por defecto
  const created = await createRecord("Clientes", { "Nombre": clean, "Estatus": "Activo" });
  if (created.records && created.records[0]) return created.records[0].id;
  return null;
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
