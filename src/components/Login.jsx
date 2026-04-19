// src/components/Login.jsx
// Pantalla de login. Llama a /api/auth (servidor) que verifica con bcrypt.

import { useState } from "react";
import { B } from "../utils.js";
import { login } from "../api.js";
import { Inp, ErrorBox } from "./UI.jsx";

export default function Login({ onLogin }) {
  const [u, sU] = useState("");
  const [p, sP] = useState("");
  const [rem, sRem] = useState(false);
  const [err, sErr] = useState("");
  const [loading, sLoading] = useState(false);

  const go = async () => {
    if (loading) return;
    sErr("");

    if (!u.trim() || !p) {
      sErr("Introduce usuario y contraseña");
      return;
    }

    sLoading(true);
    try {
      await login(u.trim(), p);

      // Si marcó "recordar", guardamos un flag para auto-rellenar usuario
      if (rem) {
        try { localStorage.setItem("ga_remember_user", u.trim()); } catch {}
      } else {
        try { localStorage.removeItem("ga_remember_user"); } catch {}
      }

      onLogin();
    } catch (e) {
      sErr(e.message || "Error al iniciar sesión");
    } finally {
      sLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: B.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: B.tS,
      padding: 20,
      boxSizing: "border-box"
    }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;600;700&family=Work+Sans:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <div style={{
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(20px)",
        borderRadius: 16,
        padding: "48px 40px",
        width: "100%",
        maxWidth: 360,
        border: `1px solid ${B.border}`,
        boxSizing: "border-box"
      }}>
        <h1 style={{
          fontSize: 20,
          fontWeight: 700,
          fontFamily: B.tM,
          textTransform: "uppercase",
          textAlign: "center",
          margin: "0 0 8px"
        }}>
          Gestión Autónomo
        </h1>
        <p style={{
          textAlign: "center",
          color: B.muted,
          fontSize: 13,
          margin: "0 0 32px"
        }}>
          Introduce tus credenciales
        </p>

        {err && (
          <div style={{ marginBottom: 16 }}>
            <ErrorBox>{err}</ErrorBox>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Inp
            label="USUARIO"
            value={u}
            onChange={sU}
            onKey={e => e.key === "Enter" && go()}
            ph="Usuario"
          />
          <Inp
            label="CONTRASEÑA"
            value={p}
            onChange={sP}
            type="password"
            onKey={e => e.key === "Enter" && go()}
            ph="Contraseña"
          />

          <label style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: B.muted,
            cursor: "pointer"
          }}>
            <input
              type="checkbox"
              checked={rem}
              onChange={e => sRem(e.target.checked)}
              style={{ accentColor: B.text }}
            />
            Recordar usuario
          </label>

          <button
            onClick={go}
            disabled={loading}
            style={{
              ...B.btn,
              width: "100%",
              padding: "14px 24px",
              marginTop: 8,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? "wait" : "pointer"
            }}
          >
            {loading ? "ENTRANDO..." : "ENTRAR"}
          </button>
        </div>
      </div>
    </div>
  );
}
