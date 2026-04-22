// src/components/Facturas.jsx
// Sección de Facturas (Ingresos): listado + buscador + edición inline + borrado.

import { useState } from "react";
import { B, fmt, hoy, applyF } from "../utils.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { updateRecord, deleteRecord } from "../api.js";
import { Card, Lbl, Inp, Sel, Sem, SectionHeader, FilterBar } from "./UI.jsx";
import NuevoForm from "./NuevoForm.jsx";

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

  // Mapa para resolver clienteId → nombre
  const clienteMap = {};
  clientes.forEach(c => {
    clienteMap[c.id] = c.fields["Nombre"] || "Sin nombre";
  });

  const facturasProcesadas = fi.map(f => {
    const clienteIds = f.fields["Cliente"] || [];
    const clienteNombre = clienteIds.length > 0 ? (clienteMap[clienteIds[0]] || "Cliente eliminado") : "Sin cliente";
    return {
      id: f.id,
      raw: f,
      numero: f.fields["Nº Factura"] || "-",
      fecha: f.fields["Fecha"] || "",
      cliente: clienteNombre,
      base: f.fields["Base Imponible"] || 0,
      iva: f.fields["IVA (€)"] || 0,
      irpf: f.fields["IRPF (€)"] || 0,
      total: (f.fields["Base Imponible"] || 0) + (f.fields["IVA (€)"] || 0) - (f.fields["IRPF (€)"] || 0),
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

      // Si marca Cobrada y no hay fecha de cobro, ponemos hoy
      if (editForm.estado === "Cobrada" && !editForm.fechaCobro) {
        fields["Fecha Cobro"] = hoy();
      } else if (editForm.fechaCobro) {
        fields["Fecha Cobro"] = editForm.fechaCobro;
      }

      // IVA e IRPF: solo si los campos NO son fórmula en Airtable
      // (lo enviamos por si acaso; si Airtable lo ignora porque es fórmula, no pasa nada)
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
  // CAMBIO DE ESTADO RÁPIDO (sin abrir editor)
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
  // RENDER DEL FORMULARIO DE NUEVA FACTURA
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
  // RENDER DEL EDITOR INLINE
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
        ℹ️ Si los campos IVA/IRPF en tu Airtable son fórmulas automáticas, los valores que escribas aquí se ignorarán. Para editarlos, hazlos manuales en Airtable.
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
  // RENDER DE UNA FACTURA INDIVIDUAL
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
              {fmt(f.total)}
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
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => startEdit(f)}
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
                onClick={() => del(f.id)}
                disabled={delId === f.id}
                style={{ ...B.btnDel, padding: "4px 10px", fontSize: 10, opacity: delId === f.id ? 0.5 : 1 }}
              >
                BORRAR
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // CÁLCULOS DE RESUMEN
  // ============================================================
  const totalBase = facturasProcesadas.reduce((s, f) => s + f.base, 0);
  const totalCobradas = facturasProcesadas.filter(f => f.estado === "Cobrada").reduce((s, f) => s + f.base, 0);
  const totalPendientes = facturasProcesadas.filter(f => f.estado === "Pendiente").reduce((s, f) => s + f.base, 0);
  const totalVencidas = facturasProcesadas.filter(f => f.estado === "Vencida").reduce((s, f) => s + f.base, 0);

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

      {/* Buscador */}
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

      {/* KPIs rápidos */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
        gap: 10
      }}>
        <div style={{ background: B.card, padding: "12px 14px", borderRadius: 8, border: `1px solid ${B.border}` }}>
          <div style={{ fontSize: 10, color: B.muted, fontFamily: B.tM, textTransform: "uppercase" }}>Total</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: B.tM, color: B.purple }}>{fmt(totalBase)}</div>
        </div>
        <div style={{ background: B.card, padding: "12px 14px", borderRadius: 8, border: `1px solid ${B.border}` }}>
          <div style={{ fontSize: 10, color: B.muted, fontFamily: B.tM, textTransform: "uppercase" }}>Cobrado</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: B.tM, color: B.green }}>{fmt(totalCobradas)}</div>
        </div>
        <div style={{ background: B.card, padding: "12px 14px", borderRadius: 8, border: `1px solid ${B.border}` }}>
          <div style={{ fontSize: 10, color: B.muted, fontFamily: B.tM, textTransform: "uppercase" }}>Pendiente</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: B.tM, color: B.amber }}>{fmt(totalPendientes)}</div>
        </div>
        <div style={{ background: B.card, padding: "12px 14px", borderRadius: 8, border: `1px solid ${B.border}` }}>
          <div style={{ fontSize: 10, color: B.muted, fontFamily: B.tM, textTransform: "uppercase" }}>Vencido</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: B.tM, color: B.red }}>{fmt(totalVencidas)}</div>
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
