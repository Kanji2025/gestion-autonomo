// src/components/Gastos.jsx
// Sección de Gastos: alta manual + OCR/IA + edición + duplicado + borrado.
// Detección AUTOMÁTICA de Gasto Fijo por proveedor.
// REDISEÑO 2026: solo colores de marca.

import { useState, useEffect, useRef } from "react";
import {
  Plus, X, Sparkles, Edit3, Copy, Trash2, Check,
  Calendar, Repeat, Link as LinkIcon, MoreVertical,
  Receipt, Percent, Hash
} from "lucide-react";

import { B, fmt, hoy, applyF } from "../utils.js";
import { useResponsive } from "../hooks/useResponsive.js";
import {
  createRecord, updateRecord, deleteRecord,
  findGastoFijoByProveedor, createGastoFijo, linkGastoToGastoFijo
} from "../api.js";
import { Card, Lbl, Inp, Sel, PageHeader, FilterBar, ErrorBox, Btn, IconPill } from "./UI.jsx";
import NuevoForm from "./NuevoForm.jsx";

// ============================================================
// MENU ITEM
// ============================================================
function MenuItem({ icon: Icon, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "10px 14px",
        textAlign: "left",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 500,
        fontFamily: B.font,
        color: B.ink,
        transition: "background 0.15s"
      }}
      onMouseEnter={e => e.currentTarget.style.background = "#f4f4f4"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <Icon size={15} strokeWidth={2} />
      {children}
    </button>
  );
}

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
          background: open ? "#f4f4f4" : "transparent",
          border: `1px solid ${B.border}`,
          borderRadius: 999,
          padding: "5px 7px",
          cursor: disabled ? "not-allowed" : "pointer",
          color: B.ink,
          opacity: disabled ? 0.5 : 1,
          display: "flex",
          transition: "background 0.15s ease"
        }}
        aria-label="Opciones"
      >
        <MoreVertical size={14} strokeWidth={2.25} />
      </button>
      {open && (
        <div style={{
          position: "absolute",
          right: 0,
          top: "calc(100% + 4px)",
          background: "#fff",
          border: `1px solid ${B.border}`,
          borderRadius: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
          minWidth: 160,
          zIndex: 50,
          overflow: "hidden"
        }}>
          <MenuItem icon={Edit3} onClick={() => { setOpen(false); onEdit(); }}>Editar</MenuItem>
          <MenuItem icon={Copy} onClick={() => { setOpen(false); onDuplicate(); }}>Duplicar</MenuItem>
          <MenuItem icon={Trash2} onClick={() => { setOpen(false); onDelete(); }}>Borrar</MenuItem>
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

  // KPIs del período
  const totalGastos = fg.reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0);
  const totalIVASoportado = fg.reduce((s, r) => s + (r.fields["IVA Soportado (€)"] || 0), 0);
  const numGastos = fg.length;

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
        if (found) setDetectado({ existe: true, gastoFijo: found });
        else setDetectado({ existe: false });
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
            if (nuevoFijoId) await linkGastoToGastoFijo(nuevoGastoId, nuevoFijoId);
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
      if (gastoFijoIds.length > 0) copia["Gasto Fijo"] = gastoFijoIds;

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

  const cancelEdit = () => setEditState(null);

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
      <Card style={{ border: `1px solid ${B.ink}` }}>
        <Lbl>Editar gasto</Lbl>
        {enlazado && (
          <div style={{
            marginTop: 12,
            padding: "10px 14px",
            background: "#f4f4f4",
            border: `1px solid ${B.border}`,
            borderRadius: 12,
            fontSize: 12,
            fontFamily: B.font,
            color: B.ink,
            display: "flex",
            alignItems: "center",
            gap: 8
          }}>
            <LinkIcon size={14} strokeWidth={2} />
            Enlazado a un Gasto Fijo. La periodicidad y tipo se gestionan allí.
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
          <Inp label="Base imponible (€)" value={ef.base} onChange={v => updateEditField("base", v)} type="number" />
          <Inp label="IVA soportado (€)" value={ef.iva} onChange={v => updateEditField("iva", v)} type="number" ph="0 si no lleva IVA" />
          <Inp label="IRPF retenido (€)" value={ef.irpf} onChange={v => updateEditField("irpf", v)} type="number" ph="0 si no aplica" />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <Btn size="lg" onClick={saveEdit} disabled={savingEdit} style={{ flex: 1 }}>
            {savingEdit ? "Guardando…" : "Guardar cambios"}
          </Btn>
          <Btn variant="outline" size="lg" onClick={cancelEdit} style={{ flex: 1 }}>
            Cancelar
          </Btn>
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
        background: "#fbfbfb",
        border: `1px solid ${B.border}`,
        borderRadius: 12,
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
            <div style={{
              fontWeight: 600,
              fontSize: 14,
              fontFamily: B.font,
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: B.ink
            }}>
              {esFijo && <Repeat size={14} strokeWidth={2} />}
              {g.fields["Concepto"] || "Sin concepto"}
            </div>
            <div style={{
              fontSize: 12,
              color: B.ink,
              marginTop: 4,
              fontFamily: B.font,
              display: "flex",
              alignItems: "center",
              gap: 5
            }}>
              <Calendar size={11} strokeWidth={2} />
              {fecha || "Sin fecha"}
              {showPeriod && periodo && <span>· {periodo}</span>}
            </div>
            <div style={{
              fontSize: 12,
              color: B.ink,
              marginTop: 6,
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              fontFamily: B.font
            }}>
              <span>Base: <strong style={{ color: B.ink, ...B.num }}>{fmt(base)}</strong></span>
              <span>
                IVA: {iva > 0
                  ? <strong style={{ color: B.ink, ...B.num }}>{fmt(iva)}</strong>
                  : <span style={{ fontStyle: "italic" }}>Sin IVA</span>}
              </span>
              {irpf > 0 && (
                <span>IRPF: <strong style={{ color: B.ink, ...B.num }}>{fmt(irpf)}</strong></span>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <div style={{ fontWeight: 700, fontFamily: B.font, fontSize: 15, color: B.ink, ...B.num }}>
              {fmt(base + iva)}
            </div>
            {showPeriod && periodo && (
              <div style={{
                fontSize: 11,
                color: B.ink,
                fontWeight: 600,
                fontFamily: B.font,
                ...B.num
              }}>
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
      <PageHeader
        title="Gastos."
        subtitle="Lo que pagas y lo que tienes que apartar para pagar."
        action={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn
              icon={Sparkles}
              iconBefore
              onClick={() => setShowOCR(true)}
              style={{ background: B.lavender, color: B.ink, border: `1px solid ${B.ink}` }}
            >
              OCR + IA
            </Btn>
            <Btn
              icon={showFManual ? X : Plus}
              iconBefore
              onClick={() => setShowFManual(!showFManual)}
            >
              {showFManual ? "Cancelar" : "Manual"}
            </Btn>
          </div>
        }
      />

     <FilterBar filtro={filtro} setFiltro={setFiltro} />

      {/* KPIs DEL PERÍODO — total, IVA soportado, nº de gastos */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
        gap: 12
      }}>
        <Card>
          <IconPill icon={Receipt} />
          <div style={{ marginTop: 14 }}>
            <Lbl>Total gastos</Lbl>
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
            {fmt(totalGastos)}
          </div>
          <div style={{ fontSize: B.ty.small, color: B.muted, marginTop: 4, fontFamily: B.font }}>
            Del período seleccionado
          </div>
        </Card>

        <Card>
          <IconPill icon={Percent} />
          <div style={{ marginTop: 14 }}>
            <Lbl>IVA soportado</Lbl>
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
            {fmt(totalIVASoportado)}
          </div>
          <div style={{ fontSize: B.ty.small, color: B.muted, marginTop: 4, fontFamily: B.font }}>
            Recuperable en la declaración
          </div>
        </Card>

        <Card>
          <IconPill icon={Hash} />
          <div style={{ marginTop: 14 }}>
            <Lbl>Número de gastos</Lbl>
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
            {numGastos}
          </div>
          <div style={{ fontSize: B.ty.small, color: B.muted, marginTop: 4, fontFamily: B.font }}>
            En este período
          </div>
        </Card>
      </div>

      {/* TOAST DE DUPLICADO — amarillo Kanji */}
      {duplicadoToast && (
        <div style={{
          background: B.yellow,
          border: `1px solid ${B.ink}`,
          borderRadius: 16,
          padding: "14px 18px",
          color: B.ink,
          fontFamily: B.font,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap"
        }}>
          <div style={{
            display: "inline-flex",
            padding: 8,
            background: "rgba(0,0,0,0.0)",
            borderRadius: 999
          }}>
            <Check size={16} strokeWidth={2.5} color={B.ink} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              Gasto duplicado: «{duplicadoToast.concepto}»
            </div>
            <div style={{ fontSize: 12, marginTop: 2 }}>
              Copia creada con fecha {duplicadoToast.fecha}.
              {duplicadoToast.heredado && " Enlazada al mismo Gasto Fijo."} Pulsa ⋮ → Editar en la copia si necesitas modificar algo.
            </div>
          </div>
          <button
            onClick={() => setDuplicadoToast(null)}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: B.ink, padding: 4, display: "flex" }}
            aria-label="Cerrar"
          >
            <X size={16} strokeWidth={2.25} />
          </button>
        </div>
      )}

      {/* FORMULARIO MANUAL */}
      {showFManual && (
        <Card style={{ border: `1px solid ${B.ink}` }}>
          <Lbl>Añadir gasto manual</Lbl>
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
            <Inp label="Base imponible (€)" value={form.base} onChange={v => setForm({ ...form, base: v })} type="number" ph="0" />
            <Inp label="IVA soportado (€)" value={form.iva} onChange={v => setForm({ ...form, iva: v })} type="number" ph="0 si no lleva IVA" />
            <Inp label="IRPF retenido (€)" value={form.irpf} onChange={v => setForm({ ...form, irpf: v })} type="number" ph="Si proveedor autónomo" />
          </div>

          {/* DETECCIÓN POR PROVEEDOR */}
          {form.proveedor.trim() && (
            <div style={{ marginTop: 18 }}>
              {buscandoProv && (
                <div style={{
                  padding: "10px 14px",
                  background: "#f4f4f4",
                  borderRadius: 12,
                  fontSize: 12,
                  color: B.ink,
                  fontFamily: B.font
                }}>
                  Comprobando si «{form.proveedor.trim()}» ya está registrado como Gasto Fijo…
                </div>
              )}

              {!buscandoProv && detectado?.existe && (
                <div style={{
                  padding: 16,
                  background: form.esPuntual ? "#f4f4f4" : "#fff",
                  border: `1px solid ${form.esPuntual ? B.border : B.ink}`,
                  borderRadius: 14,
                  transition: "all 0.2s ease"
                }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: B.font,
                    color: B.ink,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap"
                  }}>
                    {form.esPuntual
                      ? <X size={15} strokeWidth={2.25} />
                      : <LinkIcon size={15} strokeWidth={2.25} />}
                    {form.esPuntual
                      ? `Este pago se guardará como puntual (no enlazado a «${detectado.gastoFijo.fields["Nombre"] || detectado.gastoFijo.fields["Proveedor"]}»)`
                      : `Se enlazará al Gasto Fijo «${detectado.gastoFijo.fields["Nombre"] || detectado.gastoFijo.fields["Proveedor"]}»`}
                  </div>
                  <label style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 14,
                    cursor: "pointer",
                    userSelect: "none"
                  }}>
                    <input
                      type="checkbox"
                      checked={form.esPuntual}
                      onChange={e => setForm({ ...form, esPuntual: e.target.checked })}
                      style={{ width: 18, height: 18, accentColor: B.ink, cursor: "pointer" }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600, fontFamily: B.font, color: B.ink }}>
                      Este pago es puntual (no contar como Gasto Fijo)
                    </span>
                  </label>
                  <div style={{ fontSize: 12, color: B.ink, marginTop: 4, paddingLeft: 28, fontFamily: B.font }}>
                    Marca esto si el proveedor coincide pero este gasto NO es el recurrente.
                  </div>
                </div>
              )}

              {!buscandoProv && detectado?.existe === false && (
                <div style={{
                  padding: 16,
                  background: form.altaComoFijo ? "#fff" : "#fbfbfb",
                  border: `1px solid ${form.altaComoFijo ? B.ink : B.border}`,
                  borderRadius: 14,
                  transition: "all 0.2s ease"
                }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", userSelect: "none" }}>
                    <input
                      type="checkbox"
                      checked={form.altaComoFijo}
                      onChange={e => setForm({ ...form, altaComoFijo: e.target.checked })}
                      style={{ width: 20, height: 20, accentColor: B.ink, cursor: "pointer" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontWeight: 700,
                        fontSize: 14,
                        fontFamily: B.font,
                        color: B.ink,
                        display: "flex",
                        alignItems: "center",
                        gap: 6
                      }}>
                        <Plus size={14} strokeWidth={2.25} />
                        Dar de alta «{form.proveedor.trim()}» como Gasto Fijo
                      </div>
                      <div style={{ fontSize: 12, color: B.ink, marginTop: 2, fontFamily: B.font }}>
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

          <Btn onClick={save} disabled={sav} size="lg" style={{ width: "100%", marginTop: 16 }}>
            {sav ? "Guardando…" : "Guardar gasto"}
          </Btn>
        </Card>
      )}

      {/* EDITOR INLINE */}
      {editState && <EditForm />}

      {/* APARTA CADA MES — amarillo Kanji + dos columnas limpias */}
      <div style={{
        background: B.yellow,
        borderRadius: 20,
        padding: "clamp(22px, 3vw, 30px)",
        border: `1px solid ${B.ink}`,
        color: B.ink
      }}>
        <Lbl>Aparta cada mes</Lbl>
        <div style={{
          fontSize: B.ty.display,
          fontWeight: 700,
          marginTop: 8,
          fontFamily: B.font,
          letterSpacing: "-0.035em",
          lineHeight: 1,
          ...B.num
        }}>
          {fmt(prorrateo.total)}
        </div>
        <div style={{
          fontSize: B.ty.small,
          color: B.ink,
          marginTop: 10,
          fontFamily: B.font,
          lineHeight: 1.5,
          maxWidth: 480
        }}>
          Total a apartar — todos los Gastos Fijos activos prorrateados a mensual.
        </div>

        <div style={{
          marginTop: 24,
          paddingTop: 22,
          borderTop: `1px solid ${B.ink}22`,
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: isMobile ? 22 : 32
        }}>
          <div>
            <Lbl>Reduce IRPF</Lbl>
            <div style={{
              fontSize: B.ty.numL,
              fontWeight: 700,
              fontFamily: B.font,
              marginTop: 8,
              color: B.ink,
              letterSpacing: "-0.015em",
              ...B.num
            }}>
              {fmt(prorrateo.deducible + prorrateo.cuotaSS)}
            </div>
            <div style={{ fontSize: 12, color: B.ink, marginTop: 4, fontFamily: B.font, lineHeight: 1.4 }}>
              Deducibles{prorrateo.cuotaSS > 0 && ` + Cuota SS (${fmt(prorrateo.cuotaSS)})`}
            </div>
          </div>

          <div>
            <Lbl>Solo ocupa caja</Lbl>
            <div style={{
              fontSize: B.ty.numL,
              fontWeight: 700,
              fontFamily: B.font,
              marginTop: 8,
              color: B.ink,
              letterSpacing: "-0.015em",
              ...B.num
            }}>
              {fmt(prorrateo.noDeducible)}
            </div>
            <div style={{ fontSize: 12, color: B.ink, marginTop: 4, fontFamily: B.font, lineHeight: 1.4 }}>
              No deducibles (aplazamientos, IVA fraccionado…)
            </div>
          </div>
        </div>
      </div>

      {/* LISTAS DE GASTOS */}
      {fijos.length > 0 && (
        <Card>
          <Lbl>Gastos fijos del período ({fijos.length})</Lbl>
          <div style={{ marginTop: 14 }}>
            {fijos.map(g => renderGasto(g, true))}
          </div>
        </Card>
      )}

      {vars.length > 0 && (
        <Card>
          <Lbl>Gastos variables ({vars.length})</Lbl>
          <div style={{ marginTop: 14 }}>
            {vars.map(g => renderGasto(g, false))}
          </div>
        </Card>
      )}

      {fijos.length === 0 && vars.length === 0 && (
        <Card>
          <p style={{ color: B.ink, fontFamily: B.font, margin: 0, fontSize: B.ty.body }}>
            No hay gastos en el período seleccionado.
          </p>
        </Card>
      )}
    </div>
  );
}
