// src/components/Alertas.jsx
// Alertas manuales (Airtable) + automáticas (calculadas en vivo, descartables localmente).
// REDISEÑO 2026 paleta marca. LÓGICA INTACTA: huellas digitales, fingerprints, generateAutoAlerts.

import { useState, useMemo } from "react";
import {
  Plus, X, Bell, Pin, Sparkles, AlertTriangle, ShieldCheck,
  Calendar as CalendarIcon, Check, CheckCheck, RotateCcw, Trash2
} from "lucide-react";

import { B, fmt, hoy, getTrimestre } from "../utils.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { createRecord, updateRecord, deleteRecord } from "../api.js";
import {
  Card, Lbl, Inp, Sel, TxtArea, PageHeader, Btn, IconPill, ErrorBox
} from "./UI.jsx";

// ============================================================
// GESTIÓN DE DESCARTES LOCALES (LÓGICA INTACTA)
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

export function markAutoDismissed(alertId, fingerprint) {
  const current = loadDismissed();
  current[alertId] = { fingerprint, dismissedAt: new Date().toISOString() };
  saveDismissed(current);
}

function isAutoDismissed(alertId, currentFingerprint) {
  const dismissed = loadDismissed();
  const entry = dismissed[alertId];
  if (!entry) return false;
  return entry.fingerprint === currentFingerprint;
}

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
// GENERAR ALERTAS AUTOMÁTICAS (LÓGICA FISCAL INTACTA)
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
// HELPERS PÚBLICOS (LÓGICA INTACTA)
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

export function getPendingAlerts(alertasAirtable, autoAlerts) {
  const now = new Date();
  const manualPending = (alertasAirtable || [])
    .map(airtableToAlert)
    .filter(a => {
      if (a.mostrada) return false;
      if (a.fechaHora) {
        return new Date(a.fechaHora) <= now;
      }
      return true;
    });
  return [...manualPending, ...autoAlerts];
}

export async function markManualRead(recordId) {
  await updateRecord("Alertas", recordId, { "Mostrada": true });
}

export async function markAlertAsRead(alert) {
  if (alert.source === "auto") {
    markAutoDismissed(alert.id, alert.fingerprint);
  } else {
    await markManualRead(alert.id);
  }
}

// ============================================================
// HELPERS DE PRESENTACIÓN — PALETA MARCA
// ============================================================
function bordeForPriority(p) {
  // Sin verde/rojo/ámbar. Negro = urgente, amarillo = atención, gris = informativa.
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

  const cuotaActual = (() => {
    try { return Number(localStorage.getItem("ga_cuota")) || 294; } catch { return 294; }
  })();

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

  const autoAlertsAll = useMemo(() => {
    return generateAutoAlerts(ingresos, gastos, tramos, cuotaActual, { ignoreDismissed: true });
  }, [ingresos, gastos, tramos, cuotaActual]);

  const dismissedMap = loadDismissed();
  const autoAlertsWithStatus = autoAlertsAll.map(a => ({
    ...a,
    descartadaLocal: dismissedMap[a.id]?.fingerprint === a.fingerprint
  }));

  const manualAlerts = useMemo(() => {
    return (alertas || []).map(airtableToAlert).sort((a, b) => {
      if (!a.fechaHora) return 1;
      if (!b.fechaHora) return -1;
      return new Date(b.fechaHora) - new Date(a.fechaHora);
    });
  }, [alertas]);

  // ============================================================
  // ACCIONES (LÓGICA INTACTA)
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
    const current = loadDismissed();
    delete current[alertId];
    saveDismissed(current);
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
      await Promise.all(pendientesManual.map(a => markManualRead(a.id)));
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
    const Icon = iconForType(a.tipo);
    const borderColor = bordeForPriority(a.prioridad);
    const isRead = isAuto ? a.descartadaLocal : a.mostrada;
    const isMarking = markingId === a.id;

    return (
      <div
        key={a.id}
        style={{
          background: B.surface,
          borderRadius: 16,
          border: `1px solid ${B.border}`,
          borderLeft: `4px solid ${borderColor}`,
          padding: "16px 18px",
          opacity: isRead ? 0.55 : 1,
          transition: "opacity 0.2s ease"
        }}
      >
        <div style={{
          display: "flex",
          gap: 14,
          alignItems: "flex-start",
          flexWrap: "wrap"
        }}>
          <IconPill icon={Icon} size={36} />

          <div style={{ flex: 1, minWidth: 200 }}>
            {/* Meta chips */}
            <div style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 6
            }}>
              <span style={{
                fontSize: 10,
                color: B.ink,
                fontWeight: 600,
                fontFamily: B.font,
                textTransform: "uppercase",
                letterSpacing: "0.08em"
              }}>
                {a.tipo}
              </span>
              <span style={{ color: B.muted, fontSize: 10 }}>·</span>
              <span style={{
                fontSize: 10,
                color: B.muted,
                fontWeight: 600,
                fontFamily: B.font,
                textTransform: "uppercase",
                letterSpacing: "0.08em"
              }}>
                {a.prioridad}
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
              {isRead && (
                <span style={{
                  background: B.border,
                  color: B.muted,
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 600,
                  fontFamily: B.font,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em"
                }}>
                  Leída
                </span>
              )}
            </div>

            {/* Título */}
            <div style={{
              fontSize: 16,
              fontWeight: 700,
              color: B.ink,
              fontFamily: B.font,
              letterSpacing: "-0.015em",
              lineHeight: 1.3
            }}>
              {a.titulo}
            </div>

            {/* Mensaje */}
            {a.mensaje && (
              <div style={{
                fontSize: 13,
                color: B.muted,
                marginTop: 6,
                fontFamily: B.font,
                lineHeight: 1.55,
                whiteSpace: "pre-wrap"
              }}>
                {a.mensaje}
              </div>
            )}

            {/* Fecha */}
            {a.fecha && (
              <div style={{
                fontSize: 11,
                color: B.muted,
                marginTop: 10,
                fontFamily: B.font,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                ...B.num
              }}>
                <CalendarIcon size={11} strokeWidth={2} />
                {a.fecha}
              </div>
            )}
          </div>

          {/* Acciones */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
            {!isRead && (
              <Btn
                size="sm"
                variant="outline"
                onClick={() => marcarLeida(a)}
                disabled={isMarking}
                icon={Check}
                iconBefore
              >
                {isMarking ? "…" : "Leída"}
              </Btn>
            )}
            {isRead && !isAuto && (
              <Btn
                size="sm"
                variant="outline"
                onClick={() => reactivar(a.id)}
                disabled={isMarking}
                icon={RotateCcw}
                iconBefore
              >
                Reactivar
              </Btn>
            )}
            {isRead && isAuto && (
              <Btn
                size="sm"
                variant="outline"
                onClick={() => reactivarAuto(a.id)}
                icon={RotateCcw}
                iconBefore
              >
                Reactivar
              </Btn>
            )}
            {!isAuto && (
              <Btn
                size="sm"
                variant="ghost"
                onClick={() => borrar(a.id)}
                disabled={delId === a.id}
                icon={Trash2}
                iconBefore
                style={{ color: B.muted }}
              >
                {delId === a.id ? "…" : "Borrar"}
              </Btn>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // RENDER PRINCIPAL
  // ============================================================
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <PageHeader
        title="Alertas."
        subtitle="Recordatorios automáticos de Hacienda y los que tú programas."
        action={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {totalPendientes > 1 && (
              <Btn
                onClick={marcarTodasLeidas}
                disabled={markingAll}
                variant="outline"
                icon={CheckCheck}
                iconBefore
              >
                {markingAll ? "…" : `Marcar ${totalPendientes} leídas`}
              </Btn>
            )}
            <Btn
              onClick={() => setShowAdd(!showAdd)}
              icon={showAdd ? X : Plus}
              iconBefore
              variant={showAdd ? "outline" : "primary"}
            >
              {showAdd ? "Cancelar" : "Nueva alerta"}
            </Btn>
          </div>
        }
      />

      {/* FORMULARIO NUEVA ALERTA */}
      {showAdd && (
        <Card style={{ border: `1px solid ${B.ink}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <IconPill icon={Pin} size={28} />
            <Lbl>Programar alerta manual</Lbl>
          </div>
          {err && <div style={{ marginBottom: 14 }}><ErrorBox>{err}</ErrorBox></div>}
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${formColumns}, 1fr)`,
            gap: 14
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
              label="Fecha y hora"
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
                ph="Detalles de la alerta…"
                rows={3}
              />
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <Btn
              onClick={guardar}
              disabled={saving}
              icon={Check}
              iconBefore
              style={{ width: "100%" }}
            >
              {saving ? "Guardando…" : "Guardar alerta"}
            </Btn>
          </div>
        </Card>
      )}

      {/* RESUMEN — 3 KPIs */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)",
        gap: 12
      }}>
        <Card>
          <IconPill icon={Bell} />
          <div style={{ marginTop: 14 }}>
            <Lbl>Pendientes</Lbl>
          </div>
          <div style={{
            fontSize: B.ty.numL,
            fontWeight: 700,
            marginTop: 6,
            color: B.ink,
            letterSpacing: "-0.02em",
            fontFamily: B.font,
            ...B.num
          }}>
            {totalPendientes}
          </div>
          <div style={{ fontSize: B.ty.small, color: B.muted, marginTop: 4, fontFamily: B.font }}>
            Sin leer
          </div>
        </Card>

        <Card>
          <IconPill icon={Sparkles} />
          <div style={{ marginTop: 14 }}>
            <Lbl>Automáticas</Lbl>
          </div>
          <div style={{
            fontSize: B.ty.numL,
            fontWeight: 700,
            marginTop: 6,
            color: B.ink,
            letterSpacing: "-0.02em",
            fontFamily: B.font,
            ...B.num
          }}>
            {autoAlertsWithStatus.length}
          </div>
          <div style={{ fontSize: B.ty.small, color: B.muted, marginTop: 4, fontFamily: B.font }}>
            Calculadas en vivo
          </div>
        </Card>

        {!isMobile && (
          <Card>
            <IconPill icon={Pin} />
            <div style={{ marginTop: 14 }}>
              <Lbl>Manuales</Lbl>
            </div>
            <div style={{
              fontSize: B.ty.numL,
              fontWeight: 700,
              marginTop: 6,
              color: B.ink,
              letterSpacing: "-0.02em",
              fontFamily: B.font,
              ...B.num
            }}>
              {manualAlerts.length}
            </div>
            <div style={{ fontSize: B.ty.small, color: B.muted, marginTop: 4, fontFamily: B.font }}>
              Programadas por ti
            </div>
          </Card>
        )}
      </div>

      {/* SECCIÓN AUTOMÁTICAS */}
      {autoAlertsWithStatus.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Lbl>Automáticas (calculadas en vivo)</Lbl>
          {autoAlertsWithStatus.map(a => renderItem(a, true))}
        </div>
      )}

      {/* SECCIÓN MANUALES */}
      {manualAlerts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Lbl>Programadas por ti</Lbl>
          {manualAlerts.map(a => renderItem(a, false))}
        </div>
      )}

      {/* VACÍO */}
      {autoAlertsWithStatus.length === 0 && manualAlerts.length === 0 && (
        <Card>
          <p style={{ color: B.muted, fontFamily: B.font, margin: 0, fontSize: 14 }}>
            No hay alertas activas. Todo está bajo control.
          </p>
        </Card>
      )}
    </div>
  );
}
