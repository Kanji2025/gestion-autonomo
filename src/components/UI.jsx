// src/components/UI.jsx
// Componentes reutilizables. REDISEÑO 2026.
// Mantiene toda la API anterior + añade IconPill, Btn, StatusPill, ToggleBtn, PageHeader.

import { B, fmt, MESES_FULL } from "../utils.js";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle
} from "lucide-react";

// ============================================================
// TARJETA — blanca plana, soporta dark y accent (yellow/lavender)
// ============================================================
export function Card({ children, style, dark = false, accent = null }) {
  const bg = dark
    ? B.ink
    : accent === "yellow"
    ? B.yellow
    : accent === "lavender"
    ? B.lavender
    : B.surface;
  const border = dark || accent ? "transparent" : B.border;
  return (
    <div style={{
      background: bg,
      borderRadius: 20,
      border: `1px solid ${border}`,
      padding: "clamp(20px, 3vw, 28px)",
      color: dark ? "#fff" : B.ink,
      position: "relative",
      ...style
    }}>
      {children}
    </div>
  );
}

// ============================================================
// LABELS — etiquetas pequeñas en mayúsculas con tracking
// ============================================================
export function Lbl({ children, color }) {
  return (
    <span style={{
      fontSize: B.ty.label,
      color: color || B.muted,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.1em",
      fontFamily: B.font
    }}>
      {children}
    </span>
  );
}

export function Big({ children, color }) {
  return (
    <span style={{
      fontSize: B.ty.numL,
      fontWeight: 700,
      color: color || B.text,
      fontFamily: B.font,
      letterSpacing: "-0.02em",
      display: "block",
      marginTop: 6,
      ...B.num
    }}>
      {children}
    </span>
  );
}

export function Sub({ children }) {
  return (
    <span style={{
      fontSize: B.ty.small,
      color: B.muted,
      fontFamily: B.font
    }}>
      {children}
    </span>
  );
}

// ============================================================
// ICON PILL — círculo con icono dentro (para tarjetas)
// ============================================================
export function IconPill({ icon: Icon, dark = false, size = 32, color = null }) {
  if (!Icon) return null;
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: 999,
      background: dark ? "rgba(255,255,255,0.08)" : "#f4f4f4",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0
    }}>
      <Icon size={size * 0.5} strokeWidth={1.75} color={color || (dark ? "#fff" : B.ink)} />
    </div>
  );
}

// ============================================================
// BOTÓN — variantes (primary/outline/ghost/danger) + tamaños (sm/md/lg)
// ============================================================
export function Btn({
  children,
  onClick,
  variant = "primary",
  size = "md",
  icon: Icon,
  iconBefore = false,
  disabled = false,
  style = {},
  type = "button"
}) {
  const sizes = {
    sm: { padding: "8px 14px", fontSize: 12 },
    md: { padding: "10px 18px", fontSize: 13 },
    lg: { padding: "13px 22px", fontSize: 14 }
  };
  const variants = {
    primary: { background: B.ink, color: "#fff", border: "1px solid transparent" },
    outline: { background: "transparent", color: B.ink, border: `1px solid ${B.border}` },
    danger: { background: B.danger, color: "#fff", border: "1px solid transparent" },
    ghost: { background: "transparent", color: B.ink, border: "1px solid transparent" }
  };
  const iconSize = size === "sm" ? 13 : size === "lg" ? 16 : 15;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...sizes[size],
        ...variants[variant],
        borderRadius: 999,
        fontFamily: B.font,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        opacity: disabled ? 0.5 : 1,
        whiteSpace: "nowrap",
        letterSpacing: "0.005em",
        transition: "opacity 0.15s ease",
        ...style
      }}
    >
      {Icon && iconBefore && <Icon size={iconSize} strokeWidth={2.25} />}
      {children}
      {Icon && !iconBefore && <Icon size={iconSize} strokeWidth={2.25} />}
    </button>
  );
}

// ============================================================
// SEMÁFORO DE ESTADO — ahora con icono y soft background
// ============================================================
export function Sem({ estado }) {
  return <StatusPill estado={estado} />;
}

export function StatusPill({ estado }) {
  const map = {
    Cobrada: { c: B.green, bg: B.greenSoft, l: "Cobrada", icon: CheckCircle2 },
    Pendiente: { c: B.amber, bg: B.amberSoft, l: "Pendiente", icon: Clock },
    Vencida: { c: B.red, bg: B.redSoft, l: "Vencida", icon: AlertCircle }
  };
  const x = map[estado] || map.Pendiente;
  const Icon = x.icon;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      background: x.bg,
      color: x.c,
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 600,
      fontFamily: B.font,
      whiteSpace: "nowrap"
    }}>
      <Icon size={11} strokeWidth={2.5} />
      {x.l}
    </span>
  );
}

// ============================================================
// BARRA DE PROGRESO
// ============================================================
export function PBar({ value, max, label, color }) {
  const c = color || B.text;
  const pct = Math.min(((value || 0) / (max || 1)) * 100, 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontFamily: B.font }}>
        <span style={{ color: B.text, fontWeight: 600 }}>{label}</span>
        <span style={{ color: B.muted, ...B.num }}>{fmt(value)} / {fmt(max)}</span>
      </div>
      <div style={{
        background: "#f4f4f4",
        borderRadius: 999,
        height: 12,
        overflow: "hidden"
      }}>
        <div style={{
          width: `${Math.max(pct, 0)}%`,
          height: "100%",
          borderRadius: 999,
          background: c,
          transition: "width 1s ease"
        }} />
      </div>
      <div style={{
        display: "flex",
        justifyContent: "flex-end",
        fontSize: 11,
        color: B.muted,
        fontWeight: 500,
        fontFamily: B.font,
        ...B.num
      }}>
        {Math.round(pct)}%
      </div>
    </div>
  );
}

// ============================================================
// INPUT — bordes finos, focus en negro
// ============================================================
export function Inp({ label, value, onChange, type = "text", ph = "", onKey }) {
  return (
    <div>
      {label && (
        <label style={{
          fontSize: B.ty.label,
          fontWeight: 600,
          fontFamily: B.font,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: B.muted,
          display: "block",
          marginBottom: 6
        }}>
          {label}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={ph}
        onKeyDown={onKey}
        style={{ ...B.inp, ...B.num }}
        onFocus={e => (e.target.style.borderColor = B.ink)}
        onBlur={e => (e.target.style.borderColor = B.border)}
      />
    </div>
  );
}

// ============================================================
// TEXTAREA (para Notas)
// ============================================================
export function TxtArea({ label, value, onChange, ph = "", rows = 4 }) {
  return (
    <div>
      {label && (
        <label style={{
          fontSize: B.ty.label,
          fontWeight: 600,
          fontFamily: B.font,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: B.muted,
          display: "block",
          marginBottom: 6
        }}>
          {label}
        </label>
      )}
      <textarea
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        placeholder={ph}
        rows={rows}
        style={{
          ...B.inp,
          resize: "vertical",
          minHeight: 80,
          lineHeight: 1.5
        }}
        onFocus={e => (e.target.style.borderColor = B.ink)}
        onBlur={e => (e.target.style.borderColor = B.border)}
      />
    </div>
  );
}

// ============================================================
// SELECT — con flecha SVG inline
// ============================================================
export function Sel({ label, value, onChange, options, placeholder = "Selecciona..." }) {
  return (
    <div>
      {label && (
        <label style={{
          fontSize: B.ty.label,
          fontWeight: 600,
          fontFamily: B.font,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: B.muted,
          display: "block",
          marginBottom: 6
        }}>
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          ...B.inp,
          cursor: "pointer",
          appearance: "none",
          backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 14px center",
          paddingRight: 36
        }}
      >
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

// ============================================================
// FILTRO POR FECHA — pills con flecha SVG, "Limpiar" en minúscula
// ============================================================
export function FilterBar({ filtro, setFiltro }) {
  const y = new Date().getFullYear();
  const pillSel = {
    padding: "8px 28px 8px 12px",
    borderRadius: 999,
    border: `1px solid ${B.border}`,
    background: "#fff",
    color: B.ink,
    fontSize: 12,
    fontFamily: B.font,
    fontWeight: 600,
    outline: "none",
    cursor: "pointer",
    appearance: "none",
    backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center"
  };
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <select
        value={filtro.year}
        onChange={e => setFiltro({ ...filtro, year: e.target.value })}
        style={pillSel}
      >
        <option value="">Todos los años</option>
        {[y, y - 1, y - 2].map(v => <option key={v} value={v}>{v}</option>)}
      </select>

      <select
        value={filtro.tri}
        onChange={e => setFiltro({ ...filtro, tri: e.target.value, mes: "" })}
        style={pillSel}
      >
        <option value="">Trimestre</option>
        <option value="Q1">Q1</option>
        <option value="Q2">Q2</option>
        <option value="Q3">Q3</option>
        <option value="Q4">Q4</option>
      </select>

      <select
        value={filtro.mes}
        onChange={e => setFiltro({ ...filtro, mes: e.target.value, tri: "" })}
        style={pillSel}
      >
        <option value="">Mes</option>
        {MESES_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}
      </select>

      {(filtro.year || filtro.tri || filtro.mes !== "") && (
        <Btn
          variant="ghost"
          size="sm"
          onClick={() => setFiltro({ year: "", tri: "", mes: "" })}
          style={{ color: B.muted }}
        >
          Limpiar
        </Btn>
      )}
    </div>
  );
}

// ============================================================
// PAGE HEADER — título grande + subtítulo + acción a la derecha
// ============================================================
export function PageHeader({ title, subtitle, action }) {
  return (
    <section style={{
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 16,
      marginBottom: "clamp(20px, 3vw, 28px)",
      flexWrap: "wrap"
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{
          fontFamily: B.font,
          fontSize: B.ty.h1,
          fontWeight: 700,
          letterSpacing: "-0.025em",
          lineHeight: 1.1,
          margin: 0,
          color: B.ink
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{
            fontFamily: B.font,
            fontSize: B.ty.h1Sub,
            fontWeight: 400,
            color: B.muted,
            margin: "8px 0 0",
            letterSpacing: "-0.005em"
          }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </section>
  );
}

// ============================================================
// SECTION HEADER — VERSIÓN LEGACY (mantener para retrocompatibilidad)
// Las pantallas que aún la usen seguirán funcionando.
// Internamente usa PageHeader sin subtitle.
// ============================================================
export function SectionHeader({ title, action, subtitle }) {
  return <PageHeader title={title} subtitle={subtitle} action={action} />;
}

// ============================================================
// MENSAJES (Error / Success / Warning) con icono lucide
// ============================================================
export function ErrorBox({ children }) {
  if (!children) return null;
  return (
    <div style={{
      background: B.redSoft,
      color: B.red,
      padding: "12px 14px",
      borderRadius: 12,
      fontSize: 13,
      fontWeight: 600,
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontFamily: B.font
    }}>
      <AlertCircle size={15} strokeWidth={2.25} />
      {children}
    </div>
  );
}

export function SuccessBox({ children }) {
  if (!children) return null;
  return (
    <div style={{
      background: B.greenSoft,
      color: B.green,
      padding: "12px 14px",
      borderRadius: 12,
      fontSize: 13,
      fontWeight: 600,
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontFamily: B.font
    }}>
      <CheckCircle2 size={15} strokeWidth={2.25} />
      {children}
    </div>
  );
}

export function WarningBox({ children }) {
  if (!children) return null;
  return (
    <div style={{
      background: B.amberSoft,
      color: B.amber,
      padding: "12px 14px",
      borderRadius: 12,
      fontSize: 13,
      fontWeight: 600,
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontFamily: B.font
    }}>
      <AlertTriangle size={15} strokeWidth={2.25} />
      {children}
    </div>
  );
}

// ============================================================
// TOGGLE BUTTON (segmented control)
// ============================================================
export function ToggleBtn({ active, onClick, children, icon: Icon }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 14px",
      borderRadius: 999,
      border: "none",
      background: active ? B.surface : "transparent",
      color: B.ink,
      fontFamily: B.font,
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
      transition: "all 0.15s ease"
    }}>
      {Icon && <Icon size={13} strokeWidth={2} />}
      {children}
    </button>
  );
}

// ============================================================
// PANTALLA DE CARGA — spinner negro elegante
// ============================================================
export function LoadingScreen({ message = "Cargando…" }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: B.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: B.font
    }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@300;400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <style>{`@keyframes ga-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 32,
          height: 32,
          border: `3px solid ${B.border}`,
          borderTopColor: B.ink,
          borderRadius: "50%",
          animation: "ga-spin 0.8s linear infinite",
          margin: "0 auto 16px"
        }} />
        <div style={{ fontSize: 13, color: B.muted, fontWeight: 500 }}>{message}</div>
      </div>
    </div>
  );
}

// ============================================================
// KANJI MARK — logo SVG
// ============================================================
export function KanjiMark({ size = 26 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 140.89 140.89"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Kanji Estudio"
    >
      <circle cx="70.45" cy="70.45" r="69.95" fill="#000" />
      <path
        d="M54.9,69.72l-12.23,12.43v21.96h-8.29V35.74h8.29v35.22l34.4-35.22h10.88l-27.25,27.87,27.56,40.51h-9.95l-23.41-34.4Z"
        fill="#fafafa"
      />
      <path
        d="M106.5,98.42c0,4.04-2.69,6.73-6.73,6.73s-6.73-2.69-6.73-6.73,2.69-6.73,6.73-6.73,6.73,2.69,6.73,6.73Z"
        fill="#fafafa"
      />
    </svg>
  );
}
