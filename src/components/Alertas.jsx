// src/components/Alertas.jsx
// Alertas manuales (guardadas en Airtable) + automáticas (calculadas en vivo).
// Las automáticas se pueden "marcar como leídas" localmente.
// Reaparecen si la situación cambia (ej: cambias la cuota).

import { useState, useMemo } from "react";
import { B, fmt, hoy, getTrimestre } from "../utils.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { createRecord, updateRecord, deleteRecord } from "../api.js";
import { Card, Lbl, Inp, Sel, SectionHeader, ErrorBox, TxtArea } from "./UI.jsx";

// ============================================================
// DESCARTE LOCAL DE ALERTAS AUTOMÁTICAS
// ============================================================
// Guardamos en localStorage una "huella" del contexto de cada alerta.
// Si la huella cambia, la alerta reaparece.
const DISMISS_KEY = "ga_auto_alerts_dismissed";

function readDismissed() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeDismissed(obj) {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify(obj));
  } catch {}
}

export function dismissAutoAlert(id, fingerprint) {
  const all = readDismissed();
  all[id] = { fingerprint, dismissedAt: new Date().toISOString() };
  writeDismissed(all);
}

export function clearAllAutoAlertsDismissed() {
  writeDismissed({});
}

function isAutoAlertDismissed(id, currentFingerprint) {
  const all = readDismissed();
  const entry = all[id];
  if (!entry) return false;
  // Si la huella coincide con la descartada, sigue descartada
  return entry.fingerprint === currentFingerprint;
}

// ============================================================
// GENERAR ALERTAS AUTOMÁTICAS
// ============================================================
// Cada una tiene un "fingerprint" que cambia si el contexto cambia,
// haciéndola reaparecer tras un descarte local.
export function generateAutoAlerts(ingresos, gastos, tramos, cuotaActual = 294) {
  const alerts = [];
  const now = new Date();

  // ---- 1. Facturas vencidas sin cobrar ----
  const vencidas = ingresos.filter(r => r.fields["Estado"] === "Vencida");
  if (vencidas.length > 0) {
    const importe = vencidas.reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0);
    // Huella: cantidad de vencidas + importe redondeado
    const fingerprint = `${vencidas.length}-${Math.round(importe)}`;
    alerts.push({
      id: "auto-vencidas",
      source: "auto",
      fingerprint,
      tipo: "Factura Vencida",
      prioridad: "Alta",
      titulo: `${vencidas.length} factura${vencidas.length > 1 ? "s" : ""} vencida${vencidas.length > 1 ? "s" : ""}`,
      mensaje: `Tienes ${vencidas.length} factura${vencidas.length > 1 ? "s" : ""} sin cobrar por un importe total de ${fmt(importe)}. Considera contactar con los clientes o iniciar el proceso de reclamación.`,
      fecha: hoy()
    });
  }

  // ---- 2. Cierre de IVA trimestral próximo ----
  const limites = [
    { tri: "Q1", date: new Date(now.getFullYear(), 3, 20) },
    { tri: "Q2", date: new Date(now.getFullYear(), 6, 20) },
    { tri: "Q3", date: new Date(now.getFullYear(), 9, 20) },
    { tri: "Q4", date: new Date(now.getFullYear() + 1, 0, 30) }
  ];

  for (const lim of limites) {
    const diasRestantes = Math.floor((lim.date - now) / 86400000);
    if (diasRestantes >= 0 && diasRestantes <= 10) {
      const ivaR = ingresos
        .filter(r => r.fields["Fecha"] && getTrimestre(r.fields["Fecha"]) === lim.tri)
        .reduce((s, r) => s + (r.fields["IVA (€)"] || 0), 0);
      const ivaS = gastos
        .filter(r => r.fields["Fecha"] && getTrimestre(r.fields["Fecha"]) === lim.tri)
        .reduce((s, r) => s + (r.fields["IVA Soportado (€)"] || 0), 0);
      const aIngresar = ivaR - ivaS;

      // Huella: trimestre + días restantes redondeados a bucket de 3 días
      const bucket = Math.floor(diasRestantes / 3);
      const fingerprint = `${lim.tri}-${bucket}`;

      alerts.push({
        id: `auto-iva-${lim.tri}`,
        source: "auto",
        fingerprint,
        tipo: "IVA Trimestre",
        prioridad: diasRestantes <= 3 ? "Alta" : "Media",
        titulo: `Cierre IVA ${lim.tri} en ${diasRestantes} día${diasRestantes !== 1 ? "s" : ""}`,
        mensaje: `El plazo del modelo 303 para ${lim.tri} cierra el ${lim.date.toLocaleDateString("es-ES")}. Importe a ingresar estimado: ${fmt(aIngresar)} (IVA repercutido ${fmt(ivaR)} − IVA soportado ${fmt(ivaS)}).`,
        fecha: lim.date.toLocaleDateString("es-ES")
      });
      break;
    }
  }

  // ---- 3. Cuota de autónomos descalibrada ----
  if (tramos && tramos.length > 0) {
    const tI = ingresos.reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0);
    const tG = gastos.reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0);
    const ms = Math.max(now.getMonth() + 1, 1);
    const rn = ((tI - tG - (cuotaActual * ms)) * 0.93) / ms;

    const td = tramos.map(r => ({
      tramo: r.fields["Tramo"] || 0,
      min: r.fields["Rend. Neto Mín"] || r.fields["Rend Neto Min"] || 0,
      max: r.fields["Rend. Neto Máx"] || r.fields["Rend Neto Max"] || 0,
      cuota: r.fields["Cuota Mínima"] || r.fields["Cuota Minima"] || 0
    })).sort((a, b) => a.tramo - b.tramo);

    const tr = rn <= 0
      ? td[0]
      : (td.find(t => rn >= t.min && rn < t.max) || td[0]);

    if (tr) {
      const diff = tr.cuota - cuotaActual;
      if (Math.abs(diff) > 20) {
        // Huella: cuota actual + tramo sugerido. Si la cuota cambia o el tramo cambia, reaparece.
        const fingerprint = `${cuotaActual}-${tr.tramo}`;

        alerts.push({
          id: "auto-cuota",
          source: "auto",
          fingerprint,
          tipo: "Cuota Autónomos",
          prioridad: diff > 50 ? "Alta" : "Media",
          titulo: diff > 0 ? "Pagas menos cuota de la que toca" : "Pagas más cuota de la que toca",
          mensaje: diff > 0
            ? `Según tu rendimiento neto (${fmt(rn)}/mes) deberías estar en el tramo ${tr.tramo} con cuota de ${fmt(tr.cuota)}/mes. Pagas ${fmt(cuotaActual)}, faltan ${fmt(diff)}/mes que se acumulan como deuda.`
            : `Según tu rendimiento (${fmt(rn)}/mes) podrías bajar al tramo ${tr.tramo} con cuota de ${fmt(tr.cuota)}/mes y ahorrar ${fmt(Math.abs(diff))}/mes.`,
          fecha: hoy()
        });
      }
    }
  }

  return alerts;
}

// ============================================================
// CONVERTIR ALERTA DE AIRTABLE A FORMATO INTERNO
// ============================================================
export function airtableToAlert(record) {
  return {
    id: record.id,
    source: "airtable",
    tipo: record.fields["Tipo"] || "Manual",
    prioridad: record.fields["Prioridad"] || "Media",
    titulo: record.fields["Título"] || "Sin título",
    mensaje: record.fields["Mensaje"] || "",
    fechaHora: record.fields["Fecha y Hora"] || null,
    fecha: record.fields["Fecha y Hora"]
      ? new Date(record.fields["Fecha y Hora"]).toLocaleString("es-ES")
      : "",
    mostrada: record.fields["Mostrada"] === true
  };
}

// ============================================================
// ALERTAS PENDIENTES PARA LA CAMPANITA Y EL DROPDOWN
// ============================================================
// Devuelve las alertas activas + no descartadas localmente + no marcadas
// como mostradas en Airtable. Este es el contador "real" de la campana.
export function getPendingAlertsForBell(alertasAirtable, autoAlerts) {
  const now = new Date();

  // Manuales: no mostradas y con fecha <= ahora
  const manualPending = alertasAirtable
    .map(airtableToAlert)
    .filter(a => {
      if (a.mostrada) return false;
      if (!a.fechaHora) return false;
      return new Date(a.fechaHora) <= now;
    });

  // Automáticas: no descartadas localmente
  const autoPending = autoAlerts.filter(
    a => !isAutoAlertDismissed(a.id, a.fingerprint)
  );

  return [...manualPending, ...autoPending];
}

// ============================================================
// ALERTAS PARA EL POP-UP (sólo prioridad Alta + no mostradas hoy)
// ============================================================
const POPUP_SHOWN_KEY = "ga_popup_shown_date";

export function getPendingPopupAlerts(alertasAirtable, autoAlerts) {
  const today = new Date().toISOString().slice(0, 10);
  let lastShown;
  try { lastShown = localStorage.getItem(POPUP_SHOWN_KEY); } catch { lastShown = null; }

  // Si ya lo mostramos hoy, no volver a mostrar
  if (lastShown === today) return [];

  const pending = getPendingAlertsForBell(alertasAirtable, autoAlerts);
  // Filtramos sólo las de prioridad Alta
  return pending.filter(a => a.prioridad === "Alta");
}

export function markPopupShownToday() {
  try {
    localStorage.setItem(POPUP_SHOWN_KEY, new Date().toISOString().slice(0, 10));
  } catch {}
}

// ============================================================
// COLOR / EMOJI
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
// COMPONENTE PRINCIPAL
// ============================================================
export default function AlertasView({ alertas, ingresos, gastos, tramos, onRefresh }) {
  const { isMobile, formColumns } = useResponsive();

  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [delId, setDelId] = useState(null);
  const [markingId, setMarkingId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [err, setErr] = useState("");

  const fechaPorDefecto = (() => {
    const d = new Date();
    d.setHours(d.getHours() + 1);
    d.setMinutes(0);
    return d.toISOString().slice(0, 16);
  })();

  const [form, setForm] = useState({
    titulo: "",
    mensaje: "",
    fechaHora: fechaPorDefecto,
    prioridad: "Media"
  });

  // Leer cuota actual para generar alerta de cuota autónomos
  const cuotaActual = (() => {
    try { return Number(localStorage.getItem("ga_cuota")) || 294; } catch { return 294; }
  })();

  // Automáticas (todas, sin filtrar descartadas — aquí mostramos el estado completo)
  const autoAlertsAll = useMemo(() => {
    return generateAutoAlerts(ingresos, gastos, tramos, cuotaActual);
  }, [ingresos, gastos, tramos, cuotaActual]);

  // Saber cuáles están descartadas para mostrarlas en gris
  const autoAlertsConEstado = useMemo(() => {
    return autoAlertsAll.map(a => ({
      ...a,
      dismissed: isAutoAlertDismissed(a.id, a.fingerprint)
    }));
  }, [autoAlertsAll]);

  // Manuales ordenadas
  const manualAlerts = useMemo(() => {
    return alertas.map(airtableToAlert).sort((a, b) => {
      if (!a.fechaHora) return 1;
      if (!b.fechaHora) return -1;
      return new Date(b.fechaHora) - new Date(a.fechaHora);
    });
  }, [alertas]);

  // ============================================================
  // ACCIONES
  // ============================================================
  const guardar = async () => {
    if (!form.titulo.trim()) {
      setErr("El título es obligatorio");
      return;
    }
    setErr("");
    setSaving(true);

    try {
      const fields = {
        "Título": form.titulo.trim(),
        "Mensaje": form.mensaje.trim(),
        "Tipo": "Manual",
        "Prioridad": form.prioridad,
        "Mostrada": false
      };
      if (form.fechaHora) {
        fields["Fecha y Hora"] = new Date(form.fechaHora).toISOString();
      }

      await createRecord("Alertas", fields);
      setForm({ titulo: "", mensaje: "", fechaHora: fechaPorDefecto, prioridad: "Media" });
      setShowAdd(false);
      await onRefresh();
    } catch (e) {
      setErr("Error al guardar: " + e.message);
    }
    setSaving(false);
  };

  const borrar = async (id) => {
    if (!confirm("¿Borrar esta alerta?")) return;
    setDelId(id);
    try {
      await deleteRecord("Alertas", id);
      await onRefresh();
    } catch (e) {
      alert("Error al borrar: " + e.message);
    }
    setDelId(null);
  };

  const reactivarManual = async (id) => {
    setDelId(id);
    try {
      await updateRecord("Alertas", id, { "Mostrada": false });
      await onRefresh();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setDelId(null);
  };

  const marcarLeidaManual = async (id) => {
    setMarkingId(id);
    try {
      await updateRecord("Alertas", id, { "Mostrada": true });
      await onRefresh();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setMarkingId(null);
  };

  const marcarLeidaAuto = (alerta) => {
    dismissAutoAlert(alerta.id, alerta.fingerprint);
    // Como no hay llamada a Airtable, forzamos un refresh del estado local
    onRefresh();
  };

  const reactivarAuto = (alerta) => {
    const all = readDismissed();
    delete all[alerta.id];
    writeDismissed(all);
    onRefresh();
  };

  const marcarTodasLeidas = async () => {
    setMarkingAll(true);
    try {
      // Manuales pendientes con fecha pasada
      const now = new Date();
      const manualesPendientes = manualAlerts.filter(a =>
        !a.mostrada && a.fechaHora && new Date(a.fechaHora) <= now
      );
      for (const a of manualesPendientes) {
        await updateRecord("Alertas", a.id, { "Mostrada": true });
      }

      // Automáticas pendientes
      const autoPendientes = autoAlertsConEstado.filter(a => !a.dismissed);
      for (const a of autoPendientes) {
        dismissAutoAlert(a.id, a.fingerprint);
      }

      await onRefresh();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setMarkingAll(false);
  };

  // Contadores
  const totalPendientes =
    manualAlerts.filter(a => !a.mostrada && a.fechaHora && new Date(a.fechaHora) <= new Date()).length +
    autoAlertsConEstado.filter(a => !a.dismissed).length;

  // ============================================================
  // RENDER ITEM
  // ============================================================
  const renderItem = (a, isAuto, isDismissed = false) => {
    const color = colorForPriority(a.prioridad);
    const emoji = emojiForType(a.tipo);
    const leida = isAuto ? isDismissed : a.mostrada;
    const isMarking = isAuto ? false : markingId === a.id;

    return (
      <div
        key={a.id}
        style={{
          background: B.card,
          backdropFilter: "blur(14px)",
          borderRadius: 10,
          padding: 18,
          border: `1px solid ${B.border}`,
          borderLeft: `4px solid ${color}`,
          opacity: leida ? 0.55 : 1
        }}
      >
        <div style={{
          display: "flex",
          gap: 14,
          alignItems: "flex-start",
          flexWrap: "wrap"
        }}>
          <div style={{ fontSize: 24 }}>{emoji}</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{
              fontSize: 11,
              color: color,
              fontWeight: 700,
              fontFamily: B.tM,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap"
            }}>
              <span>{a.tipo}</span>
              <span style={{ color: B.muted }}>·</span>
              <span style={{ color: B.muted }}>{a.prioridad}</span>
              {isAuto && (
                <>
                  <span style={{ color: B.muted }}>·</span>
                  <span style={{
                    color: B.purple,
                    background: B.purple + "15",
                    padding: "2px 6px",
                    borderRadius: 3
                  }}>
                    AUTO
                  </span>
                </>
              )}
              {leida && (
                <>
                  <span style={{ color: B.muted }}>·</span>
                  <span style={{ color: B.muted }}>LEÍDA</span>
                </>
              )}
            </div>
            <div style={{
              fontSize: 15,
              fontWeight: 700,
              color: B.text,
              marginTop: 4,
              fontFamily: B.tS
            }}>
              {a.titulo}
            </div>
            {a.mensaje && (
              <div style={{
                fontSize: 13,
                color: B.muted,
                marginTop: 6,
                fontFamily: B.tS,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap"
              }}>
                {a.mensaje}
              </div>
            )}
            {a.fecha && (
              <div style={{
                fontSize: 11,
                color: B.muted,
                marginTop: 8,
                fontFamily: B.tM
              }}>
                {a.fecha}
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {!leida && (
              <button
                onClick={() => isAuto ? marcarLeidaAuto(a) : marcarLeidaManual(a.id)}
                disabled={isMarking}
                style={{
                  ...B.btnSm,
                  background: color,
                  opacity: isMarking ? 0.5 : 1
                }}
              >
                {isMarking ? "..." : "MARCAR LEÍDA"}
              </button>
            )}
            {leida && (
              <button
                onClick={() => isAuto ? reactivarAuto(a) : reactivarManual(a.id)}
                disabled={delId === a.id}
                style={{
                  ...B.btnSm,
                  background: "transparent",
                  color: B.purple,
                  border: `1px solid ${B.purple}`
                }}
              >
                REACTIVAR
              </button>
            )}
            {!isAuto && (
              <button
                onClick={() => borrar(a.id)}
                disabled={delId === a.id}
                style={{ ...B.btnDel, opacity: delId === a.id ? 0.5 : 1 }}
              >
                BORRAR
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SectionHeader
        title="Alertas"
        action={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {totalPendientes > 1 && (
              <button
                onClick={marcarTodasLeidas}
                disabled={markingAll}
                style={{
                  ...B.btnSm,
                  background: "transparent",
                  color: B.muted,
                  border: `1px solid ${B.border}`,
                  opacity: markingAll ? 0.5 : 1
                }}
              >
                {markingAll ? "..." : `MARCAR TODAS (${totalPendientes})`}
              </button>
            )}
            <button onClick={() => setShowAdd(!showAdd)} style={B.btn}>
              {showAdd ? "CANCELAR" : "+ NUEVA ALERTA"}
            </button>
          </div>
        }
      />

      {showAdd && (
        <Card style={{ border: `2px solid ${B.purple}` }}>
          <Lbl>Programar Alerta Manual</Lbl>
          <ErrorBox>{err}</ErrorBox>
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${formColumns}, 1fr)`,
            gap: 14,
            marginTop: 14
          }}>
            <div style={{ gridColumn: formColumns === 1 ? "auto" : "span 2" }}>
              <Inp
                label="Título"
                value={form.titulo}
                onChange={v => setForm({ ...form, titulo: v })}
                ph="Ej: Pagar autónomos"
              />
            </div>
            <Inp
              label="Fecha y Hora"
              value={form.fechaHora}
              onChange={v => setForm({ ...form, fechaHora: v })}
              type="datetime-local"
            />
            <Sel
              label="Prioridad"
              value={form.prioridad}
              onChange={v => setForm({ ...form, prioridad: v })}
              options={["Alta", "Media", "Baja"]}
            />
            <div style={{ gridColumn: formColumns === 1 ? "auto" : "span 2" }}>
              <TxtArea
                label="Mensaje"
                value={form.mensaje}
                onChange={v => setForm({ ...form, mensaje: v })}
                ph="Detalles de la alerta..."
                rows={3}
              />
            </div>
          </div>
          <button
            onClick={guardar}
            disabled={saving}
            style={{ ...B.btn, width: "100%", marginTop: 16, opacity: saving ? 0.5 : 1 }}
          >
            {saving ? "GUARDANDO..." : "GUARDAR ALERTA"}
          </button>
        </Card>
      )}

      {/* Resumen */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)",
        gap: 12
      }}>
        <div style={{
          background: B.card,
          padding: "14px 16px",
          borderRadius: 8,
          border: `1px solid ${B.border}`
        }}>
          <div style={{ fontSize: 11, color: B.muted, fontFamily: B.tM, textTransform: "uppercase" }}>
            Automáticas
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: B.tM, color: B.purple }}>
            {autoAlertsConEstado.length}
          </div>
        </div>
        <div style={{
          background: B.card,
          padding: "14px 16px",
          borderRadius: 8,
          border: `1px solid ${B.border}`
        }}>
          <div style={{ fontSize: 11, color: B.muted, fontFamily: B.tM, textTransform: "uppercase" }}>
            Manuales
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: B.tM, color: B.text }}>
            {manualAlerts.length}
          </div>
        </div>
        {!isMobile && (
          <div style={{
            background: B.card,
            padding: "14px 16px",
            borderRadius: 8,
            border: `1px solid ${B.border}`
          }}>
            <div style={{ fontSize: 11, color: B.muted, fontFamily: B.tM, textTransform: "uppercase" }}>
              Pendientes
            </div>
            <div style={{
              fontSize: 22,
              fontWeight: 700,
              fontFamily: B.tM,
              color: totalPendientes > 0 ? B.amber : B.green
            }}>
              {totalPendientes}
            </div>
          </div>
        )}
      </div>

      {/* Automáticas */}
      {autoAlertsConEstado.length > 0 && (
        <>
          <Lbl>Automáticas (calculadas en vivo)</Lbl>
          {autoAlertsConEstado.map(a => renderItem(a, true, a.dismissed))}
        </>
      )}

      {/* Manuales */}
      {manualAlerts.length > 0 && (
        <>
          <Lbl>Programadas por ti</Lbl>
          {manualAlerts.map(a => renderItem(a, false))}
        </>
      )}

      {autoAlertsConEstado.length === 0 && manualAlerts.length === 0 && (
        <Card>
          <p style={{ color: B.muted, fontFamily: B.tS, margin: 0 }}>
            No hay alertas activas. Todo está bajo control. 🎉
          </p>
        </Card>
      )}
    </div>
  );
}
