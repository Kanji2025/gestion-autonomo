// src/components/NotificationDropdown.jsx
// Panel flotante de la campana del header. REDISEÑO 2026 paleta marca.
// LÓGICA INTACTA: marcar leída/todas, navegar a Alertas, responsive móvil.

import { useState, useEffect, useRef } from "react";
import {
  X, Check, CheckCheck, ArrowRight, CheckCircle2, Sparkles,
  Bell, Pin, AlertTriangle, ShieldCheck, Calendar as CalendarIcon
} from "lucide-react";

import { B } from "../utils.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { markAlertAsRead, markManualRead, markAutoDismissed } from "./Alertas.jsx";

// ============================================================
// HELPERS DE PRESENTACIÓN (paleta marca, igual que Alertas.jsx)
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
export default function NotificationDropdown({
  alertas,
  onClose,
  onGoToAlerts,
  onChange
}) {
  const { isPhoneOrSmallTablet } = useResponsive();
  const [markingId, setMarkingId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const panelRef = useRef(null);

  // Cerrar al hacer click fuera (solo escritorio)
  useEffect(() => {
    if (isPhoneOrSmallTablet) return;
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        if (e.target.closest("[data-bell-button]")) return;
        onClose();
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose, isPhoneOrSmallTablet]);

  // Cerrar con Escape
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
  // ESTILOS DE CONTENEDOR
  // ============================================================
  const containerStyle = isPhoneOrSmallTablet
    ? {
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(2px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        paddingTop: 60
      }
    : {
        position: "fixed",
        top: 64,
        right: 20,
        zIndex: 200,
        width: 380,
        maxHeight: "calc(100vh - 100px)"
      };

  const panelStyle = isPhoneOrSmallTablet
    ? {
        background: "#fff",
        margin: "0 12px",
        borderRadius: 20,
        maxHeight: "calc(100vh - 80px)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        border: `1px solid ${B.border}`
      }
    : {
        background: "#fff",
        borderRadius: 20,
        border: `1px solid ${B.border}`,
        boxShadow: "0 12px 40px rgba(0,0,0,0.10)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        maxHeight: "calc(100vh - 100px)"
      };

  return (
    <div style={containerStyle} onClick={isPhoneOrSmallTablet ? onClose : undefined}>
      <div ref={panelRef} style={panelStyle} onClick={e => e.stopPropagation()}>
        {/* CABECERA */}
        <div style={{
          padding: "16px 18px",
          borderBottom: `1px solid ${B.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#fafafa"
        }}>
          <div>
            <div style={{
              fontSize: 10,
              color: B.muted,
              fontFamily: B.font,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontWeight: 600
            }}>
              Notificaciones
            </div>
            <div style={{
              fontSize: 15,
              fontWeight: 700,
              fontFamily: B.font,
              marginTop: 3,
              color: B.ink,
              letterSpacing: "-0.01em"
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
              color: B.muted,
              padding: 4,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center"
            }}
            aria-label="Cerrar"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* LISTA */}
        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          {alertas.length === 0 ? (
            <div style={{
              padding: "44px 20px",
              textAlign: "center",
              color: B.muted,
              fontSize: 14,
              fontFamily: B.font,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14
            }}>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: 999,
                background: B.yellow,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <CheckCircle2 size={26} strokeWidth={2} color={B.ink} />
              </div>
              <div style={{ color: B.ink, fontWeight: 600 }}>
                No hay alertas pendientes
              </div>
            </div>
          ) : (
            alertas.map(a => {
              const Icon = iconForType(a.tipo);
              const borderColor = bordeForPriority(a.prioridad);
              const isMarking = markingId === a.id;

              return (
                <div
                  key={a.id}
                  style={{
                    padding: "14px 16px",
                    borderBottom: `1px solid ${B.border}`,
                    borderLeft: `3px solid ${borderColor}`,
                    transition: "background 0.15s ease"
                  }}
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 999,
                      background: "#f4f4f4",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}>
                      <Icon size={15} strokeWidth={1.75} color={B.ink} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Meta chips */}
                      <div style={{
                        display: "flex",
                        gap: 5,
                        alignItems: "center",
                        flexWrap: "wrap"
                      }}>
                        <span style={{
                          fontSize: 9,
                          color: B.ink,
                          fontWeight: 600,
                          fontFamily: B.font,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em"
                        }}>
                          {a.tipo}
                        </span>
                        <span style={{ color: B.muted, fontSize: 9 }}>·</span>
                        <span style={{
                          fontSize: 9,
                          color: B.muted,
                          fontWeight: 600,
                          fontFamily: B.font,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em"
                        }}>
                          {a.prioridad}
                        </span>
                        {a.source === "auto" && (
                          <span style={{
                            background: B.lavender,
                            color: B.ink,
                            padding: "1px 7px",
                            borderRadius: 999,
                            fontSize: 9,
                            fontWeight: 600,
                            fontFamily: B.font,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3
                          }}>
                            <Sparkles size={9} strokeWidth={2.25} />
                            Auto
                          </span>
                        )}
                      </div>
                      {/* Título */}
                      <div style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: B.ink,
                        marginTop: 4,
                        fontFamily: B.font,
                        letterSpacing: "-0.01em",
                        lineHeight: 1.3
                      }}>
                        {a.titulo}
                      </div>
                      {/* Mensaje (truncado 2 líneas) */}
                      {a.mensaje && (
                        <div style={{
                          fontSize: 12,
                          color: B.muted,
                          marginTop: 4,
                          fontFamily: B.font,
                          lineHeight: 1.5,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden"
                        }}>
                          {a.mensaje}
                        </div>
                      )}
                      {/* Botón "Leída" */}
                      <button
                        onClick={() => marcarUna(a)}
                        disabled={isMarking}
                        style={{
                          marginTop: 10,
                          padding: "5px 12px",
                          fontSize: 11,
                          fontWeight: 600,
                          fontFamily: B.font,
                          background: "transparent",
                          color: B.ink,
                          border: `1px solid ${B.border}`,
                          borderRadius: 999,
                          cursor: isMarking ? "not-allowed" : "pointer",
                          opacity: isMarking ? 0.5 : 1,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5
                        }}
                      >
                        <Check size={11} strokeWidth={2.25} />
                        {isMarking ? "…" : "Leída"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER con acciones */}
        {alertas.length > 0 && (
          <div style={{
            padding: "12px 14px",
            borderTop: `1px solid ${B.border}`,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            background: "#fafafa"
          }}>
            {alertas.length > 1 && (
              <button
                onClick={marcarTodas}
                disabled={markingAll}
                style={{
                  flex: 1,
                  padding: "9px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: B.font,
                  background: B.ink,
                  color: "#fff",
                  border: "1px solid transparent",
                  borderRadius: 999,
                  cursor: markingAll ? "not-allowed" : "pointer",
                  opacity: markingAll ? 0.5 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6
                }}
              >
                <CheckCheck size={13} strokeWidth={2.25} />
                {markingAll ? "…" : "Marcar todas"}
              </button>
            )}
            <button
              onClick={handleGoToAlerts}
              style={{
                flex: 1,
                padding: "9px 12px",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: B.font,
                background: "transparent",
                color: B.ink,
                border: `1px solid ${B.border}`,
                borderRadius: 999,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6
              }}
            >
              Ver todas
              <ArrowRight size={13} strokeWidth={2.25} />
            </button>
          </div>
        )}

        {/* FOOTER vacío */}
        {alertas.length === 0 && (
          <div style={{
            padding: "12px 14px",
            borderTop: `1px solid ${B.border}`,
            background: "#fafafa"
          }}>
            <button
              onClick={handleGoToAlerts}
              style={{
                width: "100%",
                padding: "9px 12px",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: B.font,
                background: "transparent",
                color: B.ink,
                border: `1px solid ${B.border}`,
                borderRadius: 999,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6
              }}
            >
              Ir a alertas
              <ArrowRight size={13} strokeWidth={2.25} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
