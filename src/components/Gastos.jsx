// src/components/Gastos.jsx
// Lista y alta de gastos. Soporta alta rápida manual + alta con OCR (vía IA).

import { useState } from "react";
import { B, fmt, hoy, applyF } from "../utils.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { createRecord, deleteRecord } from "../api.js";
import { Card, Lbl, Inp, Sel, FilterBar, SectionHeader } from "./UI.jsx";
import NuevoForm from "./NuevoForm.jsx";

export default function GastosView({ gastos, onRefresh, filtro, setFiltro }) {
  const { isMobile, formColumns } = useResponsive();

  const [mode, setMode] = useState("lista");  // "lista" | "ocr" | "manual"
  const [sav, setSav] = useState(false);
  const [delId, setDelId] = useState(null);
  const [form, setForm] = useState({
    concepto: "",
    fecha: hoy(),
    base: "",
    iva: "",
    irpf: "",
    tipo: "",
    period: ""
  });

  // ============================================================
  // VISTA OCR (delegada al NuevoForm con tipo bloqueado a gasto)
  // ============================================================
  if (mode === "ocr") {
    return (
      <NuevoForm
        defaultTipo="gasto"
        lockTipo={true}
        onClose={() => { setMode("lista"); onRefresh(); }}
        onSaved={() => { onRefresh(); }}
      />
    );
  }

  // ============================================================
  // CÁLCULOS DE LA LISTA
  // ============================================================
  const fg = applyF(gastos, filtro);
  const fijos = fg.filter(r => ["Mensual", "Anual", "Trimestral"].includes(r.fields["Periodicidad"]));
  const vars = fg.filter(r => !["Mensual", "Anual", "Trimestral"].includes(r.fields["Periodicidad"]));

  const tMes = fijos.reduce((s, r) => {
    const b = r.fields["Base Imponible"] || 0;
    const p = r.fields["Periodicidad"];
    return s + (p === "Mensual" ? b : p === "Trimestral" ? b / 3 : p === "Anual" ? b / 12 : 0);
  }, 0);

  // ============================================================
  // ACCIONES
  // ============================================================
  const save = async () => {
    if (!form.concepto || !form.base) return;
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
      setMode("lista");
      await onRefresh();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setSav(false);
  };

  const del = async (id) => {
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
  // VISTA LISTA
  // ============================================================
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader
        title="Gastos y Prorrateo"
        action={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => setMode("ocr")} style={{
              ...B.btn,
              background: B.purple,
              border: `2px solid ${B.purple}`
            }}>
              📷 OCR / IA
            </button>
            <button
              onClick={() => setMode(mode === "manual" ? "lista" : "manual")}
              style={B.btn}
            >
              {mode === "manual" ? "CANCELAR" : "+ MANUAL"}
            </button>
          </div>
        }
      />

      <FilterBar filtro={filtro} setFiltro={setFiltro} />

      {/* Formulario manual rápido */}
      {mode === "manual" && (
        <Card style={{ border: `2px solid ${B.purple}` }}>
          <Lbl>Añadir Gasto Manual</Lbl>
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${formColumns}, 1fr)`,
            gap: 14,
            marginTop: 14
          }}>
            <Inp label="Concepto" value={form.concepto} onChange={v => setForm({ ...form, concepto: v })} ph="Ej: Adobe" />
            <Inp label="Fecha" value={form.fecha} onChange={v => setForm({ ...form, fecha: v })} type="date" />
            <Inp label="Base Imponible (€)" value={form.base} onChange={v => setForm({ ...form, base: v })} type="number" ph="0" />
            <Inp label="IVA Soportado (€)" value={form.iva} onChange={v => setForm({ ...form, iva: v })} type="number" ph="Auto: 21%" />
            <Inp label="IRPF Retenido (€)" value={form.irpf} onChange={v => setForm({ ...form, irpf: v })} type="number" ph="Si proveedor autónomo" />
            <Sel label="Tipo de Gasto" value={form.tipo} onChange={v => setForm({ ...form, tipo: v })} options={["Fijo", "Variable", "Impuesto"]} />
            <Sel label="Periodicidad" value={form.period} onChange={v => setForm({ ...form, period: v })} options={["Mensual", "Trimestral", "Anual", "Puntual"]} />
          </div>
          <button
            onClick={save}
            disabled={sav}
            style={{ ...B.btn, width: "100%", marginTop: 16, opacity: sav ? 0.5 : 1 }}
          >
            {sav ? "GUARDANDO..." : "GUARDAR GASTO"}
          </button>
        </Card>
      )}

      {/* Hucha de prorrateo */}
      <div style={{
        background: B.text,
        borderRadius: 12,
        padding: isMobile ? 20 : 24,
        color: "#fff"
      }}>
        <Lbl><span style={{ color: "rgba(255,255,255,0.6)" }}>APARTA CADA MES</span></Lbl>
        <div style={{
          fontSize: isMobile ? 30 : 38,
          fontWeight: 700,
          marginTop: 6,
          fontFamily: B.tM
        }}>
          {fmt(tMes)}
        </div>
        <div style={{
          marginTop: 8,
          fontSize: 12,
          opacity: 0.7,
          fontFamily: B.tS
        }}>
          Suma prorrateada de tus gastos fijos (mensual + trimestral/3 + anual/12)
        </div>
      </div>

      {/* Gastos fijos */}
      {fijos.length > 0 && (
        <Card>
          <Lbl>Gastos Fijos ({fijos.length})</Lbl>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
            {fijos.map(g => {
              const b = g.fields["Base Imponible"] || 0;
              const p = g.fields["Periodicidad"] || "";
              const m = p === "Mensual" ? b : p === "Trimestral" ? b / 3 : p === "Anual" ? b / 12 : b;

              return (
                <div
                  key={g.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 16px",
                    background: "rgba(0,0,0,0.03)",
                    borderRadius: 8,
                    gap: 12,
                    flexWrap: isMobile ? "wrap" : "nowrap"
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, fontFamily: B.tS }}>
                      {g.fields["Concepto"]}
                    </div>
                    <div style={{ fontSize: 12, color: B.muted }}>{p}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700, fontFamily: B.tM }}>{fmt(b)}</div>
                      <div style={{ fontSize: 12, color: B.amber, fontWeight: 600 }}>{fmt(m)}/mes</div>
                    </div>
                    <button
                      onClick={() => { if (confirm("¿Borrar?")) del(g.id); }}
                      disabled={delId === g.id}
                      style={B.btnDel}
                    >
                      BORRAR
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Gastos variables */}
      {vars.length > 0 && (
        <Card>
          <Lbl>Gastos Variables ({vars.length})</Lbl>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
            {vars.map(g => (
              <div
                key={g.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 16px",
                  background: "rgba(0,0,0,0.03)",
                  borderRadius: 8,
                  gap: 12,
                  flexWrap: isMobile ? "wrap" : "nowrap"
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, fontFamily: B.tS }}>
                    {g.fields["Concepto"]}
                  </div>
                  <div style={{ fontSize: 12, color: B.muted }}>{g.fields["Fecha"] || ""}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontWeight: 700, fontFamily: B.tM }}>{fmt(g.fields["Base Imponible"])}</div>
                  <button
                    onClick={() => { if (confirm("¿Borrar?")) del(g.id); }}
                    disabled={delId === g.id}
                    style={B.btnDel}
                  >
                    BORRAR
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {fg.length === 0 && (
        <Card>
          <p style={{ color: B.muted, fontFamily: B.tS, margin: 0 }}>
            No hay gastos en este período. Pulsa "📷 OCR / IA" para subir un ticket o "+ MANUAL" para introducir uno a mano.
          </p>
        </Card>
      )}
    </div>
  );
}
