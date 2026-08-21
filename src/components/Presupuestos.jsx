// src/components/Presupuestos.jsx
// CRM ligero: seguimiento de contactos y presupuestos de clientes potenciales.
// Tabla Airtable: "Presupuestos"
// Campos: Nombre, Proyecto, Email, Fecha contacto, Origen, Canal, Referido por,
//         Presupuesto (URL), Importe, Estado, Próximo seguimiento, Notas

import { useState, useMemo } from "react";
import {
  Plus, X, Send, Trophy, XCircle, Clock, AlertCircle,
  ExternalLink, Trash2, CalendarClock, TrendingUp, Target,
  Mail, Edit3, Check, Radio, MessageCircle, MinusCircle,
  Inbox, ArrowUpRight, RotateCcw, Percent
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
const ORIGENES = ["Me contactan", "Contacto yo"];
const ESTADOS = ["Contactado", "Presupuestado", "Ganado", "Perdido", "Sin respuesta"];

// Fases todavía vivas: necesitan seguimiento
const ABIERTOS = ["Contactado", "Presupuestado"];
// Fases que llegaron a ver un precio
const CON_PRECIO = ["Presupuestado", "Ganado", "Perdido"];
// Fases ya resueltas en la primera etapa (base de la tasa de respuesta)
const RESUELTOS_1A = ["Presupuestado", "Ganado", "Perdido", "Sin respuesta"];
// Fases cerradas tras ver precio (base de la tasa de cierre)
const CERRADOS = ["Ganado", "Perdido"];

const FORM_VACIO = {
  nombre: "",
  proyecto: "",
  email: "",
  fechaContacto: hoy(),
  origen: "Me contactan",
  canal: "",
  referidoPor: "",
  url: "",
  importe: "",
  estado: "Contactado",
  seguimiento: "",
  notas: ""
};

function sumarDias(fechaISO, dias) {
  const d = fechaISO ? new Date(fechaISO) : new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().split("T")[0];
}

function fechaCorta(f) {
  if (!f) return "—";
  try {
    return new Date(f).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  } catch {
    return f;
  }
}

// Chip genérico blanco con borde
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
    Contactado: { bg: "transparent", icon: MessageCircle, border: B.ink, op: 1 },
    Presupuestado: { bg: B.yellow, icon: Send, border: "transparent", op: 1 },
    Ganado: { bg: B.lavender, icon: Trophy, border: "transparent", op: 1 },
    Perdido: { bg: "transparent", icon: XCircle, border: B.border, op: 0.45 },
    "Sin respuesta": { bg: "transparent", icon: MinusCircle, border: B.border, op: 0.45 }
  };
  const x = map[estado] || map.Contactado;
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
// PILL DE SEGUIMIENTO
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
// BARRA HORIZONTAL POR CANAL
// ============================================================
function BarraCanal({ canal, ganados, cerrados, euros, maxEuros }) {
  const pct = maxEuros > 0 ? (euros / maxEuros) * 100 : 0;
  const conv = cerrados > 0 ? Math.round((ganados / cerrados) * 100) : 0;
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
          {fmt(euros)} · {ganados}/{cerrados} · {conv}%
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
// FICHA DE CONTACTO
// ============================================================
function Ficha({ p, isMobile, busy, onEstado, onPosponer, onEditar, onBorrar }) {
  const abierto = ABIERTOS.includes(p.estado);
  const vencido = abierto && p.seguimiento && diasEntre(hoy(), p.seguimiento) <= 0;

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
          opacity: p.importe > 0 ? 1 : 0.3,
          ...B.num
        }}>
          {p.importe > 0 ? fmt(p.importe) : "sin precio"}
        </div>
      </div>

      {/* CHIPS */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <EstadoPill estado={p.estado} />
        {abierto && <SeguimientoPill fecha={p.seguimiento} />}
        {p.origen && (
          <Chip icon={p.origen === "Me contactan" ? Inbox : ArrowUpRight}>
            {p.origen}
          </Chip>
        )}
        {p.canal && (
          <Chip icon={Radio}>
            {p.canal}{p.referidoPor ? ` · ${p.referidoPor}` : ""}
          </Chip>
        )}
        <Chip icon={Send}>{fechaCorta(p.fechaContacto)}</Chip>
      </div>

      {/* ENLACES */}
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

      {/* ACCIONES — contextuales según la fase */}
      <div style={{
        display: "flex",
        gap: 6,
        flexWrap: "wrap",
        alignItems: "center",
        borderTop: `1px solid ${B.border}`,
        paddingTop: 12
      }}>
        {p.estado === "Contactado" && (
          <>
            <Btn size="sm" variant="outline" icon={Send} iconBefore disabled={busy}
              onClick={() => onEstado(p.id, "Presupuestado")}>
              Presupuesto enviado
            </Btn>
            <Btn size="sm" variant="outline" icon={MinusCircle} iconBefore disabled={busy}
              onClick={() => onEstado(p.id, "Sin respuesta")}>
              Sin respuesta
            </Btn>
          </>
        )}

        {p.estado === "Presupuestado" && (
          <>
            <Btn size="sm" variant="outline" icon={Trophy} iconBefore disabled={busy}
              onClick={() => onEstado(p.id, "Ganado")}>
              Marcar ganado
            </Btn>
            <Btn size="sm" variant="outline" icon={XCircle} iconBefore disabled={busy}
              onClick={() => onEstado(p.id, "Perdido")}>
              Marcar perdido
            </Btn>
          </>
        )}

        {ABIERTOS.includes(p.estado) && (
          <Btn size="sm" variant="outline" icon={CalendarClock} iconBefore disabled={busy}
            onClick={() => onPosponer(p.id, 7)}>
            +7 días
          </Btn>
        )}

        {!ABIERTOS.includes(p.estado) && (
          <Btn size="sm" variant="outline" icon={RotateCcw} iconBefore disabled={busy}
            onClick={() => onEstado(p.id, p.importe > 0 ? "Presupuestado" : "Contactado")}>
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
  const [filtro, setFiltro] = useState("abiertos");
  const [origenGrafico, setOrigenGrafico] = useState("Todos");

  const setF = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  // ============================================================
  // NORMALIZAR
  // ============================================================
  const datos = useMemo(() => (presupuestos || []).map(r => ({
    id: r.id,
    nombre: r.fields["Nombre"] || "Sin nombre",
    proyecto: r.fields["Proyecto"] || "",
    email: r.fields["Email"] || "",
    fechaContacto: r.fields["Fecha contacto"] || "",
    origen: r.fields["Origen"] || "",
    canal: r.fields["Canal"] || "",
    referidoPor: r.fields["Referido por"] || "",
    url: r.fields["Presupuesto"] || "",
    importe: r.fields["Importe"] || 0,
    estado: r.fields["Estado"] || "Contactado",
    seguimiento: r.fields["Próximo seguimiento"] || "",
    notas: r.fields["Notas"] || ""
  })), [presupuestos]);

  // ============================================================
  // KPIs
  // ============================================================
  const kpis = useMemo(() => {
    const abiertos = datos.filter(p => ABIERTOS.includes(p.estado));
    const ganados = datos.filter(p => p.estado === "Ganado");
    const cerrados = datos.filter(p => CERRADOS.includes(p.estado));

    const enJuego = abiertos.reduce((s, p) => s + p.importe, 0);
    const eurosGanados = ganados.reduce((s, p) => s + p.importe, 0);

    // Tasa de cierre: de los que vieron precio y se resolvieron
    const cierre = cerrados.length > 0
      ? Math.round((ganados.length / cerrados.length) * 100)
      : 0;

    // Tasa de respuesta: SOLO sobre los que contacta ella
    const salientes = datos.filter(p => p.origen === "Contacto yo");
    const salResueltos = salientes.filter(p => RESUELTOS_1A.includes(p.estado));
    const salRespondieron = salientes.filter(p => CON_PRECIO.includes(p.estado));
    const respuesta = salResueltos.length > 0
      ? Math.round((salRespondieron.length / salResueltos.length) * 100)
      : 0;

    const aSeguir = abiertos.filter(p =>
      p.seguimiento && diasEntre(hoy(), p.seguimiento) <= 0
    ).length;

    return {
      abiertos: abiertos.length,
      enJuego,
      eurosGanados,
      ganados: ganados.length,
      cerrados: cerrados.length,
      cierre,
      respuesta,
      salResueltos: salResueltos.length,
      salRespondieron: salRespondieron.length,
      aSeguir
    };
  }, [datos]);

  // ============================================================
  // GRÁFICO POR CANAL (filtrable por origen)
  // ============================================================
  const porCanal = useMemo(() => {
    const base = origenGrafico === "Todos"
      ? datos
      : datos.filter(p => p.origen === origenGrafico);

    const filas = CANALES.map(c => {
      const delCanal = base.filter(p => p.canal === c);
      const gan = delCanal.filter(p => p.estado === "Ganado");
      const cer = delCanal.filter(p => CERRADOS.includes(p.estado));
      return {
        canal: c,
        ganados: gan.length,
        cerrados: cer.length,
        euros: gan.reduce((s, p) => s + p.importe, 0),
        total: delCanal.length
      };
    }).filter(f => f.total > 0);

    const maxEuros = Math.max(1, ...filas.map(f => f.euros));
    return { filas, maxEuros };
  }, [datos, origenGrafico]);

  // ============================================================
  // LISTA FILTRADA
  // ============================================================
  const lista = useMemo(() => {
    let l = datos;
    if (filtro === "abiertos") l = datos.filter(p => ABIERTOS.includes(p.estado));
    else if (filtro === "ganados") l = datos.filter(p => p.estado === "Ganado");
    else if (filtro === "descartados")
      l = datos.filter(p => p.estado === "Perdido" || p.estado === "Sin respuesta");

    return [...l].sort((a, b) => {
      const aAb = ABIERTOS.includes(a.estado);
      const bAb = ABIERTOS.includes(b.estado);
      if (aAb && bAb) {
        if (!a.seguimiento) return 1;
        if (!b.seguimiento) return -1;
        return a.seguimiento.localeCompare(b.seguimiento);
      }
      if (aAb) return -1;
      if (bAb) return 1;
      return (b.fechaContacto || "").localeCompare(a.fechaContacto || "");
    });
  }, [datos, filtro]);

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
      origen: p.origen || "Me contactan",
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
      setErr("El nombre del contacto es obligatorio.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const fields = {
        "Nombre": form.nombre.trim(),
        "Proyecto": form.proyecto.trim(),
        "Email": form.email.trim(),
        "Referido por": form.referidoPor.trim(),
        "Presupuesto": form.url.trim(),
        "Importe": Number(form.importe) || 0,
        "Estado": form.estado || "Contactado",
        "Notas": form.notas
      };
      if (form.canal) fields["Canal"] = form.canal;
      if (form.origen) fields["Origen"] = form.origen;
      if (form.fechaContacto) fields["Fecha contacto"] = form.fechaContacto;
      if (form.seguimiento) fields["Próximo seguimiento"] = form.seguimiento;

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
      if (ABIERTOS.includes(nuevo)) {
        fields["Próximo seguimiento"] = sumarDias(hoy(), 7);
      } else {
        fields["Próximo seguimiento"] = null;
      }
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
    if (!confirm(`¿Borrar el registro de "${nombre}"? No se puede deshacer.`)) return;
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

  const pocoDato = kpis.cerrados < 6;

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <PageHeader
        title="Presupuestos."
        subtitle="A quién has contactado, a quién le has pasado precio y a quién toca perseguir."
        action={
          <Btn
            onClick={() => (showForm ? cerrarForm() : abrirNuevo())}
            icon={showForm ? X : Plus}
            iconBefore
            variant={showForm ? "outline" : "primary"}
          >
            {showForm ? "Cancelar" : "Nuevo contacto"}
          </Btn>
        }
      />

      {err && <ErrorBox>{err}</ErrorBox>}

      {/* KPIs */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(190px, 1fr))",
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
          label="Vivos"
          value={kpis.abiertos}
          hint={`${fmt(kpis.enJuego)} en juego`}
        />
        <KPICard
          icon={Trophy}
          label="Ganado"
          value={fmt(kpis.eurosGanados)}
          hint={`${kpis.ganados} proyecto${kpis.ganados === 1 ? "" : "s"}`}
        />
        <KPICard
          icon={Percent}
          label="Respuesta"
          value={kpis.salResueltos === 0 ? "—" : `${kpis.respuesta}%`}
          hint={kpis.salResueltos === 0
            ? "Cuando prospectes tú"
            : `${kpis.salRespondieron} de ${kpis.salResueltos} que contactaste`}
        />
        <KPICard
          icon={Target}
          label="Cierre"
          value={kpis.cerrados === 0 ? "—" : `${kpis.cierre}%`}
          hint={kpis.cerrados === 0
            ? "Sin presupuestos cerrados"
            : `${kpis.ganados} de ${kpis.cerrados} con precio`}
        />
      </div>

      {/* FORMULARIO */}
      {showForm && (
        <Card>
          <div style={{ marginBottom: 18 }}>
            <Lbl>{editId ? "Editar contacto" : "Nuevo contacto"}</Lbl>
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
            <Sel label="Origen" value={form.origen}
              onChange={v => setF("origen", v)} options={ORIGENES} />
            <Sel label="Canal" value={form.canal}
              onChange={v => setF("canal", v)} options={CANALES} />
            {form.canal === "Referido" && (
              <Inp label="Referido por" value={form.referidoPor}
                onChange={v => setF("referidoPor", v)} ph="Quién te lo pasó" />
            )}
            <Inp label="Email" type="email" value={form.email}
              onChange={v => setF("email", v)} ph="hola@ejemplo.com" />
            <Inp label="Fecha de contacto" type="date" value={form.fechaContacto}
              onChange={v => setF("fechaContacto", v)} />
            <Sel label="Estado" value={form.estado}
              onChange={v => setF("estado", v)} options={ESTADOS} placeholder="Contactado" />
            <Inp label="Próximo seguimiento" type="date" value={form.seguimiento}
              onChange={v => setF("seguimiento", v)} />
            <Inp label="Importe (base, sin IVA)" type="number" value={form.importe}
              onChange={v => setF("importe", v)} ph="Déjalo vacío si aún no hay precio" />
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
              {saving ? "Guardando…" : editId ? "Guardar cambios" : "Crear contacto"}
            </Btn>
            <Btn variant="outline" onClick={cerrarForm} disabled={saving}>
              Cancelar
            </Btn>
          </div>
        </Card>
      )}

      {/* GRÁFICO POR CANAL */}
      {porCanal.filas.length > 0 && (
        <Card>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 6
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <IconPill icon={TrendingUp} size={28} />
              <Lbl>Qué canal te trae dinero</Lbl>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["Todos", ...ORIGENES].map(o => (
                <FiltroPill
                  key={o}
                  active={origenGrafico === o}
                  onClick={() => setOrigenGrafico(o)}
                >
                  {o}
                </FiltroPill>
              ))}
            </div>
          </div>

          <div style={{
            fontSize: 12,
            fontFamily: B.font,
            color: B.ink,
            opacity: 0.55,
            marginBottom: 18
          }}>
            Euros ganados · ganados/cerrados · tasa de cierre
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {porCanal.filas.map(f => (
              <BarraCanal
                key={f.canal}
                canal={f.canal}
                ganados={f.ganados}
                cerrados={f.cerrados}
                euros={f.euros}
                maxEuros={porCanal.maxEuros}
              />
            ))}
          </div>

          {pocoDato && (
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
              Con {kpis.cerrados} presupuesto{kpis.cerrados === 1 ? "" : "s"} cerrado{kpis.cerrados === 1 ? "" : "s"}, estos
              porcentajes todavía son ruido. Empiezan a significar algo a partir de seis u ocho por canal.
            </div>
          )}
        </Card>
      )}

      {/* FILTROS */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {[
          ["abiertos", "Vivos"],
          ["ganados", "Ganados"],
          ["descartados", "Descartados"],
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
          {lista.length} registro{lista.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* LISTA */}
      {lista.length === 0 ? (
        <Card>
          <div style={{ textAlign: "center", padding: "28px 12px", fontFamily: B.font }}>
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
              maxWidth: 400,
              margin: "6px auto 0",
              lineHeight: 1.5
            }}>
              Apunta aquí a todo el que contactes o te contacte, con fecha de seguimiento.
              Es lo que evita que se te escapen.
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
