// src/components/AlertPopup.jsx
// Pop-up modal de alertas pendientes. REDISEÑO 2026 paleta marca.
// LÓGICA INTACTA: navegación entre alertas, marcar Mostrada en Airtable, saltar todas.

import { useState } from "react";
import {
  X, ArrowRight, Check, Sparkles, Bell, Pin,
  AlertTriangle, ShieldCheck, Calendar as CalendarIcon
} from "lucide-react";

import { B } from "../utils.js";
import { updateRecord } from "../api.js";

// ============================================================
// HELPERS DE PRESENTACIÓN (igual que Alertas.jsx)
// ============================================================
function bordeForPriority(p) {
  if (p === "Alta") return B.ink;
  if (p === "Media") return B.yellow;
  return B.border;
}

function iconForType(t) {
  switch (t) {
    case "Factura Vencida": return AlertTriangle;
    case "IVA Trimestre": return CalendarIcon;
    case "Cuota Autónomos": return ShieldCheck;
    case "Manual": return Pin;
    default: return Bell;
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
  const Icon = iconForType(current.tipo);
  const borderColor = bordeForPriority(current.prioridad);
  const isLast = idx === alertas.length - 1;
  const isManual = current.source === "airtable";
  const isAuto = current.source === "auto";

  const dismiss = async () => {
    if (marking) return;
    setMarking(true);
    try {
      if (isManual && current.id) {
        await updateRecord("Alertas", current.id, { "Mostrada": true });
        if (onDismissed) onDismissed(current.id);
      }
    } catch (e) {
      console.error("Error marcando alerta como mostrada:", e);
    }
    setMarking(false);
    if (isLast) onClose();
    else setIdx(idx + 1);
  };

  const skipAll = () => onClose();

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.55)",
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10000,
      padding: 16,
      boxSizing: "border-box",
      fontFamily: B.font
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 20,
        width: "100%",
        maxWidth: 480,
        boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
        border: `1px solid ${B.border}`,
        borderLeft: `4px solid ${borderColor}`,
        overflow: "hidden",
        boxSizing: "border-box"
      }}>
        {/* CABECERA */}
        <div style={{
          padding: "20px 24px 18px",
          borderBottom: `1px solid ${B.border}`,
          display: "flex",
          alignItems: "flex-start",
          gap: 14
        }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            background: "#f4f4f4",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
          }}>
            <Icon size={20} strokeWidth={1.75} color={B.ink} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 5
            }}>
              <span style={{
                fontSize: 10,
                fontFamily: B.font,
                fontWeight: 600,
                color: B.ink,
                textTransform: "uppercase",
                letterSpacing: "0.08em"
              }}>
                {current.tipo || "Alerta"}
              </span>
              <span style={{ color: B.muted, fontSize: 10 }}>·</span>
              <span style={{
                fontSize: 10,
                fontFamily: B.font,
                fontWeight: 600,
                color: B.muted,
                textTransform: "uppercase",
                letterSpacing: "0.08em"
              }}>
                {current.prioridad}
              </span>
              {isAuto && (
                <span style={{
                  background: B.lavender,
                  color: B.ink,
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 600,
                  fontFamily: B.font,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4
                }}>
                  <Sparkles size={10} strokeWidth={2.25} />
                  Auto
                </span>
              )}
              {alertas.length > 1 && (
                <span style={{
                  fontSize: 10,
                  color: B.muted,
                  fontFamily: B.font,
                  marginLeft: "auto",
                  fontWeight: 600,
                  ...B.num
                }}>
                  {idx + 1} / {alertas.length}
                </span>
              )}
            </div>
            <div style={{
              fontSize: 18,
              fontWeight: 700,
              color: B.ink,
              fontFamily: B.font,
              letterSpacing: "-0.02em",
              lineHeight: 1.25
            }}>
              {current.titulo || "Sin título"}
            </div>
          </div>
        </div>

        {/* MENSAJE */}
        <div style={{ padding: "18px 24px" }}>
          <div style={{
            fontSize: 14,
            color: B.muted,
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
            fontFamily: B.font
          }}>
            {current.mensaje || "Sin descripción"}
          </div>

          {current.fecha && (
            <div style={{
              marginTop: 14,
              fontSize: 12,
              color: B.muted,
              fontFamily: B.font,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              ...B.num
            }}>
              <CalendarIcon size={12} strokeWidth={2} />
              {current.fecha}
            </div>
          )}
        </div>

        {/* BOTONES */}
        <div style={{
          padding: "0 24px 20px",
          display: "flex",
          gap: 8,
          flexWrap: "wrap"
        }}>
          <button
            onClick={dismiss}
            disabled={marking}
            style={{
              flex: 1,
              minWidth: 140,
              padding: "11px 18px",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: B.font,
              background: B.ink,
              color: "#fff",
              border: "1px solid transparent",
              borderRadius: 999,
              cursor: marking ? "wait" : "pointer",
              opacity: marking ? 0.6 : 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              transition: "opacity 0.15s ease"
            }}
          >
            {marking ? "…" : isLast ? (
              <>
                <Check size={14} strokeWidth={2.25} />
                Entendido
              </>
            ) : (
              <>
                Siguiente
                <ArrowRight size={14} strokeWidth={2.25} />
              </>
            )}
          </button>

          {alertas.length > 1 && !isLast && (
            <button
              onClick={skipAll}
              style={{
                padding: "11px 18px",
                fontSize: 13,
                fontWeight: 600,
                fontFamily: B.font,
                background: "transparent",
                color: B.muted,
                border: `1px solid ${B.border}`,
                borderRadius: 999,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6
              }}
            >
              <X size={14} strokeWidth={2.25} />
              Saltar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
