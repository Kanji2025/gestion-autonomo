// src/components/Alertas.jsx
// Alertas manuales (guardadas en Airtable) + automáticas (calculadas en vivo).
// Las automáticas se pueden descartar localmente con una "huella digital".

import { useState, useMemo } from "react";
import { B, fmt, hoy, getTrimestre } from "../utils.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { createRecord, updateRecord, deleteRecord } from "../api.js";
import { Card, Lbl, Inp, Sel, SectionHeader, ErrorBox, TxtArea } from "./UI.jsx";

// ============================================================
// GESTIÓN DE DESCARTES LOCALES (para alertas automáticas)
// ============================================================
const DISMISS_KEY = "ga_auto_dismissed";

function loadDismissed() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDismissed(obj) {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify(obj));
  } catch {}
}

// Marca una alerta automática como descartada, guardando su "huella digital"
// Si más tarde la huella cambia (ej: cambias la cuota), la alerta volverá a aparecer
export function markAutoDismissed(alertId, fingerprint) {
  const current = loadDismissed();
  current[alertId] = { fingerprint, dismissedAt: new Date().toISOString() };
  saveDismissed(current);
}

// Comprueba si una alerta automática está descartada con la huella actual
function isAutoDismissed(alertId, currentFingerprint) {
  const dismissed = loadDismissed();
  const entry = dismissed[alertId];
  if (!entry) return false;
  return entry.fingerprint === currentFingerprint;
}

// Limpia entradas de descarte cuyas huellas ya no están activas (garbage collection)
export function cleanupDismissed(activeFingerprints) {
  const current = loadDismissed();
  const cleaned = {};
  for (const [id, entry] of Object.entries(current)) {
    if (activeFingerprints[id] === entry.fingerprint) {
      cleaned[id] = entry;
    }
  }
  saveDismissed(cleaned);
}

// ============================================================
// GENERAR ALERTAS AUTOMÁTICAS
// Cada alerta tiene un `fingerprint` que refleja su situación actual.
// Si la situación cambia, el fingerprint cambia y la alerta reaparece.
// ============================================================
export function generateAutoAlerts(ingresos, gastos, tramos, cuotaActual = 294, opts = {}) {
  const { ignoreDismissed = false } = opts;
  const alerts = [];
  const now = new Date();

  // ---- 1. Facturas vencidas ----
  const vencidas = ingresos.filter(r => r.fields["Estado"] === "Vencida");
  if (vencidas.length > 0) {
    const importe = vencidas.reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0);
    const fingerprint = `vencidas-${vencidas.length}-${importe.toFixed(2)}`;
    const alert = {
      id: "auto-vencidas",
      source: "auto",
      tipo: "Factura Vencida",
      prioridad: "Alta",
      titulo: `${vencidas.length} factura${vencidas.length > 1 ? "s" : ""} vencida${vencidas.length > 1 ? "s" : ""}`,
      mensaje: `Tienes ${vencidas.length} factura${vencidas.length > 1 ? "s" : ""} sin cobrar por un importe total de ${fmt(importe)}. Considera contactar con los clientes o iniciar el proceso de reclamación.`,
      fecha: hoy(),
      fingerprint
    };
    if (ignoreDismissed || !isAutoDismissed(alert.id, fingerprint)) {
      alerts.push(alert);
    }
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

      const fingerprint = `iva-${lim.tri}-${diasRestantes}-${aIngresar.toFixed(2)}`;
      const alert = {
        id: `auto-iva-${lim.tri}`,
        source: "auto",
        tipo: "IVA Trimestre",
        prioridad: diasRestantes <= 3 ? "Alta" : "Media",
        titulo: `Cierre IVA ${lim.tri} en ${diasRestantes} día${diasRestantes !== 1 ? "s" : ""}`,
        mensaje: `El plazo del modelo 303 para ${lim.tri} cierra el ${lim.date.toLocaleDateString("es-ES")}. Importe a ingresar estimado: ${fmt(aIngresar)} (IVA repercutido ${fmt(ivaR)} − IVA soportado ${fmt(ivaS)}).`,
        fecha: lim.date.toLocaleDateString("es-ES"),
        fingerprint
      };
      if (ignoreDismissed || !isAutoDismissed(alert.id, fingerprint)) {
        alerts.push(alert);
      }
      break;
    }
  }

  // ---- 3. Cuota autónomos descalibrada ----
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
        const fingerprint = `cuota-${tr.tramo}-${cuotaActual}-${tr.cuota}`;
        const alert = {
          id: "auto-cuota",
          source: "auto",
          tipo: "Cuota Autónomos",
          prioridad: diff > 50 ? "Alta" : "Media",
          titulo: diff > 0 ? "Pagas menos cuota de la que toca" : "Pagas más cuota de la que toca",
          mensaje: diff > 0
            ? `Según tu rendimiento neto (${fmt(rn)}/mes) deberías estar en el tramo ${tr.tramo} con cuota de ${fmt(tr.cuota)}/mes. Pagas ${fmt(cuotaActual)}, faltan ${fmt(diff)}/mes que se acumulan como deuda.`
            : `Según tu rendimiento (${fmt(rn)}/mes) podrías bajar al tramo ${tr.tramo} con cuota de ${fmt(tr.cuota)}/mes y ahorrar ${fmt(Math.abs(diff))}/mes.`,
          fecha: hoy(),
          fingerprint
        };
        if (ignoreDismissed || !isAutoDismissed(alert.id, fingerprint)) {
          alerts.push(alert);
        }
      }
    }
  }

  return alerts;
}

// ============================================================
// CONVERTIR ALERTAS DE AIRTABLE A FORMATO INTERNO
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
// OBTENER TODAS LAS ALERTAS PENDIENTES PARA EL CONTADOR Y EL DROPDOWN
// (manuales no leídas + automáticas activas y no descartadas)
// ============================================================
export function getPendingAlerts(alertasAirtable, autoAlerts) {
  const now = new Date();
  const manualPending = (alertasAirtable || [])
    .map(airtableToAlert)
    .filter(a => {
      if (a.mostrada) return false;
      // Si tiene fecha programada, solo si ya llegó el momento
      if (a.fechaHora) {
        return new Date(a.fechaHora) <= now;
      }
      return true;
    });

  return [...manualPending, ...autoAlerts];
}

// ============================================================
// MARCAR MANUAL COMO LEÍDA (actualiza Airtable)
// ============================================================
export async function markManualRead(recordId) {
  await updateRecord("Alertas", recordId, { "Mostrada": true });
}

// ============================================================
// MARCAR UNA ALERTA (manual o auto) COMO LEÍDA
// ============================================================
export async function markAlertAsRead(alert) {
  if (alert.source === "auto") {
    markAutoDismissed(alert.id, alert.fingerprint);
  } else {
    await markManualRead(alert.id);
  }
}

// ============================================================
// COLOR Y EMOJI
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
// COMPONENTE PRINCIPAL (VISTA DE ALERTAS EN EL MENÚ)
// ============================================================
export default function AlertasView({ alertas, ingresos, gastos, tramos, onRefresh }) {
  const { isMobile, formColumns } = useResponsive();

  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [delId, setDelId] = useState(null);
  const [markingId, setMarkingId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [err, setErr] = useState("");

  // Cuota actual (se guarda en localStorage desde la vista de Cuota Autónomos)
  const cuotaActual = (() => {
    try { return Number(localStorage.getItem("ga_cuota")) || 294; } catch { return 294; }
  })();

  // Fecha por defecto: dentro de 1 hora
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

  // Alertas automáticas: mostramos TODAS las activas (incluso las descartadas)
  // para que María pueda ver también las que ya descartó
  const autoAlertsAll = useMemo(() => {
    return generateAutoAlerts(ingresos, gastos, tramos, cuotaActual, { ignoreDismissed: true });
  }, [ingresos, gastos, tramos, cuotaActual]);

  // Saber cuáles están descartadas localmente
  const dismissedMap = loadDismissed();
  const autoAlertsWithStatus = autoAlertsAll.map(a => ({
    ...a,
    descartadaLocal: dismissedMap[a.id]?.fingerprint === a.fingerprint
  }));

  // Alertas manuales ordenadas por fecha
  const manualAlerts = useMemo(() => {
    return (alertas || []).map(airtableToAlert).sort((a, b) => {
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

  const marcarLeida = async (alert) => {
    setMarkingId(alert.id);
    try {
      await markAlertAsRead(alert);
      await onRefresh();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setMarkingId(null);
  };

  const reactivar = async (id) => {
    setMarkingId(id);
    try {
      await updateRecord("Alertas", id, { "Mostrada": false });
      await onRefresh();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setMarkingId(null);
  };

  const reactivarAuto = (alertId) => {
    // Quitar el descarte local
    const current = loadDismissed();
    delete current[alertId];
    saveDismissed(current);
    // Forzar un re-render
    onRefresh();
  };

  const marcarTodasLeidas = async () => {
    const pendientesManual = manualAlerts.filter(a => !a.mostrada);
    const pendientesAuto = autoAlertsWithStatus.filter(a => !a.descartadaLocal);
    const total = pendientesManual.length + pendientesAuto.length;

    if (total === 0) return;
    if (!confirm(`¿Marcar las ${total} alertas pendientes como leídas?`)) return;

    setMarkingAll(true);
    try {
      // Manuales: actualizar en Airtable en paralelo
      await Promise.all(pendientesManual.map(a => markManualRead(a.id)));
      // Automáticas: descartar local
      for (const a of pendientesAuto) {
        markAutoDismissed(a.id, a.fingerprint);
      }
      await onRefresh();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setMarkingAll(false);
  };

  // ============================================================
  // CONTADORES
  // ============================================================
  const pendientesManual = manualAlerts.filter(a => !a.mostrada).length;
  const pendientesAuto = autoAlertsWithStatus.filter(a => !a.descartadaLocal).length;
  const totalPendientes = pendientesManual + pendientesAuto;

  // ============================================================
  // RENDER ITEM
  // ============================================================
  const renderItem = (a, isAuto) => {
    const color = colorForPriority(a.prioridad);
    const emoji = emojiForType(a.tipo);
    const isRead = isAuto ? a.descartadaLocal : a.mostrada;
    const isMarking = markingId === a.id;

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
          opacity: isRead ? 0.55 : 1
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
              {isRead && (
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

          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
            {!isRead && (
              <button
                onClick={() => marcarLeida(a)}
                disabled={isMarking}
                style={{
                  ...B.btnSm,
                  background: "transparent",
                  color: B.green,
                  border: `1px solid ${B.green}`,
                  opacity: isMarking ? 0.5 : 1
                }}
              >
                {isMarking ? "..." : "✓ LEÍDA"}
              </button>
            )}
            {isRead && !isAuto && (
              <button
                onClick={() => reactivar(a.id)}
                disabled={isMarking}
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
            {isRead && isAuto && (
              <button
                onClick={() => reactivarAuto(a.id)}
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
                  ...B.btn,
                  background: "transparent",
                  color: B.green,
                  border: `2px solid ${B.green}`,
                  opacity: markingAll ? 0.5 : 1
                }}
              >
                {markingAll ? "..." : `✓ MARCAR ${totalPendientes} LEÍDAS`}
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
            Pendientes
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: B.tM, color: totalPendientes > 0 ? B.amber : B.green }}>
            {totalPendientes}
          </div>
        </div>
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
            {autoAlertsWithStatus.length}
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
              Manuales
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: B.tM, color: B.text }}>
              {manualAlerts.length}
            </div>
          </div>
        )}
      </div>

      {/* Sección automáticas */}
      {autoAlertsWithStatus.length > 0 && (
        <>
          <Lbl>Automáticas (calculadas en vivo)</Lbl>
          {autoAlertsWithStatus.map(a => renderItem(a, true))}
        </>
      )}

      {/* Sección manuales */}
      {manualAlerts.length > 0 && (
        <>
          <Lbl>Programadas por ti</Lbl>
          {manualAlerts.map(a => renderItem(a, false))}
        </>
      )}

      {autoAlertsWithStatus.length === 0 && manualAlerts.length === 0 && (
        <Card>
          <p style={{ color: B.muted, fontFamily: B.tS, margin: 0 }}>
            No hay alertas activas. Todo está bajo control. 🎉
          </p>
        </Card>
      )}
    </div>
  );
}
