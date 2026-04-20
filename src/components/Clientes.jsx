// src/components/Clientes.jsx
// Gestión completa de clientes: nombre, CIF, email, estado comercial, estatus,
// notas, facturas asociadas, y borrado seguro.

import { useState } from "react";
import { B, fmt, hoy } from "../utils.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { createRecord, updateRecord, deleteRecord } from "../api.js";
import { Card, Lbl, Sem, SectionHeader, TxtArea, Inp } from "./UI.jsx";

// ============================================================
// ESTADO COMERCIAL: colores y labels
// ============================================================
const ESTADOS_COMERCIAL = ["Al día", "Pendiente", "Moroso"];
function colorEstado(estado) {
  if (estado === "Al día") return B.green;
  if (estado === "Pendiente") return B.amber;
  if (estado === "Moroso") return B.red;
  return B.muted;
}

export default function Clientes({ clientes, ingresos, onRefresh }) {
  const { isMobile, formColumns } = useResponsive();

  const [sel, setSel] = useState(null);
  const [del, setDel] = useState(null);
  const [updId, setUpdId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  // Filtros
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState("");

  // Estado local para edición de cada campo (clientId -> valor temporal)
  const [nombresTmp, setNombresTmp] = useState({});
  const [nombreEditing, setNombreEditing] = useState(null);
  const [cifTmp, setCifTmp] = useState({});
  const [emailTmp, setEmailTmp] = useState({});
  const [notasTmp, setNotasTmp] = useState({});

  // Indicadores "guardando"
  const [fieldSaving, setFieldSaving] = useState(null); // "nombre-X", "cif-X", etc.
  const [estatusSaving, setEstatusSaving] = useState(null);
  const [estadoSaving, setEstadoSaving] = useState(null);
  const [deletingClient, setDeletingClient] = useState(null);

  // ============================================================
  // ACCIONES
  // ============================================================
  const addCliente = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await createRecord("Clientes", {
        "Nombre": newName.trim(),
        "Estatus": "Activo",
        "Estado": "Al día"
      });
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

  const guardarCampo = async (clienteId, fieldName, valor, tmpSetter) => {
    const key = `${fieldName}-${clienteId}`;
    setFieldSaving(key);
    try {
      await updateRecord("Clientes", clienteId, { [fieldName]: valor });
      tmpSetter(prev => {
        const next = { ...prev };
        delete next[clienteId];
        return next;
      });
      await onRefresh();
    } catch (e) {
      alert(`Error guardando ${fieldName}: ${e.message}`);
    }
    setFieldSaving(null);
  };

  const guardarNombre = async (clienteId) => {
    const texto = nombresTmp[clienteId];
    if (texto === undefined || !texto.trim()) return;
    await guardarCampo(clienteId, "Nombre", texto.trim(), setNombresTmp);
    setNombreEditing(null);
  };

  const guardarCif = (clienteId) => {
    const texto = cifTmp[clienteId];
    if (texto === undefined) return;
    return guardarCampo(clienteId, "CIF/NIF", texto.trim(), setCifTmp);
  };

  const guardarEmail = (clienteId) => {
    const texto = emailTmp[clienteId];
    if (texto === undefined) return;
    return guardarCampo(clienteId, "Email", texto.trim(), setEmailTmp);
  };

  const guardarNota = (clienteId) => {
    const texto = notasTmp[clienteId];
    if (texto === undefined) return;
    return guardarCampo(clienteId, "Notas", texto, setNotasTmp);
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

  const cambiarEstado = async (clienteId, nuevoEstado) => {
    setEstadoSaving(clienteId);
    try {
      await updateRecord("Clientes", clienteId, { "Estado": nuevoEstado });
      await onRefresh();
    } catch (e) {
      alert("Error cambiando estado: " + e.message);
    }
    setEstadoSaving(null);
  };

  const borrarCliente = async (clienteId, nombre, tieneFacturas) => {
    if (tieneFacturas) {
      alert(`No se puede borrar "${nombre}" porque tiene facturas asociadas. Borra primero las facturas o cambia el cliente a Inactivo.`);
      return;
    }
    if (!confirm(`¿Seguro que quieres borrar el cliente "${nombre}"? Esta acción no se puede deshacer.`)) return;

    setDeletingClient(clienteId);
    try {
      await deleteRecord("Clientes", clienteId);
      if (sel === clienteId) setSel(null);
      await onRefresh();
    } catch (e) {
      alert("Error al borrar cliente: " + e.message);
    }
    setDeletingClient(null);
  };

  // ============================================================
  // PROCESAR DATOS DE CLIENTES
  // ============================================================
  const cd = clientes
    .map(c => {
      const nombre = c.fields["Nombre"] || "Sin nombre";
      const estatus = c.fields["Estatus"] || "Activo";
      const activo = estatus === "Activo";
      const estado = c.fields["Estado"] || "Al día";
      const cif = c.fields["CIF/NIF"] || "";
      const email = c.fields["Email"] || "";
      const notas = c.fields["Notas"] || "";

      const fIds = c.fields["Ingresos"] || [];
      const fs = ingresos.filter(r => fIds.includes(r.id));
      const totBase = fs.reduce((s, f) => s + (f.fields["Base Imponible"] || 0), 0);
      const totIrpf = fs.reduce((s, f) => s + (f.fields["IRPF (€)"] || 0), 0);
      const benefNeto = totBase - totIrpf;
      const p = fs.filter(f => f.fields["Estado"] === "Pendiente").length;
      const v = fs.filter(f => f.fields["Estado"] === "Vencida").length;

      // Color del borde izquierdo: prioriza estado comercial si no está Al día
      let bc;
      if (!activo) bc = B.muted;
      else if (estado === "Moroso") bc = B.red;
      else if (estado === "Pendiente" || v > 0) bc = B.amber;
      else bc = B.green;

      return {
        id: c.id,
        nombre, estatus, activo, estado, cif, email, notas,
        fs, totBase, totIrpf, benefNeto, p, v, bc
      };
    })
    .filter(c => {
      if (!showInactive && !c.activo) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!c.nombre.toLowerCase().includes(s) &&
            !c.cif.toLowerCase().includes(s) &&
            !c.email.toLowerCase().includes(s)) {
          return false;
        }
      }
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
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Buscar por nombre, CIF o email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            ...B.inp,
            maxWidth: isMobile ? "100%" : 320,
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
          <p style={{ fontSize: 12, color: B.muted, marginTop: 10, marginBottom: 0 }}>
            Puedes añadir el CIF, email y más datos después al desplegar el cliente.
          </p>
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
        const isEditingName = nombreEditing === c.id;
        const nombreValor = nombresTmp[c.id] !== undefined ? nombresTmp[c.id] : c.nombre;

        const cifValor = cifTmp[c.id] !== undefined ? cifTmp[c.id] : c.cif;
        const cifCambiado = cifTmp[c.id] !== undefined && cifTmp[c.id] !== c.cif;

        const emailValor = emailTmp[c.id] !== undefined ? emailTmp[c.id] : c.email;
        const emailCambiado = emailTmp[c.id] !== undefined && emailTmp[c.id] !== c.email;

        const notaValor = notasTmp[c.id] !== undefined ? notasTmp[c.id] : c.notas;
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
            {/* Cabecera */}
            <div
              onClick={() => !isEditingName && setSel(isOpen ? null : c.id)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: isEditingName ? "default" : "pointer",
                gap: 12,
                flexWrap: isMobile ? "wrap" : "nowrap"
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Nombre (editable cuando está desplegado) */}
                {isEditingName ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }} onClick={e => e.stopPropagation()}>
                    <input
                      autoFocus
                      value={nombreValor}
                      onChange={e => setNombresTmp(prev => ({ ...prev, [c.id]: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === "Enter") guardarNombre(c.id);
                        if (e.key === "Escape") {
                          setNombresTmp(prev => { const n = { ...prev }; delete n[c.id]; return n; });
                          setNombreEditing(null);
                        }
                      }}
                      style={{ ...B.inp, maxWidth: 280, fontSize: 15, fontWeight: 600 }}
                    />
                    <button
                      onClick={() => guardarNombre(c.id)}
                      disabled={fieldSaving === `Nombre-${c.id}`}
                      style={B.btnSm}
                    >
                      {fieldSaving === `Nombre-${c.id}` ? "..." : "GUARDAR"}
                    </button>
                    <button
                      onClick={() => {
                        setNombresTmp(prev => { const n = { ...prev }; delete n[c.id]; return n; });
                        setNombreEditing(null);
                      }}
                      style={{
                        ...B.btnSm,
                        background: "transparent",
                        color: B.muted,
                        border: `1px solid ${B.border}`
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
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
                    {isOpen && (
                      <button
                        onClick={e => { e.stopPropagation(); setNombreEditing(c.id); }}
                        title="Editar nombre"
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          padding: 2,
                          fontSize: 13,
                          opacity: 0.6
                        }}
                      >
                        ✏️
                      </button>
                    )}
                    {/* Badge Estatus */}
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
                    {/* Badge Estado comercial (solo si no es "Al día") */}
                    {c.activo && c.estado !== "Al día" && (
                      <span style={{
                        background: colorEstado(c.estado) + "18",
                        color: colorEstado(c.estado),
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        fontFamily: B.tM,
                        textTransform: "uppercase"
                      }}>
                        {c.estado}
                      </span>
                    )}
                  </div>
                )}
                <div style={{ fontSize: 12, color: B.muted, marginTop: 4 }}>
                  {c.fs.length} factura{c.fs.length !== 1 ? "s" : ""}
                  {c.cif && <span> · {c.cif}</span>}
                </div>
              </div>
              {!isEditingName && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, fontFamily: B.tM }}>{fmt(c.totBase)}</div>
                  <div style={{ fontSize: 11, color: B.red, fontWeight: 600 }}>
                    IRPF: {fmt(c.totIrpf)}
                  </div>
                  <div style={{ fontSize: 11, color: B.green, fontWeight: 600 }}>
                    Neto: {fmt(c.benefNeto)}
                  </div>
                </div>
              )}
            </div>

            {/* Insignias rápidas de facturas */}
            {(c.v > 0 || c.p > 0) && !isEditingName && (
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
            {isOpen && !isEditingName && (
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Fila de Estatus (Activo/Inactivo) */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  paddingBottom: 12,
                  borderBottom: `1px solid ${B.border}`,
                  flexWrap: "wrap"
                }}>
                  <Lbl>Estatus</Lbl>
                  <button
                    onClick={e => { e.stopPropagation(); toggleEstatus(c.id, c.estatus); }}
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

                {/* Fila de Estado comercial */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  paddingBottom: 12,
                  borderBottom: `1px solid ${B.border}`,
                  flexWrap: "wrap"
                }}>
                  <Lbl>Estado de pagos</Lbl>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} onClick={e => e.stopPropagation()}>
                    {ESTADOS_COMERCIAL.map(opt => {
                      const isActive = c.estado === opt;
                      const col = colorEstado(opt);
                      return (
                        <button
                          key={opt}
                          onClick={() => cambiarEstado(c.id, opt)}
                          disabled={estadoSaving === c.id}
                          style={{
                            ...B.btnSm,
                            background: isActive ? col : "transparent",
                            color: isActive ? "#fff" : col,
                            border: `1px solid ${col}`,
                            opacity: estadoSaving === c.id ? 0.5 : 1
                          }}
                        >
                          {opt.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Campos CIF y Email en grid responsive */}
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${formColumns}, 1fr)`,
                    gap: 14
                  }}
                >
                  <div>
                    <Inp
                      label="CIF/NIF"
                      value={cifValor}
                      onChange={v => setCifTmp(prev => ({ ...prev, [c.id]: v }))}
                      ph="B12345678"
                    />
                    {cifCambiado && (
                      <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                        <button
                          onClick={() => guardarCif(c.id)}
                          disabled={fieldSaving === `CIF/NIF-${c.id}`}
                          style={{ ...B.btnSm, opacity: fieldSaving === `CIF/NIF-${c.id}` ? 0.5 : 1 }}
                        >
                          {fieldSaving === `CIF/NIF-${c.id}` ? "..." : "GUARDAR"}
                        </button>
                        <button
                          onClick={() => setCifTmp(prev => { const n = { ...prev }; delete n[c.id]; return n; })}
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

                  <div>
                    <Inp
                      label="Email"
                      value={emailValor}
                      onChange={v => setEmailTmp(prev => ({ ...prev, [c.id]: v }))}
                      type="email"
                      ph="contacto@empresa.com"
                    />
                    {emailCambiado && (
                      <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                        <button
                          onClick={() => guardarEmail(c.id)}
                          disabled={fieldSaving === `Email-${c.id}`}
                          style={{ ...B.btnSm, opacity: fieldSaving === `Email-${c.id}` ? 0.5 : 1 }}
                        >
                          {fieldSaving === `Email-${c.id}` ? "..." : "GUARDAR"}
                        </button>
                        <button
                          onClick={() => setEmailTmp(prev => { const n = { ...prev }; delete n[c.id]; return n; })}
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
                </div>

                {/* Notas */}
                <div onClick={e => e.stopPropagation()}>
                  <TxtArea
                    label="Notas internas"
                    value={notaValor}
                    onChange={txt => setNotasTmp(prev => ({ ...prev, [c.id]: txt }))}
                    ph="Apuntes sobre este cliente: condiciones especiales, contactos, recordatorios..."
                    rows={3}
                  />
                  {notaCambiada && (
                    <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                      <button
                        onClick={() => guardarNota(c.id)}
                        disabled={fieldSaving === `Notas-${c.id}`}
                        style={{ ...B.btnSm, opacity: fieldSaving === `Notas-${c.id}` ? 0.5 : 1 }}
                      >
                        {fieldSaving === `Notas-${c.id}` ? "GUARDANDO..." : "GUARDAR NOTA"}
                      </button>
                      <button
                        onClick={() => setNotasTmp(prev => { const n = { ...prev }; delete n[c.id]; return n; })}
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

                {/* Facturas del cliente */}
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

                {/* ZONA DE PELIGRO: borrar cliente */}
                <div style={{
                  marginTop: 8,
                  paddingTop: 16,
                  borderTop: `1px dashed ${B.border}`
                }}>
                  <div style={{
                    fontSize: 10,
                    fontFamily: B.tM,
                    color: B.muted,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 10
                  }}>
                    Zona de peligro
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      borrarCliente(c.id, c.nombre, c.fs.length > 0);
                    }}
                    disabled={deletingClient === c.id}
                    style={{
                      ...B.btnDel,
                      padding: "8px 16px",
                      fontSize: 11,
                      opacity: deletingClient === c.id ? 0.5 : (c.fs.length > 0 ? 0.6 : 1),
                      cursor: c.fs.length > 0 ? "not-allowed" : "pointer"
                    }}
                    title={c.fs.length > 0 ? "Borra primero las facturas asociadas" : "Borrar cliente"}
                  >
                    {deletingClient === c.id
                      ? "BORRANDO..."
                      : c.fs.length > 0
                        ? `🔒 NO SE PUEDE BORRAR (${c.fs.length} factura${c.fs.length > 1 ? "s" : ""})`
                        : "🗑 BORRAR CLIENTE"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
