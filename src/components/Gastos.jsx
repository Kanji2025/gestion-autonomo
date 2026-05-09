// src/components/Gastos.jsx
// Sección de Gastos: alta manual + OCR/IA + edición + duplicado + borrado.
// Detección AUTOMÁTICA de Gasto Fijo por proveedor.
// "Aparta cada mes" calculado desde tabla Gastos Fijos (con separación fiscal).

import { useState, useEffect, useRef } from "react";
import { B, fmt, hoy, applyF } from "../utils.js";
import { useResponsive } from "../hooks/useResponsive.js";
import {
  createRecord,
  updateRecord,
  deleteRecord,
  findGastoFijoByProveedor,
  createGastoFijo,
  linkGastoToGastoFijo
} from "../api.js";
import { Card, Lbl, Inp, Sel, SectionHeader, FilterBar, ErrorBox } from "./UI.jsx";
import NuevoForm from "./NuevoForm.jsx";

// ============================================================
// MENÚ DE 3 PUNTOS
// ============================================================
function DotMenu({ onEdit, onDuplicate, onDelete, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) {
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [open]);

  const menuItemStyle = (color) => ({
    display: "block",
    width: "100%",
    padding: "10px 14px",
    textAlign: "left",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: B.tS,
    color
  });

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        disabled={disabled}
        style={{
          background: "transparent",
          border: `1px solid ${B.border}`,
          borderRadius: 4,
          padding: "4px 10px",
          cursor: disabled ? "not-allowed" : "pointer",
          fontSize: 14,
          fontWeight: 700,
          color: B.muted,
          opacity: disabled ? 0.5 : 1,
          lineHeight: 1
        }}
        aria-label="Opciones"
      >
        ⋮
      </button>
      {open && (
        <div style={{
          position: "absolute",
          right: 0,
          top: "calc(100% + 4px)",
          background: "#fff",
          border: `1px solid ${B.border}`,
          borderRadius: 6,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          minWidth: 140,
          zIndex: 50,
          overflow: "hidden"
        }}>
          <button onClick={() => { setOpen(false); onEdit(); }} style={menuItemStyle(B.text)}>
            ✏️ Editar
          </button>
          <button onClick={() => { setOpen(false); onDuplicate(); }} style={menuItemStyle(B.purple)}>
            📋 Duplicar
          </button>
          <button onClick={() => { setOpen(false); onDelete(); }} style={menuItemStyle(B.red)}>
            🗑 Borrar
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// CALCULADORA DE PRORRATEO POR TIPO
// ============================================================
function calcularProrrateoMensual(gastosFijos) {
  let deducible = 0;
  let cuotaSS = 0;
  let noDeducible = 0;

  for (const gf of (gastosFijos || [])) {
    if (gf.fields["Activa"] === "No") continue;
    const importe = gf.fields["Importe Medio"] || 0;
    const periodicidad = gf.fields["Periodicidad"] || "Mensual";
    const tipo = gf.fields["Tipo"] || "Deducible";

    const mensual = periodicidad === "Mensual" ? importe
      : periodicidad === "Trimestral" ? importe / 3
      : periodicidad === "Anual" ? importe / 12
      : 0;

    if (tipo === "Cuota SS") cuotaSS += mensual;
    else if (tipo === "No deducible") noDeducible += mensual;
    else deducible += mensual;
  }

  return { deducible, cuotaSS, noDeducible, total: deducible + cuotaSS + noDeducible };
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function GastosView({ gastos, gastosFijos, onRefresh, filtro, setFiltro }) {
  const { isMobile, formColumns } = useResponsive();

  const [showOCR, setShowOCR] = useState(false);
  const [showFManual, setShowFManual] = useState(false);
  const [sav, setSav] = useState(false);
  const [delId, setDelId] = useState(null);
  const [err, setErr] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [duplicadoToast, setDuplicadoToast] = useState(null);

  const [detectado, setDetectado] = useState(null);
  const [buscandoProv, setBuscandoProv] = useState(false);

  const [editState, setEditState] = useState(null);

  const [form, setForm] = useState({
    concepto: "", proveedor: "", fecha: hoy(), base: "", iva: "", irpf: "",
    altaComoFijo: false,
    esPuntual: false,
    periodFijo: "Mensual",
    monedaFijo: "EUR"
  });

  const fg = applyF(gastos, filtro);
  const fijos = fg.filter(r => ["Mensual", "Anual", "Trimestral"].includes(r.fields["Periodicidad"]));
  const vars = fg.filter(r => !["Mensual", "Anual", "Trimestral"].includes(r.fields["Periodicidad"]));

  // CÁLCULO NUEVO desde tabla Gastos Fijos (no desde gastos individuales)
  const prorrateo = calcularProrrateoMensual(gastosFijos);

  useEffect(() => {
    const prov = form.proveedor.trim();
    if (!prov) {
      setDetectado(null);
      return;
    }
    setBuscandoProv(true);
    const timer = setTimeout(async () => {
      try {
        const found = await findGastoFijoByProveedor(prov);
        if (found) {
          setDetectado({ existe: true, gastoFijo: found });
        } else {
          setDetectado({ existe: false });
        }
      } catch (e) {
        console.warn("Error buscando proveedor:", e);
        setDetectado(null);
      }
      setBuscandoProv(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [form.proveedor]);

  const resetForm = () => {
    setForm({
      concepto: "", proveedor: "", fecha: hoy(), base: "", iva: "", irpf: "",
      altaComoFijo: false, esPuntual: false,
      periodFijo: "Mensual", monedaFijo: "EUR"
    });
    setDetectado(null);
  };

  const save = async () => {
    if (!form.concepto || !form.base) {
      setErr("Concepto y base son obligatorios");
      return;
    }
    if (form.altaComoFijo && !form.proveedor.trim()) {
      setErr("Para dar de alta un Gasto Fijo necesitas rellenar el Proveedor");
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

      if (detectado?.existe && !form.esPuntual && detectado.gastoFijo.fields["Periodicidad"]) {
        f["Periodicidad"] = detectado.gastoFijo.fields["Periodicidad"];
      } else if (detectado?.existe === false && form.altaComoFijo) {
        f["Periodicidad"] = form.periodFijo;
      }

      const created = await createRecord("Gastos", f);
      const nuevoGastoId = created.records?.[0]?.id;

      const provLimpio = form.proveedor.trim();

      if (provLimpio && nuevoGastoId) {
        if (detectado?.existe && !form.esPuntual) {
          await linkGastoToGastoFijo(nuevoGastoId, detectado.gastoFijo.id);
        } else if (detectado?.existe === false && form.altaComoFijo) {
          try {
            const nuevoFijoId = await createGastoFijo({
              nombre: provLimpio,
              proveedor: provLimpio,
              periodicidad: form.periodFijo,
              importe: Number(form.base) + (Number(form.iva) || 0),
              moneda: form.monedaFijo,
              fechaAlta: form.fecha || hoy()
            });
            if (nuevoFijoId) {
              await linkGastoToGastoFijo(nuevoGastoId, nuevoFijoId);
            }
          } catch (e) {
            console.warn("Gasto guardado pero no se pudo crear el Gasto Fijo:", e);
          }
        }
      }

      resetForm();
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
    } catch (e) { alert("Error al borrar: " + e.message); }
    setDelId(null);
  };

  const startEdit = (g) => {
    const gastoFijoIds = g.fields["Gasto Fijo"] || [];
    setEditState({
      id: g.id,
      gastoFijoIds,
      form: {
        concepto: g.fields["Concepto"] || "",
        fecha: g.fields["Fecha"] || hoy(),
        base: String(g.fields["Base Imponible"] || ""),
        iva: String(g.fields["IVA Soportado (€)"] || "0"),
        irpf: String(g.fields["IRPF Retenido (€)"] || "")
      }
    });
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
  };

  const duplicar = async (g) => {
    try {
      const gastoFijoIds = g.fields["Gasto Fijo"] || [];

      const copia = {
        "Concepto": g.fields["Concepto"] || "Gasto",
        "Fecha": hoy(),
        "Base Imponible": g.fields["Base Imponible"] || 0,
        "IVA Soportado (€)": g.fields["IVA Soportado (€)"] || 0
      };
      if (g.fields["IRPF Retenido (€)"]) copia["IRPF Retenido (€)"] = g.fields["IRPF Retenido (€)"];
      if (g.fields["Periodicidad"]) copia["Periodicidad"] = g.fields["Periodicidad"];

      if (gastoFijoIds.length > 0) {
        copia["Gasto Fijo"] = gastoFijoIds;
      }

      await createRecord("Gastos", copia);
      await onRefresh();

      setDuplicadoToast({
        concepto: copia["Concepto"],
        fecha: copia["Fecha"],
        heredado: gastoFijoIds.length > 0
      });
      setTimeout(() => setDuplicadoToast(null), 6000);
    } catch (e) {
      console.error("Duplicar error:", e);
      alert("Error al duplicar: " + (e.message || "desconocido"));
    }
  };

  const cancelEdit = () => {
    setEditState(null);
  };

  const updateEditField = (field, value) => {
    setEditState(prev => {
      if (!prev) return null;
      return { ...prev, form: { ...prev.form, [field]: value } };
    });
  };

  const saveEdit = async () => {
    if (!editState) return;
    const { id, form: ef } = editState;
    if (!ef.concepto || !ef.base) {
      alert("Concepto y base son obligatorios");
      return;
    }
    setSavingEdit(true);
    try {
      const fields = {
        "Concepto": ef.concepto,
        "Fecha": ef.fecha,
        "Base Imponible": Number(ef.base) || 0,
        "IVA Soportado (€)": ef.iva && ef.iva !== "" ? Number(ef.iva) : 0,
        "IRPF Retenido (€)": ef.irpf && ef.irpf !== "" ? Number(ef.irpf) : 0
      };

      await updateRecord("Gastos", id, fields);
      setEditState(null);
      await onRefresh();
    } catch (e) { alert("Error al actualizar: " + e.message); }
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

  const EditForm = () => {
    if (!editState) return null;
    const ef = editState.form;
    const enlazado = editState.gastoFijoIds.length > 0;
    return (
      <Card style={{ border: `2px solid ${B.purple}`, marginTop: 8, marginBottom: 8 }}>
        <Lbl><span style={{ color: B.purple }}>EDITAR GASTO</span></Lbl>
        {enlazado && (
          <div style={{
            marginTop: 10,
            padding: "8px 12px",
            background: B.green + "15",
            color: "#0d6b3a",
            borderRadius: 6,
            fontSize: 12,
            fontFamily: B.tS,
            fontWeight: 600
          }}>
            🔗 Este gasto está enlazado a un Gasto Fijo (la periodicidad y tipo se gestionan allí)
          </div>
        )}
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${formColumns}, 1fr)`,
          gap: 14,
          marginTop: 14
        }}>
          <Inp label="Concepto" value={ef.concepto} onChange={v => updateEditField("concepto", v)} />
          <Inp label="Fecha" value={ef.fecha} onChange={v => updateEditField("fecha", v)} type="date" />
          <Inp label="Base Imponible (€)" value={ef.base} onChange={v => updateEditField("base", v)} type="number" />
          <Inp label="IVA Soportado (€)" value={ef.iva} onChange={v => updateEditField("iva", v)} type="number" ph="0 si no lleva IVA" />
          <Inp label="IRPF Retenido (€)" value={ef.irpf} onChange={v => updateEditField("irpf", v)} type="number" ph="0 si no aplica" />
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

  const renderGasto = (g, showPeriod = false) => {
    const base = g.fields["Base Imponible"] || 0;
    const iva = g.fields["IVA Soportado (€)"] || 0;
    const irpf = g.fields["IRPF Retenido (€)"] || 0;
    const fecha = g.fields["Fecha"] || "";
    const periodo = g.fields["Periodicidad"] || "";
    const gastoFijoIds = g.fields["Gasto Fijo"] || [];
    const esFijo = gastoFijoIds.length > 0;

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
            <div style={{ fontWeight: 600, fontSize: 14, fontFamily: B.tS, display: "flex", alignItems: "center", gap: 6 }}>
              {esFijo && <span title="Gasto fijo recurrente">🔄</span>}
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
            <DotMenu
              onEdit={() => startEdit(g)}
              onDuplicate={() => duplicar(g)}
              onDelete={() => del(g.id)}
              disabled={delId === g.id}
            />
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

      {duplicadoToast && (
        <div style={{
          background: B.green + "15",
          border: `2px solid ${B.green}`,
          borderRadius: 10,
          padding: "14px 18px",
          color: "#0d6b3a",
          fontFamily: B.tS,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap"
        }}>
          <div style={{ fontSize: 24 }}>✅</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              Gasto duplicado: «{duplicadoToast.concepto}»
            </div>
            <div style={{ fontSize: 12, marginTop: 2 }}>
              Copia creada con fecha {duplicadoToast.fecha}.
              {duplicadoToast.heredado && " 🔄 Enlazada al mismo Gasto Fijo."}
              {" Pulsa "}<strong>⋮ → Editar</strong>{" en la copia si necesitas modificar algo."}
            </div>
          </div>
          <button
            onClick={() => setDuplicadoToast(null)}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "#0d6b3a", fontSize: 18, padding: 4 }}
          >✕</button>
        </div>
      )}

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
            <Inp label="Concepto" value={form.concepto} onChange={v => setForm({ ...form, concepto: v })} ph="Ej: Suscripción Canva" />
            <Inp label="Proveedor" value={form.proveedor} onChange={v => setForm({ ...form, proveedor: v, altaComoFijo: false, esPuntual: false })} ph="Ej: Canva" />
            <Inp label="Fecha" value={form.fecha} onChange={v => setForm({ ...form, fecha: v })} type="date" />
            <Inp label="Base Imponible (€)" value={form.base} onChange={v => setForm({ ...form, base: v })} type="number" ph="0" />
            <Inp label="IVA Soportado (€)" value={form.iva} onChange={v => setForm({ ...form, iva: v })} type="number" ph="0 si no lleva IVA" />
            <Inp label="IRPF Retenido (€)" value={form.irpf} onChange={v => setForm({ ...form, irpf: v })} type="number" ph="Si proveedor autónomo" />
          </div>

          {form.proveedor.trim() && (
            <div style={{ marginTop: 18 }}>
              {buscandoProv && (
                <div style={{
                  padding: "10px 14px",
                  background: "rgba(0,0,0,0.04)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: B.muted,
                  fontFamily: B.tS
                }}>
                  🔍 Comprobando si «{form.proveedor.trim()}» ya está registrado como Gasto Fijo...
                </div>
              )}

              {!buscandoProv && detectado?.existe && (
                <div style={{
                  padding: 14,
                  background: form.esPuntual ? "rgba(0,0,0,0.03)" : B.green + "12",
                  border: `2px solid ${form.esPuntual ? B.border : B.green}`,
                  borderRadius: 10,
                  transition: "all 0.2s ease"
                }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: B.tS,
                    color: form.esPuntual ? B.muted : "#0d6b3a",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap"
                  }}>
                    {form.esPuntual ? "❌" : "🔗"} {form.esPuntual
                      ? `Este pago se guardará como puntual (no enlazado a «${detectado.gastoFijo.fields["Nombre"] || detectado.gastoFijo.fields["Proveedor"]}»)`
                      : `Se enlazará automáticamente al Gasto Fijo «${detectado.gastoFijo.fields["Nombre"] || detectado.gastoFijo.fields["Proveedor"]}»`}
                  </div>
                  <label style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 12,
                    cursor: "pointer",
                    userSelect: "none"
                  }}>
                    <input
                      type="checkbox"
                      checked={form.esPuntual}
                      onChange={e => setForm({ ...form, esPuntual: e.target.checked })}
                      style={{ width: 18, height: 18, accentColor: B.amber, cursor: "pointer" }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600, fontFamily: B.tS, color: B.text }}>
                      Este pago es puntual (no contar como Gasto Fijo)
                    </span>
                  </label>
                  <div style={{ fontSize: 11, color: B.muted, marginTop: 4, paddingLeft: 28 }}>
                    Marca esto si el proveedor coincide pero este gasto NO es del recurrente
                    (ej: compra adicional fuera de la cuota habitual).
                  </div>
                </div>
              )}

              {!buscandoProv && detectado?.existe === false && (
                <div style={{
                  padding: 14,
                  background: form.altaComoFijo ? B.purple + "10" : "rgba(0,0,0,0.03)",
                  border: `2px solid ${form.altaComoFijo ? B.purple : B.border}`,
                  borderRadius: 10,
                  transition: "all 0.2s ease"
                }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", userSelect: "none" }}>
                    <input
                      type="checkbox"
                      checked={form.altaComoFijo}
                      onChange={e => setForm({ ...form, altaComoFijo: e.target.checked })}
                      style={{ width: 20, height: 20, accentColor: B.purple, cursor: "pointer" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, fontFamily: B.tS }}>
                        ➕ Dar de alta «{form.proveedor.trim()}» como Gasto Fijo
                      </div>
                      <div style={{ fontSize: 12, color: B.muted, marginTop: 2 }}>
                        A partir de ahora, los pagos de este proveedor se enlazarán automáticamente.
                      </div>
                    </div>
                  </label>

                  {form.altaComoFijo && (
                    <div style={{
                      marginTop: 14,
                      display: "grid",
                      gridTemplateColumns: `repeat(${Math.min(formColumns, 2)}, 1fr)`,
                      gap: 12,
                      paddingTop: 14,
                      borderTop: `1px solid ${B.border}`
                    }}>
                      <Sel label="Periodicidad" value={form.periodFijo} onChange={v => setForm({ ...form, periodFijo: v })} options={["Mensual", "Trimestral", "Anual"]} />
                      <Sel label="Moneda" value={form.monedaFijo} onChange={v => setForm({ ...form, monedaFijo: v })} options={["EUR", "USD", "GBP"]} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <button onClick={save} disabled={sav} style={{
            ...B.btn,
            width: "100%",
            marginTop: 16,
            opacity: sav ? 0.5 : 1
          }}>
            {sav ? "GUARDANDO..." : "GUARDAR GASTO"}
          </button>
        </Card>
      )}

      {editState && (
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
            ✏️ Editando gasto
          </div>
          <EditForm />
        </div>
      )}

      {/* APARTA CADA MES — NUEVO con separación fiscal */}
      <div style={{ background: B.text, borderRadius: 12, padding: 24, color: "#fff" }}>
        <Lbl><span style={{ color: "rgba(255,255,255,0.6)" }}>APARTA CADA MES</span></Lbl>
        <div style={{ fontSize: 38, fontWeight: 700, marginTop: 6, fontFamily: B.tM }}>
          {fmt(prorrateo.total)}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 4, fontFamily: B.tS }}>
          Total a apartar (todos los Gastos Fijos activos prorrateados a mensual)
        </div>

        <div style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: 12
        }}>
          <div style={{
            padding: "12px 14px",
            background: "rgba(34,197,94,0.15)",
            border: "1px solid rgba(34,197,94,0.3)",
            borderRadius: 8
          }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontFamily: B.tM, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              🟢 Reduce IRPF
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: B.tM, marginTop: 4 }}>
              {fmt(prorrateo.deducible + prorrateo.cuotaSS)}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
              Deducibles {prorrateo.cuotaSS > 0 && `+ Cuota SS (${fmt(prorrateo.cuotaSS)})`}
            </div>
          </div>

          <div style={{
            padding: "12px 14px",
            background: "rgba(220,38,38,0.15)",
            border: "1px solid rgba(220,38,38,0.3)",
            borderRadius: 8
          }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontFamily: B.tM, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              🔴 Solo ocupa caja
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: B.tM, marginTop: 4 }}>
              {fmt(prorrateo.noDeducible)}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
              No deducibles (aplazamientos, IVA fraccionado...)
            </div>
          </div>
        </div>
      </div>

      {fijos.length > 0 && (
        <Card>
          <Lbl>Gastos Fijos del periodo ({fijos.length})</Lbl>
          <div style={{ marginTop: 14 }}>
            {fijos.map(g => renderGasto(g, true))}
          </div>
        </Card>
      )}

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
