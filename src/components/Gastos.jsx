// src/components/Gastos.jsx
// Sección de Gastos: alta manual + OCR/IA + edición inline + borrado.
// IVA Soportado por defecto = 0 (correcto fiscalmente).

import { useState } from "react";
import { B, fmt, hoy, applyF } from "../utils.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { createRecord, updateRecord, deleteRecord } from "../api.js";
import { Card, Lbl, Inp, Sel, SectionHeader, FilterBar, ErrorBox } from "./UI.jsx";
import NuevoForm from "./NuevoForm.jsx";

export default function GastosView({ gastos, onRefresh, filtro, setFiltro }) {
  const { isMobile, formColumns } = useResponsive();

  const [showOCR, setShowOCR] = useState(false);
  const [showFManual, setShowFManual] = useState(false);
  const [sav, setSav] = useState(false);
  const [delId, setDelId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [err, setErr] = useState("");

  const [form, setForm] = useState({
    concepto: "", fecha: hoy(), base: "", iva: "", irpf: "", tipo: "", period: ""
  });

  const fg = applyF(gastos, filtro);
  const fijos = fg.filter(r => ["Mensual", "Anual", "Trimestral"].includes(r.fields["Periodicidad"]));
  const vars = fg.filter(r => !["Mensual", "Anual", "Trimestral"].includes(r.fields["Periodicidad"]));
  const tMes = fijos.reduce((s, r) => {
    const b = r.fields["Base Imponible"] || 0;
    const p = r.fields["Periodicidad"];
    return s + (p === "Mensual" ? b : p === "Trimestral" ? b / 3 : p === "Anual" ? b / 12 : 0);
  }, 0);

  // ============================================================
  // ALTA MANUAL RÁPIDA
  // ============================================================
  const save = async () => {
    if (!form.concepto || !form.base) {
      setErr("Concepto y base son obligatorios");
      return;
    }
    setErr("");
    setSav(true);
    try {
      const f = {
        "Concepto": form.concepto,
        "Fecha": form.fecha,
        "Base Imponible": Number(form.base) || 0,
        "IVA Soportado (€)": form.iva && form.iva !== "" ? Number(form.iva) : 0
      };
      if (form.irpf) f["IRPF Retenido (€)"] = Number(form.irpf);
      if (form.tipo) f["Tipo de Gasto"] = form.tipo;
      if (form.period) f["Periodicidad"] = form.period;

      await createRecord("Gastos", f);
      setForm({ concepto: "", fecha: hoy(), base: "", iva: "", irpf: "", tipo: "", period: "" });
      setShowFManual(false);
      onRefresh();
    } catch (e) {
      setErr("Error al guardar: " + e.message);
    }
    setSav(false);
  };

  const del = async (id) => {
    if (!confirm("¿Borrar este gasto?")) return;
    setDelId(id);
    try {
      await deleteRecord("Gastos", id);
      await onRefresh();
    } catch (e) {
      alert("Error al borrar: " + e.message);
    }
    setDelId(null);
  };

  // ============================================================
  // EDICIÓN INLINE
  // ============================================================
  const startEdit = (gasto) => {
    setEditId(gasto.id);
    setEditForm({
      concepto: gasto.fields["Concepto"] || "",
      fecha: gasto.fields["Fecha"] || hoy(),
      base: String(gasto.fields["Base Imponible"] || ""),
      iva: String(gasto.fields["IVA Soportado (€)"] || "0"),
      irpf: String(gasto.fields["IRPF Retenido (€)"] || ""),
      tipo: gasto.fields["Tipo de Gasto"] || "",
      period: gasto.fields["Periodicidad"] || ""
    });
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditForm(null);
  };

  const saveEdit = async () => {
    if (!editForm.concepto || !editForm.base) {
      alert("Concepto y base son obligatorios");
      return;
    }
    setSavingEdit(true);
    try {
      const fields = {
        "Concepto": editForm.concepto,
        "Fecha": editForm.fecha,
        "Base Imponible": Number(editForm.base) || 0,
        "IVA Soportado (€)": editForm.iva && editForm.iva !== "" ? Number(editForm.iva) : 0,
        "IRPF Retenido (€)": editForm.irpf && editForm.irpf !== "" ? Number(editForm.irpf) : 0
      };
      if (editForm.tipo) fields["Tipo de Gasto"] = editForm.tipo;
      if (editForm.period) fields["Periodicidad"] = editForm.period;

      await updateRecord("Gastos", editId, fields);
      cancelEdit();
      await onRefresh();
    } catch (e) {
      alert("Error al actualizar: " + e.message);
    }
    setSavingEdit(false);
  };

  // ============================================================
  // RENDERS
  // ============================================================
  if (showOCR) {
    return (
      <NuevoForm
        defaultTipo="gasto"
        lockTipo={true}
        onClose={() => setShowOCR(false)}
        onSaved={() => { onRefresh(); }}
      />
    );
  }

  // Form de edición (se renderiza para el gasto que se está editando)
  const renderEditForm = () => (
    <Card style={{ border: `2px solid ${B.purple}`, marginTop: 8, marginBottom: 8 }}>
      <Lbl><span style={{ color: B.purple }}>EDITAR GASTO</span></Lbl>
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${formColumns}, 1fr)`,
        gap: 14,
        marginTop: 14
      }}>
        <Inp label="Concepto" value={editForm.concepto} onChange={v => setEditForm({ ...editForm, concepto: v })} />
        <Inp label="Fecha" value={editForm.fecha} onChange={v => setEditForm({ ...editForm, fecha: v })} type="date" />
        <Inp label="Base Imponible (€)" value={editForm.base} onChange={v => setEditForm({ ...editForm, base: v })} type="number" />
        <Inp label="IVA Soportado (€)" value={editForm.iva} onChange={v => setEditForm({ ...editForm, iva: v })} type="number" ph="0 si no lleva IVA" />
        <Inp label="IRPF Retenido (€)" value={editForm.irpf} onChange={v => setEditForm({ ...editForm, irpf: v })} type="number" ph="0 si no aplica" />
        <Sel label="Tipo de Gasto" value={editForm.tipo} onChange={v => setEditForm({ ...editForm, tipo: v })} options={["Fijo", "Variable", "Impuesto"]} />
        <Sel label="Periodicidad" value={editForm.period} onChange={v => setEditForm({ ...editForm, period: v })} options={["Mensual", "Trimestral", "Anual", "Puntual"]} />
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

  // Renderiza un gasto individual (con o sin formulario de edición)
  const renderGasto = (g, showPeriod = false) => {
    const isEditing = editId === g.id;
    const base = g.fields["Base Imponible"] || 0;
    const iva = g.fields["IVA Soportado (€)"] || 0;
    const irpf = g.fields["IRPF Retenido (€)"] || 0;
    const fecha = g.fields["Fecha"] || "";
    const periodo = g.fields["Periodicidad"] || "";

    if (isEditing) return <div key={g.id}>{renderEditForm()}</div>;

    return (
      <div key={g.id} style={{
        padding: "14px 16px",
        background: "rgba(0,0,0,0.03)",
        borderRadius: 8,
        marginBottom: 8
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap"
        }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontWeight: 600, fontSize: 14, fontFamily: B.tS }}>
              {g.fields["Concepto"] || "Sin concepto"}
            </div>
            <div style={{ fontSize: 12, color: B.muted, marginTop: 2, fontFamily: B.tM }}>
              📅 {fecha || "Sin fecha"}
              {showPeriod && periodo && <span> · {periodo}</span>}
            </div>
            <div style={{ fontSize: 11, color: B.muted, marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span>Base: <strong style={{ color: B.text }}>{fmt(base)}</strong></span>
              <span>IVA: {iva > 0
                ? <strong style={{ color: B.green }}>{fmt(iva)}</strong>
                : <span style={{ color: B.muted, fontStyle: "italic" }}>Sin IVA</span>}
              </span>
              {irpf > 0 && <span>IRPF: <strong style={{ color: B.red }}>{fmt(irpf)}</strong></span>}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <div style={{ fontWeight: 700, fontFamily: B.tM, fontSize: 15 }}>
              {fmt(base + iva)}
            </div>
            {showPeriod && periodo && (
              <div style={{ fontSize: 11, color: B.amber, fontWeight: 600 }}>
                {fmt(periodo === "Mensual" ? base : periodo === "Trimestral" ? base / 3 : periodo === "Anual" ? base / 12 : base)}/mes
              </div>
            )}
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <button
                onClick={() => startEdit(g)}
                style={{
                  ...B.btnSm,
                  background: "transparent",
                  color: B.purple,
                  border: `1px solid ${B.purple}`,
                  padding: "4px 10px",
                  fontSize: 10
                }}
              >
                EDITAR
              </button>
              <button
                onClick={() => del(g.id)}
                disabled={delId === g.id}
                style={{ ...B.btnDel, padding: "4px 10px", fontSize: 10, opacity: delId === g.id ? 0.5 : 1 }}
              >
                BORRAR
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <SectionHeader
        title="Gastos y Prorrateo"
        action={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => setShowOCR(true)} style={{
              ...B.btn,
              background: B.purple,
              color: "#fff"
            }}>
              ✨ OCR + IA
            </button>
            <button onClick={() => setShowFManual(!showFManual)} style={B.btn}>
              {showFManual ? "CANCELAR" : "+ MANUAL"}
            </button>
          </div>
        }
      />

      <FilterBar filtro={filtro} setFiltro={setFiltro} />

      {showFManual && (
        <Card style={{ border: `2px solid ${B.purple}` }}>
          <Lbl>Añadir Gasto Manual</Lbl>
          <ErrorBox>{err}</ErrorBox>
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${formColumns}, 1fr)`,
            gap: 14,
            marginTop: 14
          }}>
            <Inp label="Concepto" value={form.concepto} onChange={v => setForm({ ...form, concepto: v })} ph="Ej: Adobe" />
            <Inp label="Fecha" value={form.fecha} onChange={v => setForm({ ...form, fecha: v })} type="date" />
            <Inp label="Base Imponible (€)" value={form.base} onChange={v => setForm({ ...form, base: v })} type="number" ph="0" />
            <Inp label="IVA Soportado (€)" value={form.iva} onChange={v => setForm({ ...form, iva: v })} type="number" ph="0 si no lleva IVA" />
            <Inp label="IRPF Retenido (€)" value={form.irpf} onChange={v => setForm({ ...form, irpf: v })} type="number" ph="Si proveedor autónomo" />
            <Sel label="Tipo de Gasto" value={form.tipo} onChange={v => setForm({ ...form, tipo: v })} options={["Fijo", "Variable", "Impuesto"]} />
            <Sel label="Periodicidad" value={form.period} onChange={v => setForm({ ...form, period: v })} options={["Mensual", "Trimestral", "Anual", "Puntual"]} />
          </div>
          <button onClick={save} disabled={sav} style={{ ...B.btn, width: "100%", marginTop: 16, opacity: sav ? 0.5 : 1 }}>
            {sav ? "GUARDANDO..." : "GUARDAR GASTO"}
          </button>
        </Card>
      )}

      {/* Resumen "Aparta cada mes" */}
      <div style={{ background: B.text, borderRadius: 12, padding: 24, color: "#fff" }}>
        <Lbl><span style={{ color: "rgba(255,255,255,0.6)" }}>APARTA CADA MES</span></Lbl>
        <div style={{ fontSize: 38, fontWeight: 700, marginTop: 6, fontFamily: B.tM }}>
          {fmt(tMes)}
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>
          Suma prorrateada de tus gastos fijos (mensual + trimestral/3 + anual/12)
        </div>
      </div>

      {/* Lista de gastos fijos */}
      {fijos.length > 0 && (
        <Card>
          <Lbl>Gastos Fijos ({fijos.length})</Lbl>
          <div style={{ marginTop: 14 }}>
            {fijos.map(g => renderGasto(g, true))}
          </div>
        </Card>
      )}

      {/* Lista de gastos variables */}
      {vars.length > 0 && (
        <Card>
          <Lbl>Gastos Variables ({vars.length})</Lbl>
          <div style={{ marginTop: 14 }}>
            {vars.map(g => renderGasto(g, false))}
          </div>
        </Card>
      )}

      {fijos.length === 0 && vars.length === 0 && (
        <Card>
          <p style={{ color: B.muted, fontFamily: B.tS, margin: 0 }}>
            No hay gastos en el período seleccionado.
          </p>
        </Card>
      )}
    </div>
  );
}
