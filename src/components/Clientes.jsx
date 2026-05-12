// src/components/Clientes.jsx
// Gestión completa de clientes. REDISEÑO 2026 con paleta marca.

import { useState } from "react";
import {
  Plus, Search, X, Edit3, Check, Trash2,
  Lock, UserCheck, UserX, AlertCircle, Clock
} from "lucide-react";

import { B, fmt, hoy } from "../utils.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { createRecord, updateRecord, deleteRecord } from "../api.js";
import {
  Card, Lbl, StatusPill, TxtArea, Inp, PageHeader, Btn
} from "./UI.jsx";

// ============================================================
// ESTADOS COMERCIALES + helpers de color
// ============================================================
const ESTADOS_COMERCIAL = ["Al día", "Pendiente", "Moroso"];

// Borde lateral según estado/actividad. Solo paleta marca.
function colorBordeLateral(estado, activo, tieneVencidas) {
  if (!activo) return B.border;
  if (estado === "Moroso" || tieneVencidas) return B.ink;
  if (estado === "Pendiente") return B.yellow;
  return B.lavender; // Al día
}

// Estilo del chip de Estado cuando está activo (selección)
function activoEstiloPill(estado) {
  if (estado === "Moroso") return { bg: B.ink, fg: "#fff" };
  if (estado === "Pendiente") return { bg: B.yellow, fg: B.ink };
  return { bg: B.lavender, fg: B.ink };
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function Clientes({ clientes, ingresos, onRefresh }) {
  const { isMobile, formColumns } = useResponsive();

  const [sel, setSel] = useState(null);
  const [del, setDel] = useState(null);
  const [updId, setUpdId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState("");

  const [nombresTmp, setNombresTmp] = useState({});
  const [nombreEditing, setNombreEditing] = useState(null);
  const [cifTmp, setCifTmp] = useState({});
  const [emailTmp, setEmailTmp] = useState({});
  const [notasTmp, setNotasTmp] = useState({});

  const [fieldSaving, setFieldSaving] = useState(null);
  const [estatusSaving, setEstatusSaving] = useState(null);
  const [estadoSaving, setEstadoSaving] = useState(null);
  const [deletingClient, setDeletingClient] = useState(null);

  // ============================================================
  // ACCIONES (lógica intacta)
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
      alert(`No se puede borrar "${nombre}" porque tiene facturas asociadas. Borra primero las facturas o cámbialo a Inactivo.`);
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
  // PROCESAR DATOS
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

      const bc = colorBordeLateral(estado, activo, v > 0);

      return {
        id: c.id, nombre, estatus, activo, estado, cif, email, notas,
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
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <PageHeader
        title="Clientes."
        subtitle="Quiénes te pagan, qué te deben y cuánto facturan en total."
        action={
          <Btn
            onClick={() => setShowAdd(!showAdd)}
            icon={showAdd ? X : Plus}
            iconBefore
            variant={showAdd ? "outline" : "primary"}
          >
            {showAdd ? "Cancelar" : "Nuevo cliente"}
          </Btn>
        }
      />

      {/* BARRA DE FILTROS */}
      <div style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "center"
      }}>
        <div style={{
          position: "relative",
          flex: isMobile ? "1 1 100%" : "0 0 320px",
          maxWidth: "100%"
        }}>
          <Search
            size={15}
            strokeWidth={2}
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              color: B.muted,
              pointerEvents: "none"
            }}
          />
          <input
            type="text"
            placeholder="Buscar por nombre, CIF o email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              ...B.inp,
              padding: "10px 14px 10px 38px",
              fontSize: 13
            }}
            onFocus={e => (e.target.style.borderColor = B.ink)}
            onBlur={e => (e.target.style.borderColor = B.border)}
          />
        </div>

        <Btn
          variant={showInactive ? "primary" : "outline"}
          size="sm"
          onClick={() => setShowInactive(!showInactive)}
          icon={showInactive ? UserCheck : UserX}
          iconBefore
        >
          {showInactive
            ? "Ocultar inactivos"
            : `Mostrar inactivos${totalInactivos > 0 ? ` (${totalInactivos})` : ""}`}
        </Btn>

        <span style={{
          fontSize: 12,
          color: B.muted,
          fontFamily: B.font,
          marginLeft: "auto",
          ...B.num
        }}>
          {totalActivos} activos · {totalInactivos} inactivos
        </span>
      </div>

      {/* FORM NUEVO CLIENTE */}
      {showAdd && (
        <Card style={{ border: `1px solid ${B.ink}` }}>
          <Lbl>Añadir cliente</Lbl>
          <div style={{
            display: "flex",
            gap: 10,
            marginTop: 14,
            flexDirection: isMobile ? "column" : "row"
          }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Nombre del cliente"
              style={{ ...B.inp, flex: 1 }}
              onKeyDown={e => e.key === "Enter" && addCliente()}
              onFocus={e => (e.target.style.borderColor = B.ink)}
              onBlur={e => (e.target.style.borderColor = B.border)}
              autoFocus
            />
            <Btn
              onClick={addCliente}
              disabled={saving || !newName.trim()}
              icon={Check}
              iconBefore
            >
              {saving ? "Guardando…" : "Guardar"}
            </Btn>
          </div>
          <p style={{
            fontSize: 12,
            color: B.muted,
            marginTop: 10,
            marginBottom: 0,
            fontFamily: B.font
          }}>
            Puedes añadir CIF, email y más datos después al desplegar el cliente.
          </p>
        </Card>
      )}

      {/* LISTA VACÍA */}
      {cd.length === 0 && (
        <Card>
          <p style={{ color: B.muted, fontFamily: B.font, margin: 0, fontSize: 14 }}>
            {search || (!showInactive && totalInactivos > 0)
              ? "No hay clientes que coincidan con los filtros."
              : "No hay clientes todavía. Añádelos manualmente o se crean automáticamente al guardar facturas."}
          </p>
        </Card>
      )}

      {/* TARJETAS DE CLIENTE */}
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
              background: B.surface,
              borderRadius: 20,
              border: `1px solid ${B.border}`,
              borderLeft: `4px solid ${c.bc}`,
              padding: "clamp(18px, 2.6vw, 24px)",
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
                {isEditingName ? (
                  <div
                    style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
                    onClick={e => e.stopPropagation()}
                  >
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
                      onFocus={e => (e.target.style.borderColor = B.ink)}
                      onBlur={e => (e.target.style.borderColor = B.border)}
                    />
                    <Btn
                      size="sm"
                      onClick={() => guardarNombre(c.id)}
                      disabled={fieldSaving === `Nombre-${c.id}`}
                      icon={Check}
                      iconBefore
                    >
                      {fieldSaving === `Nombre-${c.id}` ? "Guardando…" : "Guardar"}
                    </Btn>
                    <Btn
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setNombresTmp(prev => { const n = { ...prev }; delete n[c.id]; return n; });
                        setNombreEditing(null);
                      }}
                      icon={X}
                      iconBefore
                    >
                      Cancelar
                    </Btn>
                  </div>
                ) : (
                  <div style={{
                    fontWeight: 600,
                    fontSize: 16,
                    fontFamily: B.font,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                    color: B.ink,
                    letterSpacing: "-0.01em"
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
                          padding: 4,
                          display: "inline-flex",
                          alignItems: "center",
                          color: B.muted
                        }}
                      >
                        <Edit3 size={13} strokeWidth={2} />
                      </button>
                    )}
                    {!c.activo && (
                      <span style={{
                        background: B.border,
                        color: B.muted,
                        padding: "2px 9px",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 600,
                        fontFamily: B.font,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em"
                      }}>
                        Inactivo
                      </span>
                    )}
                    {c.activo && c.estado !== "Al día" && (
                      <span style={{
                        background: activoEstiloPill(c.estado).bg,
                        color: activoEstiloPill(c.estado).fg,
                        padding: "2px 9px",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 600,
                        fontFamily: B.font,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em"
                      }}>
                        {c.estado}
                      </span>
                    )}
                  </div>
                )}
                <div style={{
                  fontSize: 12,
                  color: B.muted,
                  marginTop: 4,
                  fontFamily: B.font,
                  ...B.num
                }}>
                  {c.fs.length} factura{c.fs.length !== 1 ? "s" : ""}
                  {c.cif && <span> · {c.cif}</span>}
                </div>
              </div>

              {!isEditingName && (
                <div style={{ textAlign: "right" }}>
                  <div style={{
                    fontWeight: 700,
                    fontFamily: B.font,
                    fontSize: B.ty.numM,
                    color: B.ink,
                    letterSpacing: "-0.015em",
                    ...B.num
                  }}>
                    {fmt(c.totBase)}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: B.muted,
                    fontWeight: 500,
                    fontFamily: B.font,
                    marginTop: 2,
                    ...B.num
                  }}>
                    IRPF · {fmt(c.totIrpf)}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: B.ink,
                    fontWeight: 600,
                    fontFamily: B.font,
                    marginTop: 1,
                    ...B.num
                  }}>
                    Neto · {fmt(c.benefNeto)}
                  </div>
                </div>
              )}
            </div>

            {/* CHIPS VENCIDAS/PENDIENTES */}
            {(c.v > 0 || c.p > 0) && !isEditingName && (
              <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {c.v > 0 && (
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    background: B.ink,
                    color: "#fff",
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: B.font
                  }}>
                    <AlertCircle size={11} strokeWidth={2.5} />
                    {c.v} vencida{c.v > 1 ? "s" : ""}
                  </span>
                )}
                {c.p > 0 && (
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    background: B.yellow,
                    color: B.ink,
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: B.font
                  }}>
                    <Clock size={11} strokeWidth={2.5} />
                    {c.p} pendiente{c.p > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            )}

            {/* PANEL DESPLEGADO */}
            {isOpen && !isEditingName && (
              <div style={{
                marginTop: 20,
                paddingTop: 20,
                borderTop: `1px solid ${B.border}`,
                display: "flex",
                flexDirection: "column",
                gap: 22
              }}>
                {/* Estatus */}
                <div onClick={e => e.stopPropagation()}>
                  <Lbl>Estatus</Lbl>
                  <div style={{ marginTop: 8 }}>
                    <Btn
                      variant={c.activo ? "primary" : "outline"}
                      size="sm"
                      onClick={() => toggleEstatus(c.id, c.estatus)}
                      disabled={estatusSaving === c.id}
                      icon={c.activo ? UserCheck : UserX}
                      iconBefore
                    >
                      {estatusSaving === c.id
                        ? "Guardando…"
                        : c.activo
                          ? "Activo · cambiar a inactivo"
                          : "Inactivo · cambiar a activo"}
                    </Btn>
                  </div>
                </div>

                {/* Estado comercial */}
                <div onClick={e => e.stopPropagation()}>
                  <Lbl>Estado de pagos</Lbl>
                  <div style={{
                    marginTop: 8,
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap"
                  }}>
                    {ESTADOS_COMERCIAL.map(opt => {
                      const isActive = c.estado === opt;
                      const style = isActive ? activoEstiloPill(opt) : null;
                      return (
                        <button
                          key={opt}
                          onClick={() => cambiarEstado(c.id, opt)}
                          disabled={estadoSaving === c.id}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 999,
                            border: `1px solid ${isActive ? B.ink : B.border}`,
                            background: isActive ? style.bg : "transparent",
                            color: isActive ? style.fg : B.muted,
                            fontFamily: B.font,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: estadoSaving === c.id ? "not-allowed" : "pointer",
                            opacity: estadoSaving === c.id ? 0.5 : 1,
                            transition: "all 0.15s ease",
                            letterSpacing: "0.005em"
                          }}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* CIF y Email */}
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
                      <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                        <Btn
                          size="sm"
                          onClick={() => guardarCif(c.id)}
                          disabled={fieldSaving === `CIF/NIF-${c.id}`}
                          icon={Check}
                          iconBefore
                        >
                          {fieldSaving === `CIF/NIF-${c.id}` ? "…" : "Guardar"}
                        </Btn>
                        <Btn
                          size="sm"
                          variant="ghost"
                          onClick={() => setCifTmp(prev => { const n = { ...prev }; delete n[c.id]; return n; })}
                        >
                          Descartar
                        </Btn>
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
                      <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                        <Btn
                          size="sm"
                          onClick={() => guardarEmail(c.id)}
                          disabled={fieldSaving === `Email-${c.id}`}
                          icon={Check}
                          iconBefore
                        >
                          {fieldSaving === `Email-${c.id}` ? "…" : "Guardar"}
                        </Btn>
                        <Btn
                          size="sm"
                          variant="ghost"
                          onClick={() => setEmailTmp(prev => { const n = { ...prev }; delete n[c.id]; return n; })}
                        >
                          Descartar
                        </Btn>
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
                    ph="Apuntes sobre este cliente: condiciones especiales, contactos, recordatorios…"
                    rows={3}
                  />
                  {notaCambiada && (
                    <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                      <Btn
                        size="sm"
                        onClick={() => guardarNota(c.id)}
                        disabled={fieldSaving === `Notas-${c.id}`}
                        icon={Check}
                        iconBefore
                      >
                        {fieldSaving === `Notas-${c.id}` ? "Guardando…" : "Guardar nota"}
                      </Btn>
                      <Btn
                        size="sm"
                        variant="ghost"
                        onClick={() => setNotasTmp(prev => { const n = { ...prev }; delete n[c.id]; return n; })}
                      >
                        Descartar
                      </Btn>
                    </div>
                  )}
                </div>

                {/* Facturas */}
                {c.fs.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <Lbl>Facturas</Lbl>
                    {c.fs.map(f => {
                      const irpfF = f.fields["IRPF (€)"] || 0;
                      const estadoFactura = f.fields["Estado"] || "Pendiente";
                      return (
                        <div
                          key={f.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            background: "#fafafa",
                            padding: "12px 14px",
                            borderRadius: 12,
                            fontSize: 13,
                            gap: 10,
                            flexWrap: "wrap",
                            fontFamily: B.font,
                            border: `1px solid ${B.border}`
                          }}
                        >
                          <span style={{
                            fontWeight: 600,
                            fontSize: 12,
                            minWidth: 90,
                            color: B.ink,
                            ...B.num
                          }}>
                            {f.fields["Nº Factura"] || "—"}
                          </span>
                          <span style={{
                            color: B.muted,
                            minWidth: 80,
                            fontSize: 12,
                            ...B.num
                          }}>
                            {f.fields["Fecha"] || "—"}
                          </span>
                          <span style={{
                            fontWeight: 600,
                            minWidth: 70,
                            color: B.ink,
                            ...B.num
                          }}>
                            {fmt(f.fields["Base Imponible"])}
                          </span>
                          <span style={{
                            color: B.muted,
                            fontSize: 11,
                            fontWeight: 500,
                            minWidth: 70,
                            ...B.num
                          }}>
                            IRPF · {fmt(irpfF)}
                          </span>

                          <StatusPill estado={estadoFactura} />

                          <select
                            value={estadoFactura}
                            onClick={e => e.stopPropagation()}
                            onChange={e => { e.stopPropagation(); cambiarEstadoFactura(f.id, e.target.value); }}
                            disabled={updId === f.id}
                            style={{
                              padding: "5px 10px",
                              borderRadius: 999,
                              border: `1px solid ${B.border}`,
                              fontSize: 11,
                              fontFamily: B.font,
                              fontWeight: 600,
                              cursor: updId === f.id ? "not-allowed" : "pointer",
                              background: updId === f.id ? "#f0f0f0" : "#fff",
                              color: B.ink
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
                            title="Borrar factura"
                            style={{
                              background: "transparent",
                              border: `1px solid ${B.border}`,
                              borderRadius: 999,
                              padding: 6,
                              cursor: del === f.id ? "not-allowed" : "pointer",
                              opacity: del === f.id ? 0.5 : 1,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: B.muted
                            }}
                          >
                            <Trash2 size={13} strokeWidth={2} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Zona de peligro */}
                <div style={{
                  marginTop: 4,
                  paddingTop: 18,
                  borderTop: `1px dashed ${B.border}`
                }}>
                  <Lbl>Zona de peligro</Lbl>
                  <div style={{ marginTop: 8 }}>
                    {c.fs.length > 0 ? (
                      <Btn
                        variant="outline"
                        size="sm"
                        icon={Lock}
                        iconBefore
                        disabled
                        style={{ cursor: "not-allowed" }}
                      >
                        No se puede borrar ({c.fs.length} factura{c.fs.length > 1 ? "s" : ""})
                      </Btn>
                    ) : (
                      <Btn
                        variant="danger"
                        size="sm"
                        icon={Trash2}
                        iconBefore
                        onClick={e => {
                          e.stopPropagation();
                          borrarCliente(c.id, c.nombre, false);
                        }}
                        disabled={deletingClient === c.id}
                      >
                        {deletingClient === c.id ? "Borrando…" : "Borrar cliente"}
                      </Btn>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
