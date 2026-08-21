// src/components/Presupuestos.jsx
// CRM ligero de presupuestos: seguimiento de clientes potenciales.
// Tabla Airtable: "Presupuestos"
// Campos: Nombre, Proyecto, Email, Fecha contacto, Canal, Referido por,
//         Presupuesto (URL), Importe, Estado, Próximo seguimiento, Notas

import { useState, useMemo } from "react";
import {
  Plus, X, Send, Trophy, XCircle, Clock, AlertCircle,
  ExternalLink, Trash2, CalendarClock, TrendingUp, Target,
  Mail, Edit3, Check, Radio
} from "lucide-react";

import { B, fmt, hoy, diasEntre } from "../utils.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { createRecord, updateRecord, deleteRecord } from "../api.js";
import {
  Card, Lbl, Inp, Sel, TxtArea, PageHeader, Btn, IconPill, ErrorBox
} from "./UI.jsx";

// ============================================================
// CONSTANTES
// ============================================================
const CANALES = ["Instagram", "Pinterest", "Malt", "Web", "Referido", "Otro"];
const ESTADOS = ["Pendiente", "Ganado", "Perdido"];

const FORM_VACIO = {
  nombre: "",
  proyecto: "",
  email: "",
  fechaContacto: hoy(),
  canal: "",
  referidoPor: "",
  url: "",
  importe: "",
  estado: "Pendiente",
  seguimiento: "",
  notas: ""
};

// Suma días a una fecha ISO y devuelve ISO
function sumarDias(fechaISO, dias) {
  const d = fechaISO ? new Date(fechaISO) : new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().split("T")[0];
}

// Fecha legible corta: 3 ago
function fechaCorta(f) {
  if (!f) return "—";
  try {
    return new Date(f).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  } catch {
    return f;
  }
}

// ============================================================
// PILL DE ESTADO — paleta marca (amarillo / lavanda / apagado)
// ============================================================
function EstadoPill({ estado }) {
  const map = {
    Pendiente: { bg: B.yellow, fg: B.ink, icon: Clock, border: "transparent", op: 1 },
    Ganado: { bg: B.lavender, fg: B.ink, icon: Trophy, border: "transparent", op: 1 },
    Perdido: { bg: "transparent", fg: B.ink, icon: XCircle, border: B.border, op: 0.45 }
  };
  const x = map[estado] || map.Pendiente;
  const Icon = x.icon;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      background: x.bg,
      color: x.fg,
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
// PILL DE SEGUIMIENTO — negro si vencido, gris si futuro
// ============================================================
function SeguimientoPill({ fecha }) {
  if (!fecha) {
    return (
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: "transparent",
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
  const vencido = dias <= 0;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      background: vencido ? B.ink : "transparent",
      border: `1px solid ${vencido ? B.ink : B.border}`,
      color: vencido ? "#fff" : B.ink,
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 600,
      fontFamily: B.font,
      whiteSpace: "nowrap",
      ...B.num
    }}>
      {vencido ? <AlertCircle size={11} strokeWidth={2.5} /> : <CalendarClock size={11} strokeWidth={2.5} />}
      {vencido
        ? (dias === 0 ? "Toca hoy" : `Toca hace ${Math.abs(dias)} d`)
        : `En ${dias} d`}
    </span>
  );
}

// ============================================================
// PILL DE FILTRO — negro cuando está activo
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
        fontFamily: B.font
      }}>
        {hint}
      </div>
    </Card>
  );
}

// ============================================================
// BARRA HORIZONTAL POR CANAL (sin librerías)
// ============================================================
function BarraCanal({ canal, ganados, total, euros, maxEuros }) {
  const pct = maxEuros > 0 ? (euros / maxEuros) * 100 : 0;
  const conv = total > 0 ? Math.round((ganados / total) * 100) : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 10,
        fontSize: 13,
        fontFamily: B.font
      }}>
        <span style={{ fontWeight: 600, color: B.ink }}>{canal}</span>
        <span style={{ color: B.ink, opacity: 0.6, fontSize: 12, ...B.num }}>
          {fmt(euros)} · {ganados}/{total} · {conv}%
        </span>
      </div>
      <div style={{
        background: "#f4f4f4",
        borderRadius: 999,
        height: 12,
        overflow: "hidden"
      }}>
        <div style={{
          width: `${Math.max(pct, euros > 0 ? 3 : 0)}%`,
          height: "100%",
          borderRadius: 999,
          background: B.ink,
          transition: "width 1s ease"
        }} />
      </div>
    </div>
  );
}

// ============================================================
// FILA DE PRESUPUESTO
// ============================================================
function FilaPresupuesto({
  p, isMobile, busy,
  onEstado, onPosponer, onEditar, onBorrar
}) {
  const vencido = p.estado === "Pendiente" && p.seguimiento && diasEntre(hoy(), p.seguimiento) <= 0;

  return (
    <div style={{
      background: B.surface,
      border: `1px solid ${B.border}`,
      borderLeft: `3px solid ${vencido ? B.ink : B.border}`,
      borderRadius: 16,
      padding: isMobile ? "16px 16px" : "18px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 12,
      opacity: busy ? 0.5 : 1,
      transition: "opacity 0.15s ease"
    }}>
      {/* LÍNEA 1: nombre + proyecto + importe */}
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
            {p.nombre}
          </div>
          {p.proyecto && (
            <div style={{
              fontSize: 13,
              fontFamily: B.font,
              color: B.ink,
              opacity: 0.6,
              marginTop: 2
            }}>
              {p.proyecto}
            </div>
          )}
        </div>
        <div style={{
          fontSize: B.ty.numM,
          fontWeight: 700,
          fontFamily: B.font,
          color: B.ink,
          letterSpacing: "-0.015em",
          ...B.num
        }}>
          {p.importe > 0 ? fmt(p.importe) : "—"}
        </div>
      </div>

      {/* LÍNEA 2: chips */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <EstadoPill estado={p.estado} />
        {p.estado === "Pendiente" && <SeguimientoPill fecha={p.seguimiento} />}
        {p.canal && (
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
            color: B.ink
          }}>
            <Radio size={11} strokeWidth={2} />
            {p.canal}{p.referidoPor ? ` · ${p.referidoPor}` : ""}
          </span>
        )}
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
          ...B.num
        }}>
          <Send size={11} strokeWidth={2} />
          {fechaCorta(p.fechaContacto)}
        </span>
      </div>

      {/* LÍNEA 3: enlaces */}
      {(p.url || p.email) && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {p.url && (
            <a
              href={p.url}
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
              Ver presupuesto
            </a>
          )}
          {p.email && (
            <a
              href={`mailto:${p.email}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 500,
                fontFamily: B.font,
                color: B.ink,
                opacity: 0.65,
                textDecoration: "none"
              }}
            >
              <Mail size={12} strokeWidth={2} />
              {p.email}
            </a>
          )}
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
        borderTop: `1px solid ${B.border}`,
        paddingTop: 12
      }}>
        {p.estado === "Pendiente" && (
          <>
            <Btn size="sm" icon={Trophy} iconBefore disabled={busy}
              onClick={() => onEstado(p.id, "Ganado")}>
              Ganado
            </Btn>
            <Btn size="sm" variant="outline" icon={XCircle} iconBefore disabled={busy}
              onClick={() => onEstado(p.id, "Perdido")}>
              Perdido
            </Btn>
            <Btn size="sm" variant="outline" icon={CalendarClock} iconBefore disabled={busy}
              onClick={() => onPosponer(p.id, 7)}>
              +7 días
            </Btn>
          </>
        )}
        {p.estado !== "Pendiente" && (
          <Btn size="sm" variant="outline" icon={Clock} iconBefore disabled={busy}
            onClick={() => onEstado(p.id, "Pendiente")}>
            Reabrir
          </Btn>
        )}
        <Btn size="sm" variant="ghost" icon={Edit3} iconBefore disabled={busy}
          onClick={() => onEditar(p)}>
          Editar
        </Btn>
        <Btn size="sm" variant="ghost" icon={Trash2} iconBefore disabled={busy}
          onClick={() => onBorrar(p.id, p.nombre)}
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
export default function Presupuestos({ presupuestos, onRefresh }) {
  const { isMobile, formColumns } = useResponsive();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("Pendiente");

  const setF = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  // ============================================================
  // NORMALIZAR REGISTROS
  // ============================================================
  const datos = useMemo(() => (presupuestos || []).map(r => ({
    id: r.id,
    nombre: r.fields["Nombre"] || "Sin nombre",
    proyecto: r.fields["Proyecto"] || "",
    email: r.fields["Email"] || "",
    fechaContacto: r.fields["Fecha contacto"] || "",
    canal: r.fields["Canal"] || "",
    referidoPor: r.fields["Referido por"] || "",
    url: r.fields["Presupuesto"] || "",
    importe: r.fields["Importe"] || 0,
    estado: r.fields["Estado"] || "Pendiente",
    seguimiento: r.fields["Próximo seguimiento"] || "",
    notas: r.fields["Notas"] || ""
  })), [presupuestos]);

  // ============================================================
  // KPIs (sobre TODO, no sobre el filtro)
  // ============================================================
  const kpis = useMemo(() => {
    const pendientes = datos.filter(p => p.estado === "Pendiente");
    const ganados = datos.filter(p => p.estado === "Ganado");
    const perdidos = datos.filter(p => p.estado === "Perdido");
    const cerrados = ganados.length + perdidos.length;

    const enJuego = pendientes.reduce((s, p) => s + p.importe, 0);
    const eurosGanados = ganados.reduce((s, p) => s + p.importe, 0);
    const conversion = cerrados > 0 ? Math.round((ganados.length / cerrados) * 100) : 0;

    const aSeguir = pendientes.filter(p =>
      p.seguimiento && diasEntre(hoy(), p.seguimiento) <= 0
    ).length;

    return {
      pendientes: pendientes.length,
      enJuego,
      eurosGanados,
      ganados: ganados.length,
      cerrados,
      conversion,
      aSeguir
    };
  }, [datos]);

  // ============================================================
  // DATOS POR CANAL
  // ============================================================
  const porCanal = useMemo(() => {
    const filas = CANALES.map(c => {
      const delCanal = datos.filter(p => p.canal === c);
      const gan = delCanal.filter(p => p.estado === "Ganado");
      const cerrados = delCanal.filter(p => p.estado !== "Pendiente").length;
      return {
        canal: c,
        total: cerrados,
        ganados: gan.length,
        euros: gan.reduce((s, p) => s + p.importe, 0)
      };
    }).filter(f => f.total > 0 || f.euros > 0);
    const maxEuros = Math.max(1, ...filas.map(f => f.euros));
    return { filas, maxEuros };
  }, [datos]);

  // ============================================================
  // LISTA FILTRADA Y ORDENADA
  // ============================================================
  const lista = useMemo(() => {
    let l = filtroEstado === "Todos"
      ? datos
      : datos.filter(p => p.estado === filtroEstado);

    return [...l].sort((a, b) => {
      // Pendientes: por fecha de seguimiento (los que tocan antes, arriba)
      if (a.estado === "Pendiente" && b.estado === "Pendiente") {
        if (!a.seguimiento) return 1;
        if (!b.seguimiento) return -1;
        return a.seguimiento.localeCompare(b.seguimiento);
      }
      // Resto: por fecha de contacto descendente
      return (b.fechaContacto || "").localeCompare(a.fechaContacto || "");
    });
  }, [datos, filtroEstado]);

  // ============================================================
  // ACCIONES
  // ============================================================
  const abrirNuevo = () => {
    setForm({ ...FORM_VACIO, seguimiento: sumarDias(hoy(), 7) });
    setEditId(null);
    setShowForm(true);
    setErr("");
  };

  const abrirEditar = (p) => {
    setForm({
      nombre: p.nombre,
      proyecto: p.proyecto,
      email: p.email,
      fechaContacto: p.fechaContacto,
      canal: p.canal,
      referidoPor: p.referidoPor,
      url: p.url,
      importe: p.importe ? String(p.importe) : "",
      estado: p.estado,
      seguimiento: p.seguimiento,
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
    if (!form.nombre.trim()) {
      setErr("El nombre del cliente es obligatorio.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const fields = {
        "Nombre": form.nombre.trim(),
        "Proyecto": form.proyecto.trim(),
        "Email": form.email.trim(),
        "Canal": form.canal || undefined,
        "Referido por": form.referidoPor.trim(),
        "Presupuesto": form.url.trim(),
        "Importe": Number(form.importe) || 0,
        "Estado": form.estado || "Pendiente",
        "Notas": form.notas
      };
      if (form.fechaContacto) fields["Fecha contacto"] = form.fechaContacto;
      if (form.seguimiento) fields["Próximo seguimiento"] = form.seguimiento;

      // Airtable rechaza undefined en single select: lo quitamos
      Object.keys(fields).forEach(k => {
        if (fields[k] === undefined) delete fields[k];
      });

      if (editId) {
        await updateRecord("Presupuestos", editId, fields);
      } else {
        await createRecord("Presupuestos", fields);
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
      const fields = { "Estado": nuevo };
      // Al cerrar, el seguimiento deja de tener sentido
      if (nuevo !== "Pendiente") fields["Próximo seguimiento"] = null;
      else fields["Próximo seguimiento"] = sumarDias(hoy(), 7);
      await updateRecord("Presupuestos", id, fields);
      await onRefresh();
    } catch (e) {
      setErr("Error al actualizar: " + (e.message || e));
    }
    setBusyId(null);
  };

  const posponer = async (id, dias) => {
    setBusyId(id);
    setErr("");
    try {
      await updateRecord("Presupuestos", id, {
        "Próximo seguimiento": sumarDias(hoy(), dias)
      });
      await onRefresh();
    } catch (e) {
      setErr("Error al posponer: " + (e.message || e));
    }
    setBusyId(null);
  };

  const borrar = async (id, nombre) => {
    if (!confirm(`¿Borrar el presupuesto de "${nombre}"? No se puede deshacer.`)) return;
    setBusyId(id);
    setErr("");
    try {
      await deleteRecord("Presupuestos", id);
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
        title="Presupuestos."
        subtitle="A quién le has pasado precio, a quién toca perseguir y qué canal te trae trabajo."
        action={
          <Btn
            onClick={() => (showForm ? cerrarForm() : abrirNuevo())}
            icon={showForm ? X : Plus}
            iconBefore
            variant={showForm ? "outline" : "primary"}
          >
            {showForm ? "Cancelar" : "Nuevo presupuesto"}
          </Btn>
        }
      />

      {err && <ErrorBox>{err}</ErrorBox>}

      {/* ======================= KPIs ======================= */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 14
      }}>
        <KPICard
          icon={AlertCircle}
          label="Toca seguir"
          value={kpis.aSeguir}
          hint={kpis.aSeguir === 0 ? "Todo al día" : "Escríbeles hoy"}
          accent={kpis.aSeguir > 0 ? "yellow" : null}
        />
        <KPICard
          icon={Clock}
          label="Abiertos"
          value={kpis.pendientes}
          hint={`${fmt(kpis.enJuego)} en juego`}
        />
        <KPICard
          icon={Trophy}
          label="Ganado"
          value={fmt(kpis.eurosGanados)}
          hint={`${kpis.ganados} presupuesto${kpis.ganados === 1 ? "" : "s"}`}
        />
        <KPICard
          icon={Target}
          label="Conversión"
          value={`${kpis.conversion}%`}
          hint={kpis.cerrados < 6
            ? `Solo ${kpis.cerrados} cerrado${kpis.cerrados === 1 ? "" : "s"}: aún no es fiable`
            : `${kpis.ganados} de ${kpis.cerrados} cerrados`}
        />
      </div>

      {/* ======================= FORMULARIO ======================= */}
      {showForm && (
        <Card>
          <div style={{ marginBottom: 18 }}>
            <Lbl>{editId ? "Editar presupuesto" : "Nuevo presupuesto"}</Lbl>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: formColumns === 1 ? "1fr" : "1fr 1fr",
            gap: 14
          }}>
            <Inp label="Nombre *" value={form.nombre}
              onChange={v => setF("nombre", v)} ph="Pepita Pérez" />
            <Inp label="Proyecto" value={form.proyecto}
              onChange={v => setF("proyecto", v)} ph="Estudio de cerámica" />
            <Inp label="Email" type="email" value={form.email}
              onChange={v => setF("email", v)} ph="hola@ejemplo.com" />
            <Inp label="Fecha de contacto" type="date" value={form.fechaContacto}
              onChange={v => setF("fechaContacto", v)} />
            <Sel label="Canal" value={form.canal}
              onChange={v => setF("canal", v)} options={CANALES} />
            {form.canal === "Referido" && (
              <Inp label="Referido por" value={form.referidoPor}
                onChange={v => setF("referidoPor", v)} ph="Quién te lo pasó" />
            )}
            <Inp label="Importe (base, sin IVA)" type="number" value={form.importe}
              onChange={v => setF("importe", v)} ph="1200" />
            <Sel label="Estado" value={form.estado}
              onChange={v => setF("estado", v)} options={ESTADOS} placeholder="Pendiente" />
            <Inp label="Próximo seguimiento" type="date" value={form.seguimiento}
              onChange={v => setF("seguimiento", v)} />
            <Inp label="Enlace al PDF" value={form.url}
              onChange={v => setF("url", v)} ph="https://drive.google.com/…" />
          </div>

          <div style={{ marginTop: 14 }}>
            <TxtArea label="Notas" value={form.notas}
              onChange={v => setF("notas", v)} rows={3}
              ph="Qué te pidió, qué le preocupa, cuándo dijo que decidiría…" />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
            <Btn onClick={guardar} disabled={saving} icon={Check} iconBefore>
              {saving ? "Guardando…" : editId ? "Guardar cambios" : "Crear presupuesto"}
            </Btn>
            <Btn variant="outline" onClick={cerrarForm} disabled={saving}>
              Cancelar
            </Btn>
          </div>
        </Card>
      )}

      {/* ======================= GRÁFICO POR CANAL ======================= */}
      {porCanal.filas.length > 0 && (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <IconPill icon={TrendingUp} size={28} />
            <Lbl>Qué canal te trae dinero</Lbl>
          </div>
          <div style={{
            fontSize: 12,
            fontFamily: B.font,
            color: B.ink,
            opacity: 0.55,
            marginBottom: 18
          }}>
            Euros ganados · ganados/cerrados · tasa de conversión
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {porCanal.filas.map(f => (
              <BarraCanal
                key={f.canal}
                canal={f.canal}
                ganados={f.ganados}
                total={f.total}
                euros={f.euros}
                maxEuros={porCanal.maxEuros}
              />
            ))}
          </div>
          {kpis.cerrados < 6 && (
            <div style={{
              marginTop: 18,
              paddingTop: 14,
              borderTop: `1px solid ${B.border}`,
              fontSize: 12,
              fontFamily: B.font,
              color: B.ink,
              opacity: 0.55,
              lineHeight: 1.5
            }}>
              Con {kpis.cerrados} presupuesto{kpis.cerrados === 1 ? "" : "s"} cerrado{kpis.cerrados === 1 ? "" : "s"} estos
              porcentajes todavía son ruido. Empiezan a significar algo a partir de seis u ocho por canal.
            </div>
          )}
        </Card>
      )}

      {/* ======================= FILTRO ======================= */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {["Pendiente", "Ganado", "Perdido", "Todos"].map(e => (
          <FiltroPill
            key={e}
            active={filtroEstado === e}
            onClick={() => setFiltroEstado(e)}
          >
            {e === "Pendiente" ? "Abiertos"
              : e === "Ganado" ? "Ganados"
              : e === "Perdido" ? "Perdidos"
              : "Todos"}
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
          {lista.length} registro{lista.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* ======================= LISTA ======================= */}
      {lista.length === 0 ? (
        <Card>
          <div style={{
            textAlign: "center",
            padding: "28px 12px",
            fontFamily: B.font
          }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
              <IconPill icon={Send} size={40} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: B.ink }}>
              Nada por aquí todavía
            </div>
            <div style={{
              fontSize: 13,
              color: B.ink,
              opacity: 0.55,
              marginTop: 6,
              maxWidth: 380,
              margin: "6px auto 0"
            }}>
              Cada vez que mandes un presupuesto, apúntalo aquí con fecha de seguimiento.
              Es lo que evita que se te escapen.
            </div>
          </div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {lista.map(p => (
            <FilaPresupuesto
              key={p.id}
              p={p}
              isMobile={isMobile}
              busy={busyId === p.id}
              onEstado={cambiarEstado}
              onPosponer={posponer}
              onEditar={abrirEditar}
              onBorrar={borrar}
            />
          ))}
        </div>
      )}
    </div>
  );
}
