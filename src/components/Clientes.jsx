// src/components/Clientes.jsx
// Gestión de clientes con notas, estado activo/inactivo y facturas asociadas.
// Versión simplificada: el campo Estatus de Airtable siempre tiene un valor
// explícito ("Activo" o "Inactivo"), no necesitamos overrides ni helpers raros.

import { useState } from "react";
import { B, fmt, hoy } from "../utils.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { createRecord, updateRecord, deleteRecord } from "../api.js";
import { Card, Lbl, Sem, SectionHeader, TxtArea } from "./UI.jsx";

export default function Clientes({ clientes, ingresos, onRefresh }) {
  const { isMobile } = useResponsive();

  const [sel, setSel] = useState(null);
  const [del, setDel] = useState(null);
  const [updId, setUpdId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  // Filtros
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState("");

  // Estado local para edición de notas (clientId -> texto temporal)
  const [notasTmp, setNotasTmp] = useState({});
  const [notaSaving, setNotaSaving] = useState(null);

  // Indicador "guardando" del cambio de Estatus
  const [estatusSaving, setEstatusSaving] = useState(null);

  // ============================================================
  // ACCIONES
  // ============================================================
  const addCliente = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await createRecord("Clientes", { "Nombre": newName.trim(), "Estatus": "Activo" });
      setNewName("");
      setShowAdd(false);
      await onRefresh();
    } catch (e) {
      alert("Error al crear cliente: " + e.message);
    }
    setSaving(false);
  };

  const delFactura = async (id) => {
    setDel(id);
    try {
      await deleteRecord("Ingresos", id);
      await onRefresh();
    } catch (e) {
      alert("Error al borrar: " + e.message);
    }
    setDel(null);
  };

  const cambiarEstadoFactura = async (id, nuevoEstado) => {
    setUpdId(id);
    try {
      const fields = { "Estado": nuevoEstado };
      if (nuevoEstado === "Cobrada") fields["Fecha Cobro"] = hoy();
      await updateRecord("Ingresos", id, fields);
      await onRefresh();
    } catch (e) {
      alert("Error al actualizar: " + e.message);
    }
    setUpdId(null);
  };

  const guardarNota = async (clienteId) => {
    const texto = notasTmp[clienteId];
    if (texto === undefined) return;
    setNotaSaving(clienteId);
    try {
      await updateRecord("Clientes", clienteId, { "Notas": texto });
      setNotasTmp(prev => {
        const next = { ...prev };
        delete next[clienteId];
        return next;
      });
      await onRefresh();
    } catch (e) {
      alert("Error guardando notas: " + e.message);
    }
    setNotaSaving(null);
  };

  const toggleEstatus = async (clienteId, estatusActual) => {
    const nuevoEstatus = estatusActual === "Activo" ? "Inactivo" : "Activo";
    setEstatusSaving(clienteId);
    try {
      await updateRecord("Clientes", clienteId, { "Estatus": nuevoEstatus });
      await onRefresh();
    } catch (e) {
      alert("Error cambiando estatus: " + e.message);
    }
    setEstatusSaving(null);
  };

  // ============================================================
  // PROCESAR DATOS DE CLIENTES
  // ============================================================
  const cd = clientes
    .map(c => {
      const n = c.fields["Nombre"] || "Sin nombre";
      // Si el campo no está, asumimos Activo (cliente legado/nuevo recién creado)
      const estatus = c.fields["Estatus"] || "Activo";
      const activo = estatus === "Activo";
      const notas = c.fields["Notas"] || "";

      const fIds = c.fields["Ingresos"] || [];
      const fs = ingresos.filter(r => fIds.includes(r.id));
      const totBase = fs.reduce((s, f) => s + (f.fields["Base Imponible"] || 0), 0);
      const totIrpf = fs.reduce((s, f) => s + (f.fields["IRPF (€)"] || 0), 0);
      const benefNeto = totBase - totIrpf;
      const p = fs.filter(f => f.fields["Estado"] === "Pendiente").length;
      const v = fs.filter(f => f.fields["Estado"] === "Vencida").length;

      return {
        id: c.id,
        nombre: n,
        estatus,
        activo,
        notas,
        fs,
        totBase,
        totIrpf,
        benefNeto,
        p,
        v,
        bc: !activo ? B.muted : v > 0 ? B.red : p > 0 ? B.amber : B.green
      };
    })
    .filter(c => {
      if (!showInactive && !c.activo) return false;
      if (search && !c.nombre.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

  const totalActivos = clientes.filter(c => (c.fields["Estatus"] || "Activo") === "Activo").length;
  const totalInactivos = clientes.length - totalActivos;

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SectionHeader
        title="Clientes"
        action={
          <button onClick={() => setShowAdd(!showAdd)} style={B.btn}>
            {showAdd ? "CANCELAR" : "+ NUEVO CLIENTE"}
          </button>
        }
      />

      {/* Barra de filtros */}
      <div style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "center"
      }}>
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            ...B.inp,
            maxWidth: isMobile ? "100%" : 280,
            padding: "10px 14px",
            fontSize: 13
          }}
        />
        <button
          onClick={() => setShowInactive(!showInactive)}
          style={{
            ...B.btnSm,
            background: showInactive ? B.text : "transparent",
            color: showInactive ? "#fff" : B.muted,
            border: `1px solid ${showInactive ? B.text : B.border}`
          }}
        >
          {showInactive ? "OCULTAR INACTIVOS" : `MOSTRAR INACTIVOS (${totalInactivos})`}
        </button>
        <span style={{
          fontSize: 12,
          color: B.muted,
          fontFamily: B.tM,
          marginLeft: "auto"
        }}>
          {totalActivos} activos · {totalInactivos} inactivos
        </span>
      </div>

      {/* Formulario nuevo cliente */}
      {showAdd && (
        <Card style={{ border: `2px solid ${B.purple}` }}>
          <Lbl>Añadir Cliente</Lbl>
          <div style={{
            display: "flex",
            gap: 12,
            marginTop: 14,
            flexDirection: isMobile ? "column" : "row"
          }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Nombre del cliente"
              style={{ ...B.inp, flex: 1 }}
              onKeyDown={e => e.key === "Enter" && addCliente()}
            />
            <button
              onClick={addCliente}
              disabled={saving}
              style={{ ...B.btn, opacity: saving ? 0.5 : 1 }}
            >
              {saving ? "..." : "GUARDAR"}
            </button>
          </div>
        </Card>
      )}

      {/* Lista vacía */}
      {cd.length === 0 && (
        <Card>
          <p style={{ color: B.muted, fontFamily: B.tS, margin: 0 }}>
            {search || (!showInactive && totalInactivos > 0)
              ? "No hay clientes que coincidan con los filtros."
              : "No hay clientes. Añádelos manualmente o se crean al subir facturas."}
          </p>
        </Card>
      )}

      {/* Tarjetas de clientes */}
      {cd.map(c => {
        const isOpen = sel === c.id;
        const notaActual = notasTmp[c.id] !== undefined ? notasTmp[c.id] : c.notas;
        const notaCambiada = notasTmp[c.id] !== undefined && notasTmp[c.id] !== c.notas;

        return (
          <div
            key={c.id}
            style={{
              background: B.card,
              backdropFilter: "blur(14px)",
              borderRadius: 10,
              padding: 20,
              border: `1px solid ${B.border}`,
              borderLeft: `4px solid ${c.bc}`,
              opacity: c.activo ? 1 : 0.65,
              transition: "opacity 0.2s ease"
            }}
          >
            {/* Cabecera (clickable) */}
            <div
              onClick={() => setSel(isOpen ? null : c.id)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                gap: 12,
                flexWrap: isMobile ? "wrap" : "nowrap"
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 600,
                  fontSize: 15,
                  fontFamily: B.tS,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap"
                }}>
                  {c.nombre}
                  {!c.activo && (
                    <span style={{
                      background: B.muted + "20",
                      color: B.muted,
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 700,
                      fontFamily: B.tM,
                      textTransform: "uppercase"
                    }}>
                      Inactivo
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: B.muted, marginTop: 4 }}>
                  {c.fs.length} factura{c.fs.length !== 1 ? "s" : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, fontFamily: B.tM }}>{fmt(c.totBase)}</div>
                <div style={{ fontSize: 11, color: B.red, fontWeight: 600 }}>
                  IRPF: {fmt(c.totIrpf)}
                </div>
                <div style={{ fontSize: 11, color: B.green, fontWeight: 600 }}>
                  Neto: {fmt(c.benefNeto)}
                </div>
              </div>
            </div>

            {/* Insignias rápidas */}
            {(c.v > 0 || c.p > 0) && (
              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {c.v > 0 && (
                  <span style={{
                    background: B.red + "12",
                    color: B.red,
                    padding: "4px 10px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600
                  }}>
                    {c.v} vencida{c.v > 1 ? "s" : ""}
                  </span>
                )}
                {c.p > 0 && (
                  <span style={{
                    background: B.amber + "12",
                    color: B.amber,
                    padding: "4px 10px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600
                  }}>
                    {c.p} pendiente{c.p > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            )}

            {/* Panel desplegable */}
            {isOpen && (
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Toggle Estatus */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  paddingBottom: 12,
                  borderBottom: `1px solid ${B.border}`,
                  flexWrap: "wrap"
                }}>
                  <Lbl>Estatus del cliente</Lbl>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleEstatus(c.id, c.estatus); }}
                    disabled={estatusSaving === c.id}
                    style={{
                      ...B.btnSm,
                      background: c.activo ? B.green : B.muted,
                      opacity: estatusSaving === c.id ? 0.5 : 1,
                      transition: "background 0.2s ease"
                    }}
                  >
                    {estatusSaving === c.id
                      ? "GUARDANDO..."
                      : c.activo ? "ACTIVO · CAMBIAR A INACTIVO" : "INACTIVO · CAMBIAR A ACTIVO"}
                  </button>
                </div>

                {/* Notas */}
                <div onClick={e => e.stopPropagation()}>
                  <TxtArea
                    label="Notas internas"
                    value={notaActual}
                    onChange={txt => setNotasTmp(prev => ({ ...prev, [c.id]: txt }))}
                    ph="Apuntes sobre este cliente: condiciones especiales, contactos, recordatorios..."
                    rows={3}
                  />
                  {notaCambiada && (
                    <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                      <button
                        onClick={() => guardarNota(c.id)}
                        disabled={notaSaving === c.id}
                        style={{ ...B.btnSm, opacity: notaSaving === c.id ? 0.5 : 1 }}
                      >
                        {notaSaving === c.id ? "GUARDANDO..." : "GUARDAR NOTA"}
                      </button>
                      <button
                        onClick={() => setNotasTmp(prev => {
                          const next = { ...prev };
                          delete next[c.id];
                          return next;
                        })}
                        style={{
                          ...B.btnSm,
                          background: "transparent",
                          color: B.muted,
                          border: `1px solid ${B.border}`
                        }}
                      >
                        DESCARTAR
                      </button>
                    </div>
                  )}
                </div>

                {/* Facturas */}
                {c.fs.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <Lbl>Facturas</Lbl>
                    {c.fs.map(f => {
                      const irpfF = f.fields["IRPF (€)"] || 0;
                      return (
                        <div
                          key={f.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            background: "rgba(0,0,0,0.03)",
                            padding: "12px 14px",
                            borderRadius: 8,
                            fontSize: 13,
                            gap: 8,
                            flexWrap: "wrap"
                          }}
                        >
                          <span style={{ fontWeight: 700, fontFamily: B.tM, fontSize: 12, minWidth: 90 }}>
                            {f.fields["Nº Factura"] || "-"}
                          </span>
                          <span style={{ color: B.muted, minWidth: 80 }}>
                            {f.fields["Fecha"] || "-"}
                          </span>
                          <span style={{ fontWeight: 600, minWidth: 70 }}>
                            {fmt(f.fields["Base Imponible"])}
                          </span>
                          <span style={{ color: B.red, fontSize: 11, fontWeight: 600, minWidth: 60 }}>
                            IRPF {fmt(irpfF)}
                          </span>
                          <Sem estado={f.fields["Estado"] || "Pendiente"} />
                          <select
                            value={f.fields["Estado"] || "Pendiente"}
                            onClick={e => e.stopPropagation()}
                            onChange={e => { e.stopPropagation(); cambiarEstadoFactura(f.id, e.target.value); }}
                            disabled={updId === f.id}
                            style={{
                              padding: "4px 8px",
                              borderRadius: 4,
                              border: `1px solid ${B.border}`,
                              fontSize: 11,
                              fontFamily: B.tM,
                              cursor: "pointer",
                              background: updId === f.id ? "#eee" : "#fff"
                            }}
                          >
                            <option value="Pendiente">Pendiente</option>
                            <option value="Cobrada">Cobrada</option>
                            <option value="Vencida">Vencida</option>
                          </select>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              if (confirm("¿Borrar esta factura?")) delFactura(f.id);
                            }}
                            disabled={del === f.id}
                            style={{ ...B.btnDel, opacity: del === f.id ? 0.5 : 1 }}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
