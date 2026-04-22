// src/components/Gastos.jsx
// Sección de Gastos: alta manual (con toggle de gasto fijo) + OCR/IA + edición + duplicado + borrado.
// Menú de 3 puntos (⋮) con Editar/Duplicar/Borrar.

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
          <button
            onClick={() => { setOpen(false); onEdit(); }}
            style={menuItemStyle(B.text)}
          >
            ✏️ Editar
          </button>
          <button
            onClick={() => { setOpen(false); onDuplicate(); }}
            style={menuItemStyle(B.purple)}
          >
            📋 Duplicar
          </button>
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            style={menuItemStyle(B.red)}
          >
            🗑 Borrar
          </button>
        </div>
      )}
    </div>
  );
}

function menuItemStyle(color) {
  return {
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
    color,
    transition: "background 0.1s ease"
  };
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
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

  // Estado formulario manual (alta)
  const [form, setForm] = useState({
    concepto: "", proveedor: "", fecha: hoy(), base: "", iva: "", irpf: "",
    tipo: "", period: "", esFijo: false, periodFijo: "Mensual", monedaFijo: "EUR"
  });

  // Modal de duplicado (para gasto fijo repetido)
  const [duplicadoModal, setDuplicadoModal] = useState(null);

  const fg = applyF(gastos, filtro);
  const fijos = fg.filter(r => ["Mensual", "Anual", "Trimestral"].includes(r.fields["Periodicidad"]));
  const vars = fg.filter(r => !["Mensual", "Anual", "Trimestral"].includes(r.fields["Periodicidad"]));
  const tMes = fijos.reduce((s, r) => {
    const b = r.fields["Base Imponible"] || 0;
    const p = r.fields["Periodicidad"];
    return s + (p === "Mensual" ? b : p === "Trimestral" ? b / 3 : p === "Anual" ? b / 12 : 0);
  }, 0);

  // ============================================================
  // GUARDAR MANUAL (con lógica de gasto fijo)
  // ============================================================
  const save = async () => {
    if (!form.concepto || !form.base) {
      setErr("Concepto y base son obligatorios");
      return;
    }
    if (form.esFijo && !form.proveedor.trim()) {
      setErr("Para dar de alta un gasto fijo necesitas rellenar el proveedor");
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

      const created = await createRecord("Gastos", f);
      const nuevoGastoId = created.records?.[0]?.id;

      // Si es gasto fijo, gestionar alta/duplicado
      if (form.esFijo && form.proveedor.trim()) {
        const existente = await findGastoFijoByProveedor(form.proveedor.trim());

        if (existente) {
          setDuplicadoModal({
            existente,
            nuevoGastoId,
            proveedor: form.proveedor.trim()
          });
          setSav(false);
          return; // espera decisión del usuario en el modal
        }

        try {
          const nuevoFijoId = await createGastoFijo({
            nombre: form.proveedor.trim(),
            proveedor: form.proveedor.trim(),
            periodicidad: form.periodFijo,
            importe: Number(form.base) + (Number(form.iva) || 0),
            moneda: form.monedaFijo,
            fechaAlta: form.fecha || hoy()
          });
          if (nuevoFijoId && nuevoGastoId) {
            await linkGastoToGastoFijo(nuevoGastoId, nuevoFijoId);
          }
        } catch (e) {
          console.warn("Gasto guardado pero no se pudo crear el Gasto Fijo:", e);
        }
      }

      // Éxito (sin modal)
      setForm({
        concepto: "", proveedor: "", fecha: hoy(), base: "", iva: "", irpf: "",
        tipo: "", period: "", esFijo: false, periodFijo: "Mensual", monedaFijo: "EUR"
      });
      setShowFManual(false);
      onRefresh();
    } catch (e) {
      setErr("Error al guardar: " + e.message);
    }
    setSav(false);
  };

  // ============================================================
  // ACCIONES DEL MODAL DE DUPLICADO
  // ============================================================
  const enlazarAExistente = async () => {
    const { existente, nuevoGastoId } = duplicadoModal;
    try {
      if (nuevoGastoId && existente?.id) {
        await linkGastoToGastoFijo(nuevoGastoId, existente.id);
      }
      cerrarModal();
    } catch (e) {
      alert("Error al enlazar: " + e.message);
    }
  };

  const crearDuplicado = async () => {
    const { nuevoGastoId } = duplicadoModal;
    try {
      const nuevoFijoId = await createGastoFijo({
        nombre: form.proveedor.trim() + " (2)",
        proveedor: form.proveedor.trim(),
        periodicidad: form.periodFijo,
        importe: Number(form.base) + (Number(form.iva) || 0),
        moneda: form.monedaFijo,
        fechaAlta: form.fecha || hoy()
      });
      if (nuevoFijoId && nuevoGastoId) {
        await linkGastoToGastoFijo(nuevoGastoId, nuevoFijoId);
      }
      cerrarModal();
    } catch (e) {
      alert("Error al crear: " + e.message);
    }
  };

  const cancelarGastoFijo = () => {
    cerrarModal();
  };

  const cerrarModal = () => {
    setDuplicadoModal(null);
    setForm({
      concepto: "", proveedor: "", fecha: hoy(), base: "", iva: "", irpf: "",
      tipo: "", period: "", esFijo: false, periodFijo: "Mensual", monedaFijo: "EUR"
    });
    setShowFManual(false);
    onRefresh();
  };

  // ============================================================
  // BORRAR
  // ============================================================
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
  // DUPLICAR
  // ============================================================
  const duplicar = async (g) => {
    try {
      const copia = {
        "Concepto": g.fields["Concepto"] || "Gasto",
        "Fecha": hoy(),
        "Base Imponible": g.fields["Base Imponible"] || 0,
        "IVA Soportado (€)": g.fields["IVA Soportado (€)"] || 0
      };
      if (g.fields["IRPF Retenido (€)"]) copia["IRPF Retenido (€)"] = g.fields["IRPF Retenido (€)"];
      if (g.fields["Tipo de Gasto"]) copia["Tipo de Gasto"] = g.fields["Tipo de Gasto"];
      if (g.fields["Periodicidad"]) copia["Periodicidad"] = g.fields["Periodicidad"];

      const created = await createRecord("Gastos", copia);
      await onRefresh();

      // Abrir el editor en la copia recién creada
      const nuevoId = created.records?.[0]?.id;
      if (nuevoId) {
        setEditId(nuevoId);
        setEditForm({
          concepto: copia["Concepto"],
          fecha: copia["Fecha"],
          base: String(copia["Base Imponible"]),
          iva: String(copia["IVA Soportado (€)"]),
          irpf: String(copia["IRPF Retenido (€)"] || ""),
          tipo: copia["Tipo de Gasto"] || "",
          period: copia["Periodicidad"] || ""
        });
      }
    } catch (e) {
      alert("Error al duplicar: " + e.message);
    }
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

  const renderGasto = (g, showPeriod = false) => {
    const isEditing = editId === g.id;
    const base = g.fields["Base Imponible"] || 0;
    const iva = g.fields["IVA Soportado (€)"] || 0;
    const irpf = g.fields["IRPF Retenido (€)"] || 0;
    const fecha = g.fields["Fecha"] || "";
    const periodo = g.fields["Periodicidad"] || "";
    const gastoFijoIds = g.fields["Gasto Fijo"] || [];
    const esFijo = gastoFijoIds.length > 0;

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
            <Inp label="Concepto" value={form.concepto} onChange={v => setForm({ ...form, concepto: v })} ph="Ej: Cuota SS" />
            <Inp label="Proveedor" value={form.proveedor} onChange={v => setForm({ ...form, proveedor: v })} ph="Ej: TGSS" />
            <Inp label="Fecha" value={form.fecha} onChange={v => setForm({ ...form, fecha: v })} type="date" />
            <Inp label="Base Imponible (€)" value={form.base} onChange={v => setForm({ ...form, base: v })} type="number" ph="0" />
            <Inp label="IVA Soportado (€)" value={form.iva} onChange={v => setForm({ ...form, iva: v })} type="number" ph="0 si no lleva IVA" />
            <Inp label="IRPF Retenido (€)" value={form.irpf} onChange={v => setForm({ ...form, irpf: v })} type="number" ph="Si proveedor autónomo" />
            <Sel label="Tipo de Gasto" value={form.tipo} onChange={v => setForm({ ...form, tipo: v })} options={["Fijo", "Variable", "Impuesto"]} />
            <Sel label="Periodicidad" value={form.period} onChange={v => setForm({ ...form, period: v })} options={["Mensual", "Trimestral", "Anual", "Puntual"]} />
          </div>

          {/* TOGGLE "¿Es un gasto fijo recurrente?" */}
          <div style={{
            marginTop: 18,
            padding: 14,
            background: form.esFijo ? B.purple + "10" : "rgba(0,0,0,0.03)",
            border: `2px solid ${form.esFijo ? B.purple : B.border}`,
            borderRadius: 10,
            transition: "all 0.2s ease"
          }}>
            <label style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              cursor: "pointer",
              userSelect: "none"
            }}>
              <input
                type="checkbox"
                checked={form.esFijo}
                onChange={e => setForm({ ...form, esFijo: e.target.checked })}
                style={{
                  width: 20,
                  height: 20,
                  accentColor: B.purple,
                  cursor: "pointer"
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, fontFamily: B.tS }}>
                  🔄 ¿Es un gasto fijo recurrente?
                </div>
                <div style={{ fontSize: 12, color: B.muted, marginTop: 2 }}>
                  Marca si es una suscripción o pago periódico (cuota SS, seguro, etc.)
                </div>
              </div>
            </label>

            {form.esFijo && (
              <div style={{
                marginTop: 14,
                display: "grid",
                gridTemplateColumns: `repeat(${Math.min(formColumns, 2)}, 1fr)`,
                gap: 12,
                paddingTop: 14,
                borderTop: `1px solid ${B.border}`
              }}>
                <Sel
                  label="Periodicidad del Fijo"
                  value={form.periodFijo}
                  onChange={v => setForm({ ...form, periodFijo: v })}
                  options={["Mensual", "Trimestral", "Anual"]}
                />
                <Sel
                  label="Moneda"
                  value={form.monedaFijo}
                  onChange={v => setForm({ ...form, monedaFijo: v })}
                  options={["EUR", "USD", "GBP"]}
                />
                {!form.proveedor && (
                  <div style={{
                    gridColumn: "1 / -1",
                    padding: "8px 12px",
                    background: B.amber + "15",
                    color: B.amber,
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: B.tS
                  }}>
                    ⚠️ Rellena el campo "Proveedor" arriba para identificar el gasto fijo
                  </div>
                )}
              </div>
            )}
          </div>

          <button onClick={save} disabled={sav || (form.esFijo && !form.proveedor.trim())} style={{
            ...B.btn,
            width: "100%",
            marginTop: 16,
            opacity: (sav || (form.esFijo && !form.proveedor.trim())) ? 0.5 : 1
          }}>
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

      {fijos.length > 0 && (
        <Card>
          <Lbl>Gastos Fijos ({fijos.length})</Lbl>
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

      {/* MODAL DE DUPLICADO (Gasto Fijo ya existe) */}
      {duplicadoModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
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
            maxWidth: 480,
            width: "100%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
          }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>⚠️</div>
            <div style={{
              fontSize: 16,
              fontWeight: 700,
              fontFamily: B.tS,
              marginBottom: 10
            }}>
              Ya existe un gasto fijo para «{duplicadoModal.proveedor}»
            </div>
            <div style={{
              fontSize: 13,
              color: B.muted,
              marginBottom: 20,
              lineHeight: 1.5
            }}>
              Tienes registrado un Gasto Fijo con este proveedor
              ({duplicadoModal.existente.fields["Activa"] === "Sí" ? "activo" : "dado de baja"}).
              El gasto ya se ha guardado correctamente. ¿Qué quieres hacer con la parte del Gasto Fijo?
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={enlazarAExistente} style={{
                ...B.btn,
                background: B.green,
                width: "100%"
              }}>
                ✅ ENLAZAR AL GASTO FIJO EXISTENTE
              </button>
              <button onClick={crearDuplicado} style={{
                ...B.btn,
                background: "transparent",
                color: B.purple,
                border: `2px solid ${B.purple}`,
                width: "100%"
              }}>
                ➕ CREAR UNO NUEVO (duplicado)
              </button>
              <button onClick={cancelarGastoFijo} style={{
                ...B.btn,
                background: "transparent",
                color: B.muted,
                border: `1px solid ${B.border}`,
                width: "100%"
              }}>
                NO ENLAZAR A NINGUNO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
