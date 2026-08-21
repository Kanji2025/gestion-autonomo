// src/components/Proyectos.jsx
// Trabajo comprometido: proyectos cerrados, en marcha, entregados y facturados.
// Tabla Airtable: "Proyectos"
// Campos: Proyecto, Cliente (link a Clientes), Estado, Fecha inicio,
//         Fecha entrega, Importe, Carpeta, Notas

import { useState, useMemo } from "react";
import {
  Plus, X, Check, Edit3, Trash2, ExternalLink, Clock,
  AlertCircle, CalendarClock, Play, PackageCheck, Receipt,
  CircleDashed, Briefcase, Euro, RotateCcw
} from "lucide-react";

import { B, fmt, hoy, diasEntre } from "../utils.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { createRecord, updateRecord, deleteRecord, findOrCreateClient } from "../api.js";
import {
  Card, Lbl, Inp, Sel, TxtArea, PageHeader, Btn, IconPill, ErrorBox
} from "./UI.jsx";

// ============================================================
// CONSTANTES
// ============================================================
const ESTADOS = ["Sin empezar", "En proceso", "Entregado", "Facturado"];
// Estados que aún requieren que hagas algo
const EN_MARCHA = ["Sin empezar", "En proceso"];

const FORM_VACIO = {
  proyecto: "",
  clienteNombre: "",
  estado: "Sin empezar",
  fechaInicio: hoy(),
  fechaEntrega: "",
  importe: "",
  carpeta: "",
  notas: ""
};

function fechaCorta(f) {
  if (!f) return "—";
  try {
    return new Date(f).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  } catch {
    return f;
  }
}

// ============================================================
// CHIP GENÉRICO
// ============================================================
function Chip({ icon: Icon, children }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      background: "#fff",
      border: `1px solid ${B.border}`,
      borderRadius: 999,
      padding: "4px 10px",
      fontSize: 11,
      fontWeight: 500,
      fontFamily: B.font,
      color: B.ink,
      whiteSpace: "nowrap"
    }}>
      {Icon && <Icon size={11} strokeWidth={2} />}
      {children}
    </span>
  );
}

// ============================================================
// PILL DE ESTADO
// ============================================================
function EstadoPill({ estado }) {
  const map = {
    "Sin empezar": { bg: "transparent", icon: CircleDashed, border: B.ink, op: 1 },
    "En proceso": { bg: B.yellow, icon: Play, border: "transparent", op: 1 },
    "Entregado": { bg: B.lavender, icon: PackageCheck, border: "transparent", op: 1 },
    "Facturado": { bg: "transparent", icon: Receipt, border: B.border, op: 0.45 }
  };
  const x = map[estado] || map["Sin empezar"];
  const Icon = x.icon;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      background: x.bg,
      color: B.ink,
      border: `1px solid ${x.border}`,
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 600,
      fontFamily: B.font,
      whiteSpace: "nowrap",
      opacity: x.op
    }}>
      <Icon size={11} strokeWidth={2.5} />
      {estado}
    </span>
  );
}

// ============================================================
// PILL DE ENTREGA
// ============================================================
function EntregaPill({ fecha }) {
  if (!fecha) {
    return (
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        border: `1px dashed ${B.border}`,
        color: B.ink,
        opacity: 0.4,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: B.font,
        whiteSpace: "nowrap"
      }}>
        <CalendarClock size={11} strokeWidth={2.5} />
        Sin fecha
      </span>
    );
  }
  const dias = diasEntre(hoy(), fecha);
  const tarde = dias < 0;
  const hoyMismo = dias === 0;
  const urgente = dias > 0 && dias <= 3;

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      background: (tarde || hoyMismo) ? B.ink : (urgente ? B.yellow : "transparent"),
      border: `1px solid ${(tarde || hoyMismo) ? B.ink : (urgente ? "transparent" : B.border)}`,
      color: (tarde || hoyMismo) ? "#fff" : B.ink,
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 600,
      fontFamily: B.font,
      whiteSpace: "nowrap",
      ...B.num
    }}>
      {(tarde || hoyMismo) ? <AlertCircle size={11} strokeWidth={2.5} /> : <CalendarClock size={11} strokeWidth={2.5} />}
      {tarde
        ? `${Math.abs(dias)} d de retraso`
        : hoyMismo
          ? "Entrega hoy"
          : `Faltan ${dias} d`}
    </span>
  );
}

// ============================================================
// PILL DE FILTRO
// ============================================================
function FiltroPill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 16px",
        borderRadius: 999,
        border: `1px solid ${active ? B.ink : B.border}`,
        background: active ? B.ink : "transparent",
        color: active ? "#fff" : B.ink,
        fontFamily: B.font,
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.15s ease",
        whiteSpace: "nowrap"
      }}
    >
      {children}
    </button>
  );
}

// ============================================================
// KPI CARD
// ============================================================
function KPICard({ icon: Icon, label, value, hint, accent = null }) {
  return (
    <Card accent={accent}>
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
        color: B.ink,
        opacity: 0.55,
        marginTop: 4,
        fontFamily: B.font,
        lineHeight: 1.4
      }}>
        {hint}
      </div>
    </Card>
  );
}

// ============================================================
// FICHA DE PROYECTO
// ============================================================
function Ficha({ p, isMobile, busy, onEstado, onEditar, onBorrar }) {
  const enMarcha = EN_MARCHA.includes(p.estado);
  const retrasado = enMarcha && p.fechaEntrega && diasEntre(hoy(), p.fechaEntrega) < 0;

  return (
    <div style={{
      background: B.surface,
      border: `1px solid ${B.border}`,
      borderLeft: `3px solid ${retrasado ? B.ink : B.border}`,
      borderRadius: 16,
      padding: isMobile ? "16px 16px" : "18px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 12,
      opacity: busy ? 0.5 : 1,
      transition: "opacity 0.15s ease"
    }}>
      {/* CABECERA */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12,
        flexWrap: "wrap"
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 15,
            fontWeight: 700,
            fontFamily: B.font,
            color: B.ink,
            letterSpacing: "-0.01em"
          }}>
            {p.proyecto}
          </div>
          <div style={{
            fontSize: 13,
            fontFamily: B.font,
            color: B.ink,
            opacity: p.clienteNombre ? 0.6 : 0.3,
            marginTop: 2
          }}>
            {p.clienteNombre || "Sin cliente asignado"}
          </div>
        </div>
        <div style={{
          fontSize: B.ty.numM,
          fontWeight: 700,
          fontFamily: B.font,
          color: B.ink,
          letterSpacing: "-0.015em",
          opacity: p.importe > 0 ? 1 : 0.3,
          ...B.num
        }}>
          {p.importe > 0 ? fmt(p.importe) : "sin precio"}
        </div>
      </div>

      {/* CHIPS */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <EstadoPill estado={p.estado} />
        {enMarcha && <EntregaPill fecha={p.fechaEntrega} />}
        {!enMarcha && p.fechaEntrega && (
          <Chip icon={PackageCheck}>Entregado {fechaCorta(p.fechaEntrega)}</Chip>
        )}
        {p.fechaInicio && <Chip icon={Play}>Inicio {fechaCorta(p.fechaInicio)}</Chip>}
      </div>

      {/* CARPETA */}
      {p.carpeta && (
        <div>
          <a
            href={p.carpeta}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: B.font,
              color: B.ink,
              textDecoration: "underline",
              textUnderlineOffset: 3
            }}
          >
            <ExternalLink size={12} strokeWidth={2} />
            Abrir carpeta
          </a>
        </div>
      )}

      {/* NOTAS */}
      {p.notas && (
        <div style={{
          fontSize: 13,
          fontFamily: B.font,
          color: B.ink,
          opacity: 0.65,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          borderTop: `1px solid ${B.border}`,
          paddingTop: 10
        }}>
          {p.notas}
        </div>
      )}

      {/* ACCIONES */}
      <div style={{
        display: "flex",
        gap: 6,
        flexWrap: "wrap",
        alignItems: "center",
        borderTop: `1px solid ${B.border}`,
        paddingTop: 12
      }}>
        {p.estado === "Sin empezar" && (
          <Btn size="sm" variant="outline" icon={Play} iconBefore disabled={busy}
            onClick={() => onEstado(p.id, "En proceso")}>
            Empezar
          </Btn>
        )}
        {p.estado === "En proceso" && (
          <Btn size="sm" variant="outline" icon={PackageCheck} iconBefore disabled={busy}
            onClick={() => onEstado(p.id, "Entregado")}>
            Marcar entregado
          </Btn>
        )}
        {p.estado === "Entregado" && (
          <Btn size="sm" variant="outline" icon={Receipt} iconBefore disabled={busy}
            onClick={() => onEstado(p.id, "Facturado")}>
            Marcar facturado
          </Btn>
        )}
        {p.estado === "Facturado" && (
          <Btn size="sm" variant="outline" icon={RotateCcw} iconBefore disabled={busy}
            onClick={() => onEstado(p.id, "Entregado")}>
            Reabrir
          </Btn>
        )}

        <Btn size="sm" variant="ghost" icon={Edit3} iconBefore disabled={busy}
          onClick={() => onEditar(p)}>
          Editar
        </Btn>
        <Btn size="sm" variant="ghost" icon={Trash2} iconBefore disabled={busy}
          onClick={() => onBorrar(p.id, p.proyecto)}
          style={{ color: B.danger, marginLeft: "auto" }}>
          {isMobile ? "" : "Borrar"}
        </Btn>
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function Proyectos({ proyectos, clientes, onRefresh }) {
  const { isMobile, formColumns } = useResponsive();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");
  const [filtro, setFiltro] = useState("marcha");

  const setF = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  // Mapa id -> nombre de cliente, para traducir el campo Link
  const nombrePorId = useMemo(() => {
    const m = {};
    (clientes || []).forEach(c => { m[c.id] = c.fields["Nombre"] || "Sin nombre"; });
    return m;
  }, [clientes]);

  const nombresClientes = useMemo(() =>
    (clientes || [])
      .map(c => c.fields["Nombre"])
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "es"))
  , [clientes]);

  // ============================================================
  // NORMALIZAR
  // ============================================================
  const datos = useMemo(() => (proyectos || []).map(r => {
    const link = r.fields["Cliente"];
    const clienteId = Array.isArray(link) ? link[0] : null;
    return {
      id: r.id,
      proyecto: r.fields["Proyecto"] || "Sin título",
      clienteId,
      clienteNombre: clienteId ? (nombrePorId[clienteId] || "") : "",
      estado: r.fields["Estado"] || "Sin empezar",
      fechaInicio: r.fields["Fecha inicio"] || "",
      fechaEntrega: r.fields["Fecha entrega"] || "",
      importe: r.fields["Importe"] || 0,
      carpeta: r.fields["Carpeta"] || "",
      notas: r.fields["Notas"] || ""
    };
  }), [proyectos, nombrePorId]);

  // ============================================================
  // KPIs
  // ============================================================
  const kpis = useMemo(() => {
    const marcha = datos.filter(p => EN_MARCHA.includes(p.estado));
    const entregados = datos.filter(p => p.estado === "Entregado");
    const retrasados = marcha.filter(p =>
      p.fechaEntrega && diasEntre(hoy(), p.fechaEntrega) < 0
    );
    const estaSemana = marcha.filter(p => {
      if (!p.fechaEntrega) return false;
      const d = diasEntre(hoy(), p.fechaEntrega);
      return d >= 0 && d <= 7;
    });

    return {
      marcha: marcha.length,
      comprometido: marcha.reduce((s, p) => s + p.importe, 0),
      entregados: entregados.length,
      sinFacturar: entregados.reduce((s, p) => s + p.importe, 0),
      retrasados: retrasados.length,
      estaSemana: estaSemana.length
    };
  }, [datos]);

  // ============================================================
  // LISTA FILTRADA
  // ============================================================
  const lista = useMemo(() => {
    let l = datos;
    if (filtro === "marcha") l = datos.filter(p => EN_MARCHA.includes(p.estado));
    else if (filtro === "entregados") l = datos.filter(p => p.estado === "Entregado");
    else if (filtro === "facturados") l = datos.filter(p => p.estado === "Facturado");

    return [...l].sort((a, b) => {
      const aM = EN_MARCHA.includes(a.estado);
      const bM = EN_MARCHA.includes(b.estado);
      if (aM && bM) {
        if (!a.fechaEntrega) return 1;
        if (!b.fechaEntrega) return -1;
        return a.fechaEntrega.localeCompare(b.fechaEntrega);
      }
      if (aM) return -1;
      if (bM) return 1;
      return (b.fechaEntrega || b.fechaInicio || "").localeCompare(a.fechaEntrega || a.fechaInicio || "");
    });
  }, [datos, filtro]);

  // ============================================================
  // ACCIONES
  // ============================================================
  const abrirNuevo = () => {
    setForm({ ...FORM_VACIO });
    setEditId(null);
    setShowForm(true);
    setErr("");
  };

  const abrirEditar = (p) => {
    setForm({
      proyecto: p.proyecto,
      clienteNombre: p.clienteNombre,
      estado: p.estado,
      fechaInicio: p.fechaInicio,
      fechaEntrega: p.fechaEntrega,
      importe: p.importe ? String(p.importe) : "",
      carpeta: p.carpeta,
      notas: p.notas
    });
    setEditId(p.id);
    setShowForm(true);
    setErr("");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cerrarForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm(FORM_VACIO);
    setErr("");
  };

  const guardar = async () => {
    if (!form.proyecto.trim()) {
      setErr("El nombre del proyecto es obligatorio.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const fields = {
        "Proyecto": form.proyecto.trim(),
        "Estado": form.estado || "Sin empezar",
        "Importe": Number(form.importe) || 0,
        "Carpeta": form.carpeta.trim(),
        "Notas": form.notas
      };
      if (form.fechaInicio) fields["Fecha inicio"] = form.fechaInicio;
      if (form.fechaEntrega) fields["Fecha entrega"] = form.fechaEntrega;

      // Cliente: busca o crea, y enlaza por ID
      if (form.clienteNombre && form.clienteNombre.trim()) {
        const clienteId = await findOrCreateClient(form.clienteNombre.trim());
        if (clienteId) fields["Cliente"] = [clienteId];
      } else {
        fields["Cliente"] = [];
      }

      if (editId) {
        await updateRecord("Proyectos", editId, fields);
      } else {
        await createRecord("Proyectos", fields);
      }
      cerrarForm();
      await onRefresh();
    } catch (e) {
      setErr("Error al guardar: " + (e.message || e));
    }
    setSaving(false);
  };

  const cambiarEstado = async (id, nuevo) => {
    setBusyId(id);
    setErr("");
    try {
      await updateRecord("Proyectos", id, { "Estado": nuevo });
      await onRefresh();
    } catch (e) {
      setErr("Error al actualizar: " + (e.message || e));
    }
    setBusyId(null);
  };

  const borrar = async (id, nombre) => {
    if (!confirm(`¿Borrar el proyecto "${nombre}"? No se puede deshacer.`)) return;
    setBusyId(id);
    setErr("");
    try {
      await deleteRecord("Proyectos", id);
      await onRefresh();
    } catch (e) {
      setErr("Error al borrar: " + (e.message || e));
    }
    setBusyId(null);
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <PageHeader
        title="Proyectos."
        subtitle="Qué tienes comprometido, qué toca entregar y qué has entregado sin facturar."
        action={
          <Btn
            onClick={() => (showForm ? cerrarForm() : abrirNuevo())}
            icon={showForm ? X : Plus}
            iconBefore
            variant={showForm ? "outline" : "primary"}
          >
            {showForm ? "Cancelar" : "Nuevo proyecto"}
          </Btn>
        }
      />

      {err && <ErrorBox>{err}</ErrorBox>}

      {/* KPIs */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 14
      }}>
        <KPICard
          icon={AlertCircle}
          label="Con retraso"
          value={kpis.retrasados}
          hint={kpis.retrasados === 0 ? "Todo en plazo" : "Fecha de entrega pasada"}
          accent={kpis.retrasados > 0 ? "yellow" : null}
        />
        <KPICard
          icon={Briefcase}
          label="En marcha"
          value={kpis.marcha}
          hint={`${fmt(kpis.comprometido)} comprometido`}
        />
        <KPICard
          icon={Clock}
          label="Entregas 7 días"
          value={kpis.estaSemana}
          hint={kpis.estaSemana === 0 ? "Semana despejada" : "Entregas próximas"}
        />
        <KPICard
          icon={Euro}
          label="Sin facturar"
          value={fmt(kpis.sinFacturar)}
          hint={`${kpis.entregados} entregado${kpis.entregados === 1 ? "" : "s"} pendiente${kpis.entregados === 1 ? "" : "s"} de factura`}
        />
      </div>

      {/* FORMULARIO */}
      {showForm && (
        <Card>
          <div style={{ marginBottom: 18 }}>
            <Lbl>{editId ? "Editar proyecto" : "Nuevo proyecto"}</Lbl>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: formColumns === 1 ? "1fr" : "1fr 1fr",
            gap: 14
          }}>
            <Inp label="Proyecto *" value={form.proyecto}
              onChange={v => setF("proyecto", v)} ph="Rediseño web" />

            {/* Cliente: escribe libre + datalist con los existentes */}
            <div>
              <Lbl>Cliente</Lbl>
              <input
                list="lista-clientes-proyectos"
                value={form.clienteNombre}
                onChange={e => setF("clienteNombre", e.target.value)}
                placeholder="Escribe o elige uno existente"
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: "11px 14px",
                  borderRadius: 12,
                  border: `1px solid ${B.border}`,
                  background: "#fff",
                  fontFamily: B.font,
                  fontSize: 14,
                  color: B.ink,
                  outline: "none",
                  boxSizing: "border-box"
                }}
              />
              <datalist id="lista-clientes-proyectos">
                {nombresClientes.map(n => <option key={n} value={n} />)}
              </datalist>
              <div style={{
                fontSize: 11,
                fontFamily: B.font,
                color: B.ink,
                opacity: 0.5,
                marginTop: 5,
                lineHeight: 1.4
              }}>
                Si no existe, se da de alta solo. Escríbelo igual que lo pondrás en la factura.
              </div>
            </div>

            <Sel label="Estado" value={form.estado}
              onChange={v => setF("estado", v)} options={ESTADOS} placeholder="Sin empezar" />
            <Inp label="Importe (base, sin IVA)" type="number" value={form.importe}
              onChange={v => setF("importe", v)} ph="1200" />
            <Inp label="Fecha de inicio" type="date" value={form.fechaInicio}
              onChange={v => setF("fechaInicio", v)} />
            <Inp label="Fecha de entrega" type="date" value={form.fechaEntrega}
              onChange={v => setF("fechaEntrega", v)} />
            <Inp label="Carpeta del proyecto" value={form.carpeta}
              onChange={v => setF("carpeta", v)} ph="https://drive.google.com/…" />
          </div>

          <div style={{ marginTop: 14 }}>
            <TxtArea label="Notas" value={form.notas}
              onChange={v => setF("notas", v)} rows={3}
              ph="Alcance, entregables, condiciones acordadas…" />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
            <Btn onClick={guardar} disabled={saving} icon={Check} iconBefore>
              {saving ? "Guardando…" : editId ? "Guardar cambios" : "Crear proyecto"}
            </Btn>
            <Btn variant="outline" onClick={cerrarForm} disabled={saving}>
              Cancelar
            </Btn>
          </div>
        </Card>
      )}

      {/* FILTROS */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {[
          ["marcha", "En marcha"],
          ["entregados", "Entregados"],
          ["facturados", "Facturados"],
          ["todos", "Todos"]
        ].map(([id, label]) => (
          <FiltroPill
            key={id}
            active={filtro === id}
            onClick={() => setFiltro(id)}
          >
            {label}
          </FiltroPill>
        ))}
        <span style={{
          fontSize: 12,
          fontFamily: B.font,
          color: B.ink,
          opacity: 0.5,
          marginLeft: 4,
          ...B.num
        }}>
          {lista.length} proyecto{lista.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* LISTA */}
      {lista.length === 0 ? (
        <Card>
          <div style={{ textAlign: "center", padding: "28px 12px", fontFamily: B.font }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
              <IconPill icon={Briefcase} size={40} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: B.ink }}>
              Nada por aquí todavía
            </div>
            <div style={{
              fontSize: 13,
              color: B.ink,
              opacity: 0.55,
              marginTop: 6,
              maxWidth: 400,
              margin: "6px auto 0",
              lineHeight: 1.5
            }}>
              Apunta aquí los proyectos que tienes cerrados, con su fecha de entrega.
              Es lo que te dice qué viene y cuánto vas a facturar.
            </div>
          </div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {lista.map(p => (
            <Ficha
              key={p.id}
              p={p}
              isMobile={isMobile}
              busy={busyId === p.id}
              onEstado={cambiarEstado}
              onEditar={abrirEditar}
              onBorrar={borrar}
            />
          ))}
        </div>
      )}
    </div>
  );
}
