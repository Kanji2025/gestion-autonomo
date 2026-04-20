// src/components/NotificationDropdown.jsx
// Panel flotante que aparece al pulsar la campana.
// Muestra las alertas pendientes (manuales + automáticas no descartadas).
// Adaptativo: pequeño en escritorio, pantalla completa en móvil.

import { useState, useEffect, useRef } from "react";
import { B } from "../utils.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { markAlertAsRead, markManualRead, markAutoDismissed } from "./Alertas.jsx";

// ============================================================
// COLOR Y EMOJI (los mismos que Alertas.jsx)
// ============================================================
function colorForPriority(p) {
  if (p === "Alta") return B.red;
  if (p === "Media") return B.amber;
  return B.muted;
}

function emojiForType(t) {
  switch (t) {
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
export default function NotificationDropdown({
  alertas,
  onClose,
  onGoToAlerts,
  onChange
}) {
  const { isMobile, isPhoneOrSmallTablet } = useResponsive();
  const [markingId, setMarkingId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const panelRef = useRef(null);

  // Cerrar al hacer click fuera (solo en escritorio; en móvil hay overlay explícito)
  useEffect(() => {
    if (isPhoneOrSmallTablet) return;
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        // Ignorar clicks en la campana (tienen data-bell-button)
        if (e.target.closest("[data-bell-button]")) return;
        onClose();
      }
    }
    // Pequeño delay para evitar cerrar por el click que abrió
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose, isPhoneOrSmallTablet]);

  // Cerrar con tecla Escape
  useEffect(() => {
    function handleEscape(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const marcarUna = async (alert) => {
    setMarkingId(alert.id);
    try {
      await markAlertAsRead(alert);
      await onChange();
    } catch (e) {
      console.error("Error marcando alerta:", e);
    }
    setMarkingId(null);
  };

  const marcarTodas = async () => {
    setMarkingAll(true);
    try {
      const manuales = alertas.filter(a => a.source === "airtable");
      const autos = alertas.filter(a => a.source === "auto");

      await Promise.all(manuales.map(a => markManualRead(a.id)));
      for (const a of autos) {
        markAutoDismissed(a.id, a.fingerprint);
      }
      await onChange();
    } catch (e) {
      console.error("Error marcando todas:", e);
    }
    setMarkingAll(false);
  };

  const handleGoToAlerts = () => {
    onGoToAlerts();
    onClose();
  };

  // ============================================================
  // ESTILOS DE CONTENEDOR SEGÚN DISPOSITIVO
  // ============================================================
  const containerStyle = isPhoneOrSmallTablet
    ? {
        // Móvil / tablet vertical: pantalla casi completa desde arriba
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(2px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        paddingTop: 60
      }
    : {
        // Escritorio: panel flotante debajo de la campana
        position: "fixed",
        top: 64,
        right: 20,
        zIndex: 200,
        width: 360,
        maxHeight: "calc(100vh - 100px)"
      };

  const panelStyle = isPhoneOrSmallTablet
    ? {
        background: "#fff",
        margin: "0 12px",
        borderRadius: 12,
        maxHeight: "calc(100vh - 80px)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
      }
    : {
        background: "#fff",
        borderRadius: 12,
        border: `1px solid ${B.border}`,
        boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        maxHeight: "calc(100vh - 100px)"
      };

  return (
    <div style={containerStyle} onClick={isPhoneOrSmallTablet ? onClose : undefined}>
      <div
        ref={panelRef}
        style={panelStyle}
        onClick={e => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div style={{
          padding: "14px 16px",
          borderBottom: `1px solid ${B.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(0,0,0,0.02)"
        }}>
          <div>
            <div style={{
              fontSize: 11,
              color: B.muted,
              fontFamily: B.tM,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontWeight: 700
            }}>
              Notificaciones
            </div>
            <div style={{
              fontSize: 14,
              fontWeight: 700,
              fontFamily: B.tS,
              marginTop: 2
            }}>
              {alertas.length === 0
                ? "Todo bajo control"
                : `${alertas.length} pendiente${alertas.length !== 1 ? "s" : ""}`}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: 20,
              color: B.muted,
              padding: 4,
              lineHeight: 1
            }}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Lista de alertas (con scroll) */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch"
        }}>
          {alertas.length === 0 ? (
            <div style={{
              padding: "40px 20px",
              textAlign: "center",
              color: B.muted,
              fontSize: 13,
              fontFamily: B.tS
            }}>
              <div style={{ fontSize: 42, marginBottom: 10 }}>🎉</div>
              <div>No hay alertas pendientes</div>
            </div>
          ) : (
            alertas.map(a => {
              const color = colorForPriority(a.prioridad);
              const emoji = emojiForType(a.tipo);
              const isMarking = markingId === a.id;

              return (
                <div
                  key={a.id}
                  style={{
                    padding: "12px 14px",
                    borderBottom: `1px solid ${B.border}`,
                    borderLeft: `3px solid ${color}`,
                    transition: "background 0.15s ease"
                  }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ fontSize: 18, lineHeight: 1.2 }}>{emoji}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 10,
                        color: color,
                        fontWeight: 700,
                        fontFamily: B.tM,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                        flexWrap: "wrap"
                      }}>
                        <span>{a.tipo}</span>
                        <span style={{ color: B.muted }}>·</span>
                        <span style={{ color: B.muted }}>{a.prioridad}</span>
                        {a.source === "auto" && (
                          <span style={{
                            color: B.purple,
                            background: B.purple + "15",
                            padding: "1px 5px",
                            borderRadius: 3,
                            fontSize: 9
                          }}>
                            AUTO
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: B.text,
                        marginTop: 2,
                        fontFamily: B.tS
                      }}>
                        {a.titulo}
                      </div>
                      {a.mensaje && (
                        <div style={{
                          fontSize: 12,
                          color: B.muted,
                          marginTop: 4,
                          fontFamily: B.tS,
                          lineHeight: 1.4,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden"
                        }}>
                          {a.mensaje}
                        </div>
                      )}
                      <button
                        onClick={() => marcarUna(a)}
                        disabled={isMarking}
                        style={{
                          marginTop: 8,
                          padding: "5px 10px",
                          fontSize: 10,
                          fontWeight: 700,
                          fontFamily: B.tM,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          background: "transparent",
                          color: B.green,
                          border: `1px solid ${B.green}`,
                          borderRadius: 4,
                          cursor: "pointer",
                          opacity: isMarking ? 0.5 : 1
                        }}
                      >
                        {isMarking ? "..." : "✓ Marcar leída"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer con acciones */}
        {alertas.length > 0 && (
          <div style={{
            padding: "10px 14px",
            borderTop: `1px solid ${B.border}`,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            background: "rgba(0,0,0,0.02)"
          }}>
            {alertas.length > 1 && (
              <button
                onClick={marcarTodas}
                disabled={markingAll}
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: B.tM,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  background: B.green,
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  opacity: markingAll ? 0.5 : 1
                }}
              >
                {markingAll ? "..." : "✓ Marcar todas"}
              </button>
            )}
            <button
              onClick={handleGoToAlerts}
              style={{
                flex: 1,
                padding: "8px 10px",
                fontSize: 10,
                fontWeight: 700,
                fontFamily: B.tM,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                background: "transparent",
                color: B.text,
                border: `1px solid ${B.border}`,
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              Ver todas →
            </button>
          </div>
        )}

        {/* Footer vacío: solo ir a Alertas */}
        {alertas.length === 0 && (
          <div style={{
            padding: "10px 14px",
            borderTop: `1px solid ${B.border}`,
            background: "rgba(0,0,0,0.02)"
          }}>
            <button
              onClick={handleGoToAlerts}
              style={{
                width: "100%",
                padding: "8px 10px",
                fontSize: 10,
                fontWeight: 700,
                fontFamily: B.tM,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                background: "transparent",
                color: B.muted,
                border: `1px solid ${B.border}`,
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              Ir a Alertas
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
