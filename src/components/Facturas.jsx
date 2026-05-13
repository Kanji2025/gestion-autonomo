// src/components/Facturas.jsx
// Sección de Facturas (Ingresos): listado + buscador + edición + duplicado + borrado.
// REDISEÑO 2026 paleta marca. Mantiene toda la lógica (OCR, duplicar, edit inline).

import { useState, useEffect, useRef } from "react";
import {
  Plus, Sparkles, Search, Calendar, MoreVertical,
  Edit3, Copy, Trash2, Check, X, Info,
  Receipt, Wallet, CheckCircle2, Clock
} from "lucide-react";

import { B, fmt, hoy, applyF } from "../utils.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { createRecord, updateRecord, deleteRecord } from "../api.js";
import {
  Card, Lbl, Inp, Sel, StatusPill, PageHeader, FilterBar, Btn, IconPill
} from "./UI.jsx";
import NuevoForm from "./NuevoForm.jsx";

// ============================================================
// MENÚ DE 3 PUNTOS — iconos lucide, todo negro
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
          borderRadius: 999,
          padding: 6,
          cursor: disabled ? "not-allowed" : "pointer",
          color: B.muted,
          opacity: disabled ? 0.5 : 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center"
        }}
        aria-label="Opciones"
      >
        <MoreVertical size={14} strokeWidth={2} />
      </button>
      {open && (
        <div style={{
          position: "absolute",
          right: 0,
          top: "calc(100% + 6px)",
          background: "#fff",
          border: `1px solid ${B.border}`,
          borderRadius: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
          minWidth: 160,
          zIndex: 50,
          overflow: "hidden"
        }}>
          <MenuItem icon={Edit3} onClick={() => { setOpen(false); onEdit(); }}>
            Editar
          </MenuItem>
          <MenuItem icon={Copy} onClick={() => { setOpen(false); onDuplicate(); }}>
            Duplicar
          </MenuItem>
          <MenuItem icon={Trash2} onClick={() => { setOpen(false); onDelete(); }}>
            Borrar
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, onClick, children }) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f8f8")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
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
        transition: "background 0.12s ease"
      }}
    >
      <Icon size={14} strokeWidth={2} />
      {children}
    </button>
  );
}

// ============================================================
// SUB-COMPONENTE KPI (4 tarjetas arriba)
// ============================================================
function KPICard({ icon: Icon, label, value, hint }) {
  return (
    <Card>
      <IconPill icon={Icon} />
      <div style={{ marginTop: 14 }}>
        <Lbl>{label}</Lbl>
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
        {value}
      </div>
      <div style={{
        fontSize: B.ty.small,
        color: B.muted,
        marginTop: 4,
        fontFamily: B.font
      }}>
        {hint}
      </div>
    </Card>
  );
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
  // PROCESAR FACTURAS
  // facturasAll = TODAS las facturas procesadas (para KPIs estables)
  // facturasProcesadas = filtradas por fecha + búsqueda (para listado)
  // ============================================================
  const clienteMap = {};
  clientes.forEach(c => {
    clienteMap[c.id] = c.fields["Nombre"] || "Sin nombre";
  });

  const procesar = (f) => {
    const clienteIds = f.fields["Cliente"] || [];
    const clienteNombre = clienteIds.length > 0
      ? (clienteMap[clienteIds[0]] || "Cliente eliminado")
      : "Sin cliente";
    const base = f.fields["Base Imponible"] || 0;
    const iva = f.fields["IVA (€)"] || 0;
    const irpf = f.fields["IRPF (€)"] || 0;
    return {
      id: f.id,
      raw: f,
      numero: f.fields["Nº Factura"] || "—",
      fecha: f.fields["Fecha"] || "",
      clienteId: clienteIds[0] || null,
      cliente: clienteNombre,
      base,
      iva,
      irpf,
      totalConIva: base + iva - irpf,
      neto: base - irpf,
      estado: f.fields["Estado"] || "Pendiente",
      fechaVenc: f.fields["Fecha Vencimiento"] || "",
      fechaCobro: f.fields["Fecha Cobro"] || ""
    };
  };

  // Todas las facturas (para KPIs)
  const facturasAll = ingresos.map(procesar);

  // Filtradas por fecha + búsqueda (para listado)
  const facturasProcesadas = applyF(ingresos, filtro).map(procesar).filter(f => {
    if (!search) return true;
    const s = search.toLowerCase();
    return f.numero.toLowerCase().includes(s) || f.cliente.toLowerCase().includes(s);
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
      numero: f.numero === "—" ? "" : f.numero,
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
  // DUPLICAR (lógica intacta: no enviamos IVA/IRPF porque son fórmulas)
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

      const created = await createRecord("Ingresos", copia);
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

      await onRefresh();
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
  // FORMULARIO DE NUEVA FACTURA (OCR + IA → NuevoForm)
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
  // EDITOR INLINE — Card con borde negro destacado
  // ============================================================
  const renderEditForm = () => (
    <Card style={{
      border: `1px solid ${B.ink}`,
      marginTop: 8,
      marginBottom: 8
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <IconPill icon={Edit3} size={28} />
        <Lbl>Editar factura</Lbl>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${formColumns}, 1fr)`,
        gap: 14
      }}>
        <Inp label="Nº Factura" value={editForm.numero} onChange={v => setEditForm({ ...editForm, numero: v })} ph="F00012026" />
        <Inp label="Fecha" value={editForm.fecha} onChange={v => setEditForm({ ...editForm, fecha: v })} type="date" />
        <Inp label="Base imponible (€)" value={editForm.base} onChange={v => setEditForm({ ...editForm, base: v })} type="number" />
        <Inp label="IVA (€)" value={editForm.iva} onChange={v => setEditForm({ ...editForm, iva: v })} type="number" ph="0 si exenta" />
        <Inp label="IRPF (€)" value={editForm.irpf} onChange={v => setEditForm({ ...editForm, irpf: v })} type="number" ph="0 si no aplica" />
        <Sel label="Estado" value={editForm.estado} onChange={v => setEditForm({ ...editForm, estado: v })} options={["Cobrada", "Pendiente", "Vencida"]} />
        <Inp label="Fecha de vencimiento" value={editForm.fechaVenc} onChange={v => setEditForm({ ...editForm, fechaVenc: v })} type="date" />
        <Inp label="Fecha de cobro" value={editForm.fechaCobro} onChange={v => setEditForm({ ...editForm, fechaCobro: v })} type="date" />
      </div>

      <div style={{
        marginTop: 14,
        padding: "12px 14px",
        background: "#fafafa",
        border: `1px solid ${B.border}`,
        borderRadius: 12,
        fontSize: 12,
        color: B.muted,
        fontFamily: B.font,
        lineHeight: 1.5,
        display: "flex",
        alignItems: "flex-start",
        gap: 8
      }}>
        <Info size={13} strokeWidth={2.25} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          Si en Airtable los campos <strong>IVA</strong> e <strong>IRPF</strong> son fórmulas automáticas (calculados desde la base), los valores que escribas aquí se ignorarán.
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        <Btn onClick={saveEdit} disabled={savingEdit} icon={Check} iconBefore>
          {savingEdit ? "Guardando…" : "Guardar cambios"}
        </Btn>
        <Btn onClick={cancelEdit} variant="outline" icon={X} iconBefore>
          Cancelar
        </Btn>
      </div>
    </Card>
  );

  // ============================================================
  // ITEM DE UNA FACTURA
  // ============================================================
  const renderFactura = (f) => {
    if (editId === f.id) return <div key={f.id}>{renderEditForm()}</div>;

    return (
      <div
        key={f.id}
        style={{
          background: "#fafafa",
          border: `1px solid ${B.border}`,
          borderRadius: 14,
          padding: "14px 16px",
          marginBottom: 10
        }}
      >
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap"
        }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            {/* Nº factura + StatusPill */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{
                fontWeight: 700,
                fontFamily: B.font,
                fontSize: 13,
                color: B.ink,
                ...B.num
              }}>
                {f.numero}
              </span>
              <StatusPill estado={f.estado} />
            </div>
            {/* Cliente */}
            <div style={{
              fontWeight: 600,
              fontSize: 15,
              fontFamily: B.font,
              marginTop: 6,
              color: B.ink,
              letterSpacing: "-0.01em"
            }}>
              {f.cliente}
            </div>
            {/* Fechas */}
            <div style={{
              fontSize: 12,
              color: B.muted,
              marginTop: 4,
              fontFamily: B.font,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap"
            }}>
              <Calendar size={11} strokeWidth={2} />
              <span style={B.num}>{f.fecha || "Sin fecha"}</span>
              {f.fechaVenc && <span style={B.num}> · Vence {f.fechaVenc}</span>}
              {f.fechaCobro && <span style={B.num}> · Cobrada {f.fechaCobro}</span>}
            </div>
            {/* Desglose Base / IVA / IRPF */}
            <div style={{
              fontSize: 11,
              color: B.muted,
              marginTop: 8,
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
              fontWeight: 500
            }}>
              <span style={B.num}>Base · <strong style={{ color: B.ink }}>{fmt(f.base)}</strong></span>
              <span style={B.num}>IVA · <strong style={{ color: B.ink }}>{fmt(f.iva)}</strong></span>
              {f.irpf > 0 && <span style={B.num}>IRPF · <strong style={{ color: B.ink }}>{fmt(f.irpf)}</strong></span>}
            </div>
          </div>

          {/* Columna derecha: total + neto + controles */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 8
          }}>
            <div style={{
              fontWeight: 700,
              fontFamily: B.font,
              fontSize: B.ty.numM,
              color: B.ink,
              letterSpacing: "-0.015em",
              ...B.num
            }}>
              {fmt(f.totalConIva)}
            </div>
            <div style={{
              fontSize: 11,
              color: B.muted,
              fontWeight: 500,
              ...B.num
            }}>
              Neto · {fmt(f.neto)}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <select
                value={f.estado}
                onChange={e => cambiarEstado(f.id, e.target.value)}
                style={{
                  padding: "5px 10px",
                  borderRadius: 999,
                  border: `1px solid ${B.border}`,
                  fontSize: 11,
                  fontFamily: B.font,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: "#fff",
                  color: B.ink
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
      </div>
    );
  };

  // ============================================================
  // KPIs (totales del listado filtrado)
  // ============================================================
  const totalBase = facturasAll.reduce((s, f) => s + f.base, 0);
  const totalNeto = facturasAll.reduce((s, f) => s + f.neto, 0);
  const totalCobradas = facturasAll
    .filter(f => f.estado === "Cobrada")
    .reduce((s, f) => s + f.base, 0);
  const totalPendientes = facturasAll
    .filter(f => f.estado === "Pendiente" || f.estado === "Vencida")
    .reduce((s, f) => s + f.base, 0);

  // ============================================================
  // RENDER PRINCIPAL
  // ============================================================
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <PageHeader
        title="Facturas."
        subtitle="Lo que has emitido, lo que has cobrado y lo que sigue pendiente."
        action={
          <Btn
            onClick={() => setShowNueva(true)}
            icon={Sparkles}
            iconBefore
            style={{
              background: B.lavender,
              color: B.ink,
              border: `1px solid ${B.ink}`
            }}
          >
            Nueva factura
          </Btn>
        }
      />

      {/* KPIs — acumulados totales */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
        gap: 12
      }}>
        <KPICard
          icon={Receipt}
          label="Base total"
          value={fmt(totalBase)}
          hint="Facturado bruto"
        />
        <KPICard
          icon={Wallet}
          label="Neto (sin IRPF)"
          value={fmt(totalNeto)}
          hint="Lo que te queda"
        />
        <KPICard
          icon={CheckCircle2}
          label="Cobrado"
          value={fmt(totalCobradas)}
          hint="En tu cuenta"
        />
        <KPICard
          icon={Clock}
          label="Pendiente"
          value={fmt(totalPendientes)}
          hint="Por cobrar"
        />
      </div>

      {/* FILTROS Y BÚSQUEDA — afectan solo al listado de abajo */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        marginTop: 4
      }}>
        <FilterBar filtro={filtro} setFiltro={setFiltro} />
        <div style={{
          position: "relative",
          width: isMobile ? "100%" : 360,
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
            placeholder="Buscar por nº de factura o cliente…"
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
      </div>

      {/* Lista vacía */}
      {facturasProcesadas.length === 0 && (
        <Card>
          <p style={{ color: B.muted, fontFamily: B.font, margin: 0, fontSize: 14 }}>
            {search
              ? "No hay facturas que coincidan con la búsqueda."
              : "No hay facturas en el período seleccionado. Crea una nueva con OCR o manualmente."}
          </p>
        </Card>
      )}

      {/* Listado — filtrado por filtros y búsqueda */}
      {facturasProcesadas.length > 0 && (
        <Card>
          <Lbl>Resultados ({facturasProcesadas.length})</Lbl>
          <div style={{ marginTop: 14 }}>
            {facturasProcesadas.map(renderFactura)}
          </div>
        </Card>
      )}
    </div>
  );
}
