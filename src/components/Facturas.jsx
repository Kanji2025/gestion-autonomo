// src/components/Facturas.jsx
// Sección de Facturas (Ingresos): listado + buscador + edición + duplicado + borrado.
// Menú de 3 puntos (⋮) con Editar/Duplicar/Borrar.

import { useState, useEffect, useRef } from "react";
import { B, fmt, hoy, applyF } from "../utils.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { createRecord, updateRecord, deleteRecord } from "../api.js";
import { Card, Lbl, Inp, Sel, Sem, SectionHeader, FilterBar } from "./UI.jsx";
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
export default function FacturasView({ ingresos, clientes, onRefresh, filtro, setFiltro }) {
  const { isMobile, formColumns } = useResponsive();

  const [showNueva, setShowNueva] = useState(false);
  const [search, setSearch] = useState("");
  const [delId, setDelId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // ============================================================
  // PROCESAR Y FILTRAR FACTURAS
  // ============================================================
  const fi = applyF(ingresos, filtro);

  const clienteMap = {};
  clientes.forEach(c => {
    clienteMap[c.id] = c.fields["Nombre"] || "Sin nombre";
  });

  const facturasProcesadas = fi.map(f => {
    const clienteIds = f.fields["Cliente"] || [];
    const clienteNombre = clienteIds.length > 0 ? (clienteMap[clienteIds[0]] || "Cliente eliminado") : "Sin cliente";
    const base = f.fields["Base Imponible"] || 0;
    const iva = f.fields["IVA (€)"] || 0;
    const irpf = f.fields["IRPF (€)"] || 0;
    return {
      id: f.id,
      raw: f,
      numero: f.fields["Nº Factura"] || "-",
      fecha: f.fields["Fecha"] || "",
      clienteId: clienteIds[0] || null,
      cliente: clienteNombre,
      base,
      iva,
      irpf,
      totalConIva: base + iva,
      neto: base - irpf,
      estado: f.fields["Estado"] || "Pendiente",
      fechaVenc: f.fields["Fecha Vencimiento"] || "",
      fechaCobro: f.fields["Fecha Cobro"] || ""
    };
  }).filter(f => {
    if (!search) return true;
    const s = search.toLowerCase();
    return f.numero.toLowerCase().includes(s) ||
           f.cliente.toLowerCase().includes(s);
  }).sort((a, b) => {
    if (!a.fecha) return 1;
    if (!b.fecha) return -1;
    return b.fecha.localeCompare(a.fecha);
  });

  // ============================================================
  // EDICIÓN INLINE
  // ============================================================
  const startEdit = (f) => {
    setEditId(f.id);
    setEditForm({
      numero: f.numero === "-" ? "" : f.numero,
      fecha: f.fecha || hoy(),
      base: String(f.base || ""),
      iva: String(f.iva || ""),
      irpf: String(f.irpf || ""),
      estado: f.estado || "Pendiente",
      fechaVenc: f.fechaVenc || "",
      fechaCobro: f.fechaCobro || ""
    });
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditForm(null);
  };

  const saveEdit = async () => {
    if (!editForm.base) {
      alert("La base es obligatoria");
      return;
    }
    setSavingEdit(true);
    try {
      const fields = {
        "Nº Factura": editForm.numero || "",
        "Base Imponible": Number(editForm.base) || 0,
        "Estado": editForm.estado || "Pendiente"
      };
      if (editForm.fecha) fields["Fecha"] = editForm.fecha;
      if (editForm.fechaVenc) fields["Fecha Vencimiento"] = editForm.fechaVenc;

      if (editForm.estado === "Cobrada" && !editForm.fechaCobro) {
        fields["Fecha Cobro"] = hoy();
      } else if (editForm.fechaCobro) {
        fields["Fecha Cobro"] = editForm.fechaCobro;
      }

      if (editForm.iva !== "") fields["IVA (€)"] = Number(editForm.iva);
      if (editForm.irpf !== "") fields["IRPF (€)"] = Number(editForm.irpf);

      await updateRecord("Ingresos", editId, fields);
      cancelEdit();
      await onRefresh();
    } catch (e) {
      alert("Error al actualizar: " + e.message);
    }
    setSavingEdit(false);
  };

  // ============================================================
  // BORRAR
  // ============================================================
  const del = async (id) => {
    if (!confirm("¿Borrar esta factura?")) return;
    setDelId(id);
    try {
      await deleteRecord("Ingresos", id);
      await onRefresh();
    } catch (e) {
      alert("Error al borrar: " + e.message);
    }
    setDelId(null);
  };

  // ============================================================
  // DUPLICAR
  // ============================================================
  const duplicar = async (f) => {
    try {
      const copia = {
        "Nº Factura": "",
        "Fecha": hoy(),
        "Base Imponible": f.base || 0,
        "Estado": "Pendiente"
      };
      if (f.clienteId) copia["Cliente"] = [f.clienteId];
      // IVA e IRPF se enviarán, y si son fórmula en Airtable se ignorarán
      if (f.iva) copia["IVA (€)"] = f.iva;
      if (f.irpf) copia["IRPF (€)"] = f.irpf;

      const created = await createRecord("Ingresos", copia);
      await onRefresh();

      // Abrir el editor en la copia recién creada
      const nuevoId = created.records?.[0]?.id;
      if (nuevoId) {
        setEditId(nuevoId);
        setEditForm({
          numero: "",
          fecha: copia["Fecha"],
          base: String(copia["Base Imponible"]),
          iva: String(f.iva || ""),
          irpf: String(f.irpf || ""),
          estado: "Pendiente",
          fechaVenc: "",
          fechaCobro: ""
        });
      }
    } catch (e) {
      alert("Error al duplicar: " + e.message);
    }
  };

  // ============================================================
  // CAMBIO DE ESTADO RÁPIDO
  // ============================================================
  const cambiarEstado = async (id, nuevoEstado) => {
    try {
      const fields = { "Estado": nuevoEstado };
      if (nuevoEstado === "Cobrada") fields["Fecha Cobro"] = hoy();
      await updateRecord("Ingresos", id, fields);
      await onRefresh();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  // ============================================================
  // NUEVA FACTURA (OCR)
  // ============================================================
  if (showNueva) {
    return (
      <NuevoForm
        defaultTipo="ingreso"
        lockTipo={true}
        onClose={() => setShowNueva(false)}
        onSaved={() => { onRefresh(); }}
      />
    );
  }

  // ============================================================
  // EDITOR INLINE
  // ============================================================
  const renderEditForm = () => (
    <Card style={{ border: `2px solid ${B.purple}`, marginTop: 8, marginBottom: 8 }}>
      <Lbl><span style={{ color: B.purple }}>EDITAR FACTURA</span></Lbl>
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${formColumns}, 1fr)`,
        gap: 14,
        marginTop: 14
      }}>
        <Inp label="Nº Factura" value={editForm.numero} onChange={v => setEditForm({ ...editForm, numero: v })} ph="F00012026" />
        <Inp label="Fecha" value={editForm.fecha} onChange={v => setEditForm({ ...editForm, fecha: v })} type="date" />
        <Inp label="Base Imponible (€)" value={editForm.base} onChange={v => setEditForm({ ...editForm, base: v })} type="number" />
        <Inp label="IVA (€)" value={editForm.iva} onChange={v => setEditForm({ ...editForm, iva: v })} type="number" ph="0 si es exenta" />
        <Inp label="IRPF (€)" value={editForm.irpf} onChange={v => setEditForm({ ...editForm, irpf: v })} type="number" ph="0 si no aplica" />
        <Sel label="Estado" value={editForm.estado} onChange={v => setEditForm({ ...editForm, estado: v })} options={["Cobrada", "Pendiente", "Vencida"]} />
        <Inp label="Fecha Vencimiento" value={editForm.fechaVenc} onChange={v => setEditForm({ ...editForm, fechaVenc: v })} type="date" />
        <Inp label="Fecha Cobro" value={editForm.fechaCobro} onChange={v => setEditForm({ ...editForm, fechaCobro: v })} type="date" />
      </div>

      <div style={{
        marginTop: 12,
        padding: "8px 12px",
        background: B.muted + "10",
        borderRadius: 6,
        fontSize: 11,
        color: B.muted,
        fontFamily: B.tS
      }}>
        ℹ️ Si los campos IVA/IRPF en tu Airtable son fórmulas automáticas, los valores que escribas aquí se ignorarán.
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

  // ============================================================
  // RENDER DE UNA FACTURA
  // ============================================================
  const renderFactura = (f) => {
    if (editId === f.id) return <div key={f.id}>{renderEditForm()}</div>;

    return (
      <div key={f.id} style={{
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
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, fontFamily: B.tM, fontSize: 13 }}>
                {f.numero}
              </span>
              <Sem estado={f.estado} />
            </div>
            <div style={{ fontWeight: 600, fontSize: 14, fontFamily: B.tS, marginTop: 4 }}>
              {f.cliente}
            </div>
            <div style={{ fontSize: 12, color: B.muted, marginTop: 2, fontFamily: B.tM }}>
              📅 {f.fecha || "Sin fecha"}
              {f.fechaVenc && <span> · Vence: {f.fechaVenc}</span>}
              {f.fechaCobro && <span> · Cobrada: {f.fechaCobro}</span>}
            </div>
            <div style={{ fontSize: 11, color: B.muted, marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span>Base: <strong style={{ color: B.text }}>{fmt(f.base)}</strong></span>
              <span>IVA: <strong style={{ color: B.green }}>{fmt(f.iva)}</strong></span>
              {f.irpf > 0 && <span>IRPF: <strong style={{ color: B.red }}>{fmt(f.irpf)}</strong></span>}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <div style={{ fontWeight: 700, fontFamily: B.tM, fontSize: 16 }}>
              {fmt(f.totalConIva)}
            </div>
            <div style={{ fontSize: 11, color: B.green, fontWeight: 600 }}>
              Neto: {fmt(f.neto)}
            </div>
            <select
              value={f.estado}
              onChange={e => cambiarEstado(f.id, e.target.value)}
              style={{
                padding: "4px 8px",
                borderRadius: 4,
                border: `1px solid ${B.border}`,
                fontSize: 11,
                fontFamily: B.tM,
                cursor: "pointer",
                background: "#fff"
              }}
            >
              <option value="Pendiente">Pendiente</option>
              <option value="Cobrada">Cobrada</option>
              <option value="Vencida">Vencida</option>
            </select>
            <DotMenu
              onEdit={() => startEdit(f)}
              onDuplicate={() => duplicar(f)}
              onDelete={() => del(f.id)}
              disabled={delId === f.id}
            />
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // KPIs (totales del listado filtrado)
  // ============================================================
  const totalBase = facturasProcesadas.reduce((s, f) => s + f.base, 0);
  const totalNeto = facturasProcesadas.reduce((s, f) => s + f.neto, 0);
  const totalCobradas = facturasProcesadas.filter(f => f.estado === "Cobrada").reduce((s, f) => s + f.base, 0);
  const totalPendientes = facturasProcesadas.filter(f => f.estado === "Pendiente" || f.estado === "Vencida").reduce((s, f) => s + f.base, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <SectionHeader
        title="Facturas"
        action={
          <button onClick={() => setShowNueva(true)} style={B.btn}>
            + NUEVA FACTURA
          </button>
        }
      />

      <FilterBar filtro={filtro} setFiltro={setFiltro} />

      <input
        type="text"
        placeholder="Buscar por nº factura o cliente..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          ...B.inp,
          maxWidth: isMobile ? "100%" : 360,
          padding: "10px 14px",
          fontSize: 13
        }}
      />

      {/* KPIs */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
        gap: 10
      }}>
        <div style={{ background: B.card, padding: "12px 14px", borderRadius: 8, border: `1px solid ${B.border}` }}>
          <div style={{ fontSize: 10, color: B.muted, fontFamily: B.tM, textTransform: "uppercase" }}>Base Total</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: B.tM, color: B.purple }}>{fmt(totalBase)}</div>
        </div>
        <div style={{ background: B.card, padding: "12px 14px", borderRadius: 8, border: `1px solid ${B.border}` }}>
          <div style={{ fontSize: 10, color: B.muted, fontFamily: B.tM, textTransform: "uppercase" }}>Neto (sin IRPF)</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: B.tM, color: B.green }}>{fmt(totalNeto)}</div>
        </div>
        <div style={{ background: B.card, padding: "12px 14px", borderRadius: 8, border: `1px solid ${B.border}` }}>
          <div style={{ fontSize: 10, color: B.muted, fontFamily: B.tM, textTransform: "uppercase" }}>Cobrado</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: B.tM, color: B.green }}>{fmt(totalCobradas)}</div>
        </div>
        <div style={{ background: B.card, padding: "12px 14px", borderRadius: 8, border: `1px solid ${B.border}` }}>
          <div style={{ fontSize: 10, color: B.muted, fontFamily: B.tM, textTransform: "uppercase" }}>Pendiente</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: B.tM, color: B.amber }}>{fmt(totalPendientes)}</div>
        </div>
      </div>

      {/* Lista */}
      {facturasProcesadas.length === 0 && (
        <Card>
          <p style={{ color: B.muted, fontFamily: B.tS, margin: 0 }}>
            No hay facturas {search ? "que coincidan con la búsqueda" : "en el período seleccionado"}.
          </p>
        </Card>
      )}

      {facturasProcesadas.length > 0 && (
        <Card>
          <Lbl>Listado ({facturasProcesadas.length})</Lbl>
          <div style={{ marginTop: 14 }}>
            {facturasProcesadas.map(renderFactura)}
          </div>
        </Card>
      )}
    </div>
  );
}
