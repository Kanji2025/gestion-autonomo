// /api/auth.js
// Login con bcrypt. La contraseña nunca viaja en claro al servidor más allá
// de esta función, y nunca se guarda en código (solo el hash en env vars).

import bcrypt from "bcryptjs";

const AUTH_USER = process.env.AUTH_USER;
const AUTH_PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH;
const SESSION_SECRET = process.env.SESSION_SECRET;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Solo POST permitido" });
  }

  if (!AUTH_USER || !AUTH_PASSWORD_HASH || !SESSION_SECRET) {
    return res.status(500).json({
      error: "Variables AUTH_USER, AUTH_PASSWORD_HASH o SESSION_SECRET no configuradas"
    });
  }

  const { user, password } = req.body || {};

  if (!user || !password) {
    return res.status(400).json({ error: "Falta usuario o contraseña" });
  }

  // Comprobar usuario
  if (user !== AUTH_USER) {
    // Pequeño retraso para dificultar ataques de fuerza bruta
    await new Promise(r => setTimeout(r, 500));
    return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
  }

  // Comprobar hash de contraseña
  let isValid;
  try {
    isValid = await bcrypt.compare(password, AUTH_PASSWORD_HASH);
  } catch (err) {
    console.error("Error comparando bcrypt:", err);
    return res.status(500).json({ error: "Error verificando credenciales" });
  }

  if (!isValid) {
    await new Promise(r => setTimeout(r, 500));
    return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
  }

  // Login OK: devolvemos el token de sesión que el frontend usará
  // en sus llamadas a /api/airtable, /api/ocr, /api/parse-expense
  return res.status(200).json({
    success: true,
    sessionToken: SESSION_SECRET,
    user: AUTH_USER
  });
}
