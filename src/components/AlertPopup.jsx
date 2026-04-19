// src/components/AlertPopup.jsx
// Pop-up modal que se muestra encima de la app cuando hay alertas pendientes.
// Soporta alertas MANUALES (guardadas en Airtable) y AUTOMÁTICAS (calculadas en vivo).

import { useState } from "react";
import { B } from "../utils.js";
import { updateRecord } from "../api.js";

// ============================================================
// COLORES POR PRIORIDAD
// ============================================================
function colorForPriority(prioridad) {
  switch (prioridad) {
    case "Alta": return B.red;
    case "Media": return B.amber;
    case "Baja": return B.muted;
    default: return B.purple;
  }
}

function emojiForType(tipo) {
  switch (tipo) {
    case "Factura Vencida": return "⚠️";
    case "IVA Trimestre": return "💰";
    case "Cuota Autónomos": return "🏛️";
    case "Manual": return "📌";
    default: return "🔔";
  }
}

// ============================================================
// COMPONENTE
// ============================================================
export default function AlertPopup({ alertas, onClose, onDismissed }) {
  const [idx, setIdx] = useState(0);
  const [marking, setMarking] = useState(false);

  if (!alertas || alertas.length === 0) return null;
  if (idx >= alertas.length) {
    onClose();
    return null;
  }

  const current = alertas[idx];
  const color = colorForPriority(current.prioridad);
  const emoji = emojiForType(current.tipo);
  const isLast = idx === alertas.length - 1;
  const isManual = current.source === "airtable";  // las automáticas vienen marcadas con source="auto"

  const dismiss = async () => {
    if (marking) return;
    setMarking(true);

    try {
      // Solo las manuales (guardadas en Airtable) se marcan como mostradas
      if (isManual && current.id) {
        await updateRecord("Alertas", current.id, { "Mostrada": true });
        if (onDismissed) onDismissed(current.id);
      }
    } catch (e) {
      console.error("Error marcando alerta como mostrada:", e);
      // No bloqueamos al usuario por esto, seguimos
    }

    setMarking(false);

    if (isLast) {
      onClose();
    } else {
      setIdx(idx + 1);
    }
  };

  const skipAll = () => {
    // Cerrar todas sin marcarlas (volverán a aparecer la próxima vez)
    onClose();
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.55)",
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10000,
      padding: 16,
      boxSizing: "border-box",
      fontFamily: B.tS
    }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;600;700&family=Work+Sans:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <div style={{
        background: "#fff",
        borderRadius: 16,
        width: "100%",
        maxWidth: 480,
        padding: 0,
        boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
        border: `4px solid ${color}`,
        overflow: "hidden",
        boxSizing: "border-box"
      }}>
        {/* Cabecera con color */}
        <div style={{
          background: color + "15",
          padding: "20px 24px",
          borderBottom: `1px solid ${color}30`,
          display: "flex",
          alignItems: "center",
          gap: 14
        }}>
          <div style={{ fontSize: 32 }}>{emoji}</div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 11,
              fontFamily: B.tM,
              fontWeight: 700,
              color: color,
              textTransform: "uppercase",
              letterSpacing: "0.08em"
            }}>
              {current.tipo || "Alerta"}
              {alertas.length > 1 && (
                <span style={{ marginLeft: 8, opacity: 0.6 }}>
                  {idx + 1} / {alertas.length}
                </span>
              )}
            </div>
            <div style={{
              fontSize: 18,
              fontWeight: 700,
              color: B.text,
              marginTop: 4,
              fontFamily: B.tS
            }}>
              {current.titulo || "Sin título"}
            </div>
          </div>
        </div>

        {/* Mensaje */}
        <div style={{ padding: "20px 24px" }}>
          <div style={{
            fontSize: 14,
            color: B.text,
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            fontFamily: B.tS
          }}>
            {current.mensaje || "Sin descripción"}
          </div>

          {current.fecha && (
            <div style={{
              marginTop: 14,
              fontSize: 12,
              color: B.muted,
              fontFamily: B.tM,
              textTransform: "uppercase",
              letterSpacing: "0.06em"
            }}>
              {current.fecha}
            </div>
          )}
        </div>

        {/* Botones */}
        <div style={{
          padding: "0 24px 20px",
          display: "flex",
          gap: 10,
          flexWrap: "wrap"
        }}>
          <button
            onClick={dismiss}
            disabled={marking}
            style={{
              ...B.btn,
              flex: 1,
              minWidth: 140,
              background: color,
              opacity: marking ? 0.6 : 1,
              cursor: marking ? "wait" : "pointer"
            }}
          >
            {marking ? "..." : isLast ? "ENTENDIDO" : "SIGUIENTE"}
          </button>

          {alertas.length > 1 && !isLast && (
            <button
              onClick={skipAll}
              style={{
                ...B.btn,
                flex: 0,
                background: "transparent",
                color: B.muted,
                border: `1px solid ${B.border}`
              }}
            >
              SALTAR
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
