// src/components/GastosFijos.jsx
// Vista de Gastos Fijos: listado con activos primero, baja al final.
// Muestra importe medio, total acumulado y nº de pagos por cada uno.
// Permite editar datos y dar de baja (mantiene historial fiscal).

import { useState } from "react";
import { B, fmt, hoy } from "../utils.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { updateRecord, deleteRecord } from "../api.js";
import { Card, Lbl, Inp, Sel, SectionHeader, ErrorBox } from "./UI.jsx";

const PERIODICIDADES = ["Mensual", "Trimestral", "Anual"];
const MONEDAS = ["EUR", "USD", "GBP"];

export default function GastosFijos({ gastosFijos, gastos, onRefresh }) {
  const { formColumns } = useResponsive();
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [bajaModal, setBajaModal] = useState(null);
  const [showInactivos, setShowInactivos] = useState(false);
  const [err, setErr] = useState("");

  // Calcular estadísticas por gasto fijo
  const enriquecer = (gf) => {
    const gastosLink = gf.fields["Gastos"] || [];
    const gastosVinculados = gastos.filter(g => gastosLink.includes(g.id));
    const totalPagado = gastosVinculados.reduce((s, g) =>
      s + (g.fields["Base Imponible"] || 0) + (g.fields["IVA Soportado (€)"] || 0), 0);
    const numPagos = gastosVinculados.length;
    const ultimaFecha = gastosVinculados
      .map(g => g.fields["Fecha"])
      .filter(Boolean)
      .sort()
      .pop() || null;
    const importeMedio = numPagos > 0 ? totalPagado / numPagos : (gf.fields["Importe Medio"] || 0);

    return {
      ...gf,
      _stats: {
        totalPagado,
        numPagos,
        ultimaFecha,
        importeMedio
      }
    };
  };

  const enriquecidos = gastosFijos.map(enriquecer);
  const activos = enriquecidos.filter(g => g.fields["Activa"] === "Sí" || !g.fields["Activa"]);
  const inactivos = enriquecidos.filter(g => g.fields["Activa"] === "No");

  // Total prorrateado mensual de todos los activos
  const totalMensualActivos = activos.reduce((s, gf) => {
    const importe = gf.fields["Importe Medio"] || 0;
    const p = gf.fields["Periodicidad"];
    return s + (p === "Mensual" ? importe : p === "Trimestral" ? importe / 3 : p === "Anual" ? importe / 12 : 0);
  }, 0);

  // ============================================================
  // EDICIÓN
  // ============================================================
  const startEdit = (gf) => {
    setErr("");
    setEditId(gf.id);
    setEditForm({
      nombre: gf.fields["Nombre"] || "",
      proveedor: gf.fields["Proveedor"] || "",
      cifProveedor: gf.fields["CIF Proveedor"] || "",
      periodicidad: gf.fields["Periodicidad"] || "Mensual",
      importe: String(gf.fields["Importe Medio"] || ""),
      moneda: gf.fields["Moneda"] || "EUR",
      notas: gf.fields["Notas"] || ""
    });
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditForm(null);
    setErr("");
  };

  const updateField = (field, value) => {
    setEditForm(prev => prev ? { ...prev, [field]: value } : null);
  };

  const saveEdit = async () => {
    if (!editForm.nombre.trim() || !editForm.proveedor.trim()) {
      setErr("Nombre y proveedor son obligatorios");
      return;
    }
    setSavingEdit(true);
    try {
      const fields = {
        "Nombre": editForm.nombre.trim(),
        "Proveedor": editForm.proveedor.trim(),
        "Periodicidad": editForm.periodicidad,
        "Importe Medio": Number(editForm.importe) || 0,
        "Moneda": editForm.moneda
      };
      if (editForm.cifProveedor.trim()) fields["CIF Proveedor"] = editForm.cifProveedor.trim();
      if (editForm.notas.trim()) fields["Notas"] = editForm.notas.trim();

      await updateRecord("Gastos Fijos", editId, fields);
      cancelEdit();
      await onRefresh();
    } catch (e) {
      setErr("Error al guardar: " + e.message);
    }
    setSavingEdit(false);
  };

  // ============================================================
  // DAR DE BAJA / REACTIVAR
  // ============================================================
  const confirmarBaja = async () => {
    const { id, accion } = bajaModal;
    try {
      const fields = {
        "Activa": accion === "baja" ? "No" : "Sí"
      };
      if (accion === "baja") {
        fields["Fecha Baja"] = hoy();
      }
      await updateRecord("Gastos Fijos", id, fields);
      setBajaModal(null);
      await onRefresh();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  // ============================================================
  // RENDER DE CADA TARJETA
  // ============================================================
  const renderGastoFijo = (gf, esActivo) => {
    const stats = gf._stats;
    const periodicidad = gf.fields["Periodicidad"] || "Mensual";
    const importeMedio = gf.fields["Importe Medio"] || 0;
    const moneda = gf.fields["Moneda"] || "EUR";
    const fechaAlta = gf.fields["Fecha Alta"];
    const fechaBaja = gf.fields["Fecha Baja"];
    const notas = gf.fields["Notas"];

    const importeMensual =
      periodicidad === "Mensual" ? importeMedio :
      periodicidad === "Trimestral" ? importeMedio / 3 :
      periodicidad === "Anual" ? importeMedio / 12 : 0;

    return (
      <div key={gf.id} style={{
        padding: 16,
        background: esActivo ? "rgba(0,0,0,0.03)" : "rgba(220,38,38,0.04)",
        border: esActivo ? `1px solid ${B.border}` : `1px solid ${B.red}30`,
        borderRadius: 10,
        marginBottom: 10,
        opacity: esActivo ? 1 : 0.78
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap"
        }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{
              fontWeight: 700,
              fontSize: 15,
              fontFamily: B.tS,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap"
            }}>
              <span style={{ fontSize: 16 }}>🔄</span>
              {gf.fields["Nombre"] || gf.fields["Proveedor"] || "Sin nombre"}
              {!esActivo && (
                <span style={{
                  background: B.red + "15",
                  color: B.red,
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: B.tM,
                  textTransform: "uppercase"
                }}>
                  Dado de baja
                </span>
              )}
            </div>

            <div style={{ fontSize: 12, color: B.muted, marginTop: 4, fontFamily: B.tS }}>
              <span style={{ fontWeight: 600 }}>{gf.fields["Proveedor"] || "—"}</span>
              {gf.fields["CIF Proveedor"] && <span> · CIF: {gf.fields["CIF Proveedor"]}</span>}
            </div>

            <div style={{ fontSize: 11, color: B.muted, marginTop: 6, fontFamily: B.tM }}>
              📅 {periodicidad}
              {fechaAlta && <span> · Alta: {fechaAlta}</span>}
              {fechaBaja && <span> · Baja: {fechaBaja}</span>}
            </div>

            {/* Estadísticas en chips */}
            <div style={{
              marginTop: 10,
              display: "flex",
              gap: 6,
              flexWrap: "wrap"
            }}>
              <div style={chipStyle(B.purple)}>
                💰 Importe medio: <strong>{fmt(stats.importeMedio)}</strong>
              </div>
              <div style={chipStyle(B.green)}>
                📊 Total pagado: <strong>{fmt(stats.totalPagado)}</strong>
              </div>
              <div style={chipStyle(B.text)}>
                🧾 {stats.numPagos} {stats.numPagos === 1 ? "pago" : "pagos"}
              </div>
              {stats.ultimaFecha && (
                <div style={chipStyle(B.muted)}>
                  ⏰ Último: {stats.ultimaFecha}
                </div>
              )}
            </div>

            {notas && (
              <div style={{
                marginTop: 8,
                padding: "6px 10px",
                background: B.yellow + "33",
                borderRadius: 6,
                fontSize: 12,
                color: B.text,
                fontFamily: B.tS,
                fontStyle: "italic"
              }}>
                📝 {notas}
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <div style={{ fontWeight: 700, fontFamily: B.tM, fontSize: 16, color: B.text }}>
              {fmt(importeMedio)} {moneda !== "EUR" && <span style={{ fontSize: 11, color: B.muted }}>{moneda}</span>}
            </div>
            {esActivo && periodicidad !== "Mensual" && (
              <div style={{ fontSize: 11, color: B.amber, fontWeight: 600 }}>
                ≈ {fmt(importeMensual)}/mes
              </div>
            )}
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <button onClick={() => startEdit(gf)} style={iconBtnStyle(B.text)}>
                ✏️
              </button>
              {esActivo ? (
                <button
                  onClick={() => setBajaModal({ id: gf.id, nombre: gf.fields["Nombre"] || gf.fields["Proveedor"], accion: "baja" })}
                  style={iconBtnStyle(B.red)}
                  title="Dar de baja"
                >
                  ⏸
                </button>
              ) : (
                <button
                  onClick={() => setBajaModal({ id: gf.id, nombre: gf.fields["Nombre"] || gf.fields["Proveedor"], accion: "reactivar" })}
                  style={iconBtnStyle(B.green)}
                  title="Reactivar"
                >
                  ▶
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEditor = () => {
    if (!editForm) return null;
    return (
      <Card style={{ border: `2px solid ${B.purple}` }}>
        <Lbl><span style={{ color: B.purple }}>EDITAR GASTO FIJO</span></Lbl>
        <ErrorBox>{err}</ErrorBox>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${formColumns}, 1fr)`,
          gap: 14,
          marginTop: 14
        }}>
          <Inp label="Nombre" value={editForm.nombre} onChange={v => updateField("nombre", v)} ph="Ej: Canva Pro" />
          <Inp label="Proveedor" value={editForm.proveedor} onChange={v => updateField("proveedor", v)} ph="Ej: Canva" />
          <Inp label="CIF Proveedor" value={editForm.cifProveedor} onChange={v => updateField("cifProveedor", v)} ph="Opcional" />
          <Inp label="Importe Medio" value={editForm.importe} onChange={v => updateField("importe", v)} type="number" />
          <Sel label="Periodicidad" value={editForm.periodicidad} onChange={v => updateField("periodicidad", v)} options={PERIODICIDADES} />
          <Sel label="Moneda" value={editForm.moneda} onChange={v => updateField("moneda", v)} options={MONEDAS} />
        </div>
        <div style={{ marginTop: 14 }}>
          <label style={{
            fontSize: 11, fontWeight: 700, fontFamily: B.tM,
            textTransform: "uppercase", letterSpacing: "0.08em",
            color: B.muted, display: "block", marginBottom: 6
          }}>NOTAS</label>
          <textarea
            value={editForm.notas}
            onChange={e => updateField("notas", e.target.value)}
            placeholder="Cualquier detalle útil sobre este gasto fijo..."
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 6,
              border: "2px solid rgba(0,0,0,0.1)", background: "#fff", color: "#111",
              fontSize: 14, fontFamily: B.tS, outline: "none",
              boxSizing: "border-box", minHeight: 70, resize: "vertical"
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button onClick={saveEdit} disabled={savingEdit} style={{ ...B.btn, flex: 1, opacity: savingEdit ? 0.5 : 1 }}>
            {savingEdit ? "GUARDANDO..." : "GUARDAR CAMBIOS"}
          </button>
          <button onClick={cancelEdit} style={{
            ...B.btn,
            flex: 1,
            background: "transparent",
            color: B.text,
            border: `2px solid ${B.text}`
          }}>
            CANCELAR
          </button>
        </div>
      </Card>
    );
  };

  // ============================================================
  // RENDER PRINCIPAL
  // ============================================================
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <SectionHeader title="Gastos Fijos" />

      {/* EDITOR (cuando está activo) */}
      {editId && (
        <div>
          <div style={{
            fontSize: 11,
            color: B.purple,
            fontFamily: B.tM,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 6
          }}>
            ✏️ Editando gasto fijo
          </div>
          {renderEditor()}
        </div>
      )}

      {/* RESUMEN ARRIBA */}
      <div style={{ background: B.text, borderRadius: 12, padding: 24, color: "#fff" }}>
        <Lbl><span style={{ color: "rgba(255,255,255,0.6)" }}>TOTAL MENSUAL DE GASTOS FIJOS ACTIVOS</span></Lbl>
        <div style={{ fontSize: 38, fontWeight: 700, marginTop: 6, fontFamily: B.tM }}>
          {fmt(totalMensualActivos)}
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>
          {activos.length} {activos.length === 1 ? "gasto fijo activo" : "gastos fijos activos"} · prorrateados a mensual
        </div>
      </div>

      {/* ACTIVOS */}
      {activos.length > 0 ? (
        <Card>
          <Lbl>Activos ({activos.length})</Lbl>
          <div style={{ marginTop: 14 }}>
            {activos.map(gf => renderGastoFijo(gf, true))}
          </div>
        </Card>
      ) : (
        <Card>
          <p style={{ color: B.muted, fontFamily: B.tS, margin: 0, textAlign: "center", padding: "20px 0" }}>
            No tienes gastos fijos activos. Cuando añadas un gasto manual y marques la opción
            <strong> "Es un gasto fijo recurrente"</strong>, aparecerá aquí.
          </p>
        </Card>
      )}

      {/* INACTIVOS (colapsable) */}
      {inactivos.length > 0 && (
        <div>
          <button
            onClick={() => setShowInactivos(!showInactivos)}
            style={{
              ...B.btnSm,
              background: "transparent",
              color: B.muted,
              border: `1px solid ${B.border}`,
              width: "100%",
              padding: "10px 14px"
            }}
          >
            {showInactivos ? "▼" : "▶"} Dados de baja ({inactivos.length})
          </button>
          {showInactivos && (
            <Card style={{ marginTop: 10 }}>
              <div>
                {inactivos.map(gf => renderGastoFijo(gf, false))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* MODAL CONFIRMACIÓN BAJA / REACTIVAR */}
      {bajaModal && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(3px)",
          zIndex: 300,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16
        }}>
          <div style={{
            background: "#fff",
            borderRadius: 12,
            padding: 24,
            maxWidth: 440,
            width: "100%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
          }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>
              {bajaModal.accion === "baja" ? "⏸" : "▶"}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: B.tS, marginBottom: 10 }}>
              {bajaModal.accion === "baja" ? "Dar de baja" : "Reactivar"} «{bajaModal.nombre}»
            </div>
            <div style={{ fontSize: 13, color: B.muted, marginBottom: 20, lineHeight: 1.5 }}>
              {bajaModal.accion === "baja"
                ? "El gasto fijo se marcará como inactivo y no contará en el total mensual. El historial fiscal de los pagos asociados se mantiene intacto."
                : "El gasto fijo volverá a estar activo y contará en el total mensual."}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={confirmarBaja} style={{
                ...B.btn,
                background: bajaModal.accion === "baja" ? B.red : B.green,
                flex: 1
              }}>
                {bajaModal.accion === "baja" ? "DAR DE BAJA" : "REACTIVAR"}
              </button>
              <button onClick={() => setBajaModal(null)} style={{
                ...B.btn,
                background: "transparent",
                color: B.text,
                border: `2px solid ${B.text}`,
                flex: 1
              }}>
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Estilos auxiliares
function chipStyle(color) {
  return {
    padding: "4px 10px",
    background: color + "15",
    color: color,
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: B.tS
  };
}

function iconBtnStyle(color) {
  return {
    background: "transparent",
    border: `1px solid ${color}30`,
    borderRadius: 4,
    padding: "5px 9px",
    cursor: "pointer",
    fontSize: 13,
    color: color,
    transition: "all 0.15s ease"
  };
}
